import type { Hex } from "viem";
import type { RpcCaller } from "./rpcClient.js";
import type { ParsedSend } from "./txParse.js";
import {
  collectLogsFromCallTracer,
  executionFailureReason,
  extractCallTracerRevertReason,
  logsContainExecutionFailure,
} from "./safeExec.js";
import {
  isDebugTraceCallUnsupported,
  markDebugTraceCallUnsupported,
} from "./capabilityCache.js";

export function isDebugTraceCallUnsupportedError(err: unknown): boolean {
  const code = (err as { code?: number })?.code;
  if (code === -32601 || code === -32602) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /method not found|not supported|does not exist|invalid params|unknown method|method unavailable/i.test(
    msg
  );
}

export type TraceInspectOutcome =
  | { kind: "execution_failure"; reason: string }
  | { kind: "clean" }
  | { kind: "unavailable"; reason: string };

/**
 * Optional debug_traceCall + callTracer for Safe execTransaction.
 * Used for (1) log/trace proof when eth_simulateV1 logs are missing, and
 * (2) enriching ExecutionFailure abort copy with an inner revert string.
 * Abort itself must not require a successful decode of inner bytes.
 */
export async function inspectExecTransactionTrace(
  call: RpcCaller,
  parsed: ParsedSend,
  from: Hex,
  capabilityKey: string
): Promise<TraceInspectOutcome> {
  if (isDebugTraceCallUnsupported(capabilityKey)) {
    return {
      kind: "unavailable",
      reason: "debug_traceCall capability-cached as unsupported",
    };
  }

  const txCall: Record<string, string> = {
    from,
    data: parsed.data ?? "0x",
    value: `0x${parsed.value.toString(16)}`,
  };
  if (parsed.to) txCall.to = parsed.to;
  if (parsed.gas) txCall.gas = `0x${parsed.gas.toString(16)}`;

  try {
    const trace = await call("debug_traceCall", [
      txCall,
      "latest",
      { tracer: "callTracer", tracerConfig: { withLog: true } },
    ]);
    const logs = collectLogsFromCallTracer(trace);
    if (logsContainExecutionFailure(logs)) {
      const inner = extractCallTracerRevertReason(trace);
      return {
        kind: "execution_failure",
        reason: executionFailureReason(inner),
      };
    }
    return { kind: "clean" };
  } catch (err) {
    if (isDebugTraceCallUnsupportedError(err)) {
      markDebugTraceCallUnsupported(capabilityKey);
      return {
        kind: "unavailable",
        reason: "debug_traceCall unsupported on upstream",
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      kind: "unavailable",
      reason: `debug_traceCall failed: ${msg}`,
    };
  }
}

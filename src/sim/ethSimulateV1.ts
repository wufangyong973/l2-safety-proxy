import type { Hex } from "viem";
import type { RpcCaller } from "./rpcClient.js";
import type { ParsedSend } from "./txParse.js";
import { decodeRevertData, extractRevertHex } from "../decode/revert.js";
import type { SimResult } from "../types/index.js";
import {
  executionFailureReason,
  gs013OrBubbledReason,
  isExecTransactionData,
  logsContainExecutionFailure,
} from "./safeExec.js";

/**
 * True when the upstream rejects eth_simulateV1 as unavailable/unsupported
 * for our request shape. Includes:
 *   -32601 method not found
 *   -32602 invalid params (seen on Base Sepolia public RPC for our V1 shape)
 * plus common message patterns.
 */
export function isSimulateV1UnsupportedError(err: unknown): boolean {
  const code = (err as { code?: number })?.code;
  if (code === -32601 || code === -32602) return true;
  const msg = err instanceof Error ? err.message : String(err);
  // Arb Sepolia (nitro) returns -32000 + Go unmarshal error for our V1 params shape;
  // treat as unsupported so we fall through to eth_call + capability-cache.
  return /method not found|not supported|does not exist|invalid params|-32601|-32602|unknown method|method unavailable|cannot unmarshal|simOpts|unmarshal array/i.test(
    msg
  );
}

/**
 * Prefer eth_simulateV1 (EIP-simulation / Flashblocks-aware on Base).
 * Spec shape (pragmatic subset):
 *   eth_simulateV1([{ blockStateCalls: [{ calls: [{ from, to, data, value, gas }] }],
 *                     traceTransfers: false, validation: true }], "latest")
 *
 * Returns null if method is unsupported so caller can fall back to eth_call
 * and mark the upstream in the capability cache.
 *
 * Safe lock: when call results include a logs array, scan for ExecutionFailure
 * and hard-abort even if outer status is success.
 */
export async function simulateV1(
  call: RpcCaller,
  parsed: ParsedSend,
  from: Hex
): Promise<SimResult | null> {
  const callObj: Record<string, string> = {
    from,
    data: parsed.data ?? "0x",
    value: `0x${parsed.value.toString(16)}`,
  };
  if (parsed.to) callObj.to = parsed.to;
  if (parsed.gas) callObj.gas = `0x${parsed.gas.toString(16)}`;

  const params = [
    [
      {
        blockStateCalls: [{ calls: [callObj] }],
        traceTransfers: false,
        validation: true,
      },
    ],
    "latest",
  ];

  try {
    const result = (await call("eth_simulateV1", params)) as unknown;
    return interpretSimulateV1(result, parsed.data);
  } catch (err) {
    // Unsupported / invalid params for our shape → signal eth_call fallback
    if (isSimulateV1UnsupportedError(err)) {
      return null;
    }
    // Other errors: treat as sim failure (uncertain) unless definite revert data
    const hex = extractRevertHex(err);
    if (hex) {
      const decoded = decodeRevertData(hex);
      return {
        ok: false,
        method: "eth_simulateV1",
        confidence: "definite",
        reason: gs013OrBubbledReason(decoded.reason),
        rawData: hex,
        code: "DEFINITE_REVERT",
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (/GS013/i.test(msg)) {
      return {
        ok: false,
        method: "eth_simulateV1",
        confidence: "definite",
        reason: gs013OrBubbledReason(msg),
        code: "DEFINITE_REVERT",
      };
    }
    return {
      ok: false,
      method: "eth_simulateV1",
      confidence: "uncertain",
      reason: `eth_simulateV1 error: ${msg}`,
      code: "SIM_FAILURE",
    };
  }
}

function interpretSimulateV1(
  result: unknown,
  calldata: Hex | undefined
): SimResult {
  // Expected: array of block results → calls[] with status / error / returnData / logs
  if (!Array.isArray(result) || result.length === 0) {
    return {
      ok: false,
      method: "eth_simulateV1",
      confidence: "uncertain",
      reason: "eth_simulateV1 returned empty/unexpected shape",
      code: "SIM_FAILURE",
    };
  }

  const block = result[0] as Record<string, unknown>;
  const calls = (block.calls ?? block.results ?? []) as Array<
    Record<string, unknown>
  >;
  if (!Array.isArray(calls) || calls.length === 0) {
    // Some implementations return status at block level
    if (block.error) {
      const errObj = block.error as Record<string, unknown>;
      const data =
        typeof errObj.data === "string"
          ? (errObj.data as Hex)
          : undefined;
      const decoded = decodeRevertData(data);
      const msg =
        typeof errObj.message === "string"
          ? errObj.message
          : decoded.reason;
      return {
        ok: false,
        method: "eth_simulateV1",
        confidence: "definite",
        reason: gs013OrBubbledReason(msg),
        rawData: data,
        code: "DEFINITE_REVERT",
      };
    }
    // No per-call result and no logs → cannot claim log inspect
    return {
      ok: true,
      method: "eth_simulateV1",
      confidence: "definite",
      logsInspected: false,
    };
  }

  const first = calls[0]!;
  const status = first.status ?? first.error;
  const returnData = (first.returnData ?? first.data) as Hex | undefined;
  const gasUsed = first.gasUsed
    ? BigInt(first.gasUsed as string)
    : undefined;
  const logs = first.logs;
  const hasLogsArray = Array.isArray(logs);

  // status 0 / "0x0" / error present → revert (covers GS013 / bubbled inner)
  const reverted =
    first.error != null ||
    status === 0 ||
    status === "0x0" ||
    status === false ||
    (typeof first.status === "string" &&
      first.status.toLowerCase() === "0x0");

  if (reverted) {
    let reason = "execution reverted";
    let rawData: Hex | undefined = returnData;
    if (first.error && typeof first.error === "object") {
      const e = first.error as Record<string, unknown>;
      if (typeof e.message === "string") reason = e.message;
      if (typeof e.data === "string") rawData = e.data as Hex;
    } else if (typeof first.error === "string") {
      reason = first.error;
    }
    if (rawData) {
      const decoded = decodeRevertData(rawData);
      reason = decoded.reason;
    }
    return {
      ok: false,
      method: "eth_simulateV1",
      confidence: "definite",
      reason: gs013OrBubbledReason(reason),
      rawData,
      code: "DEFINITE_REVERT",
      gasUsed,
    };
  }

  // Outer success — Safe lock: ExecutionFailure in logs ⇒ hard abort
  if (hasLogsArray && logsContainExecutionFailure(logs)) {
    return {
      ok: false,
      method: "eth_simulateV1",
      confidence: "definite",
      reason: executionFailureReason(),
      code: "DEFINITE_REVERT",
      gasUsed,
    };
  }

  return {
    ok: true,
    method: "eth_simulateV1",
    confidence: "definite",
    gasUsed,
    logsInspected: hasLogsArray,
  };
}

/** Exported for tests — re-export shape helpers without widening API. */
export function execTransactionNeedsLogProof(data: Hex | undefined): boolean {
  return isExecTransactionData(data);
}

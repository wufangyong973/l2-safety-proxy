import type { Hex } from "viem";

/**
 * Safe.sol execTransaction selector (1.3 / 1.4 / current).
 * Detection is a heuristic: selector alone never aborts a clean success.
 */
export const EXEC_TRANSACTION_SELECTOR = "0x6a761202" as const;

/**
 * Safe.sol ExecutionFailure(bytes32 txHash, uint256 payment)
 * topic0 — 1.3.0 / 1.4.1 event carries only txHash+payment (no inner reason).
 */
export const EXECUTION_FAILURE_TOPIC =
  "0x23428b18acfb3ea64b08dc0c1d296ea9c09702c09083ca5272e64d115b687d23" as const;

/** Out of P0 — documented residual only. */
export const EXEC_TRANSACTION_FROM_MODULE_SELECTOR = "0x468721a7" as const;

const EXEC_TX_PREFIX = EXEC_TRANSACTION_SELECTOR.toLowerCase();

/** True when calldata starts with Safe execTransaction selector. */
export function isExecTransactionData(data: Hex | undefined | null): boolean {
  if (!data || data === "0x") return false;
  return data.toLowerCase().startsWith(EXEC_TX_PREFIX);
}

export function normalizeTopic(topic: unknown): string | undefined {
  if (typeof topic !== "string" || !topic.startsWith("0x")) return undefined;
  return topic.toLowerCase();
}

/**
 * Scan simulated / traced logs for Safe ExecutionFailure topic0.
 * Accepts geth-style { topics: string[] } and flat topic arrays.
 */
export function logsContainExecutionFailure(logs: unknown): boolean {
  if (!Array.isArray(logs)) return false;
  const want = EXECUTION_FAILURE_TOPIC.toLowerCase();
  for (const entry of logs) {
    if (!entry || typeof entry !== "object") continue;
    const topics = (entry as { topics?: unknown }).topics;
    if (!Array.isArray(topics) || topics.length === 0) continue;
    const t0 = normalizeTopic(topics[0]);
    if (t0 === want) return true;
  }
  return false;
}

/** Recursively collect log-like objects from debug_traceCall callTracer output. */
export function collectLogsFromCallTracer(trace: unknown, out: unknown[] = []): unknown[] {
  if (!trace || typeof trace !== "object") return out;
  const obj = trace as Record<string, unknown>;
  if (Array.isArray(obj.logs)) {
    for (const l of obj.logs) out.push(l);
  }
  if (Array.isArray(obj.calls)) {
    for (const c of obj.calls) collectLogsFromCallTracer(c, out);
  }
  return out;
}

/**
 * Best-effort inner revert / error string from callTracer (optional copy path).
 * Abort must not depend on this — 1.3/1.4 ExecutionFailure has no inner data.
 */
export function extractCallTracerRevertReason(trace: unknown): string | undefined {
  if (!trace || typeof trace !== "object") return undefined;
  const obj = trace as Record<string, unknown>;
  if (typeof obj.error === "string" && obj.error.length > 0) {
    return obj.error;
  }
  if (typeof obj.revertReason === "string" && obj.revertReason.length > 0) {
    return obj.revertReason;
  }
  if (Array.isArray(obj.calls)) {
    for (const c of obj.calls) {
      const inner = extractCallTracerRevertReason(c);
      if (inner) return inner;
    }
  }
  return undefined;
}

/** Buyer-facing reason when ExecutionFailure is proven but inner bytes are absent. */
export function executionFailureReason(inner?: string): string {
  if (inner && inner.trim()) {
    return `Safe execTransaction ExecutionFailure (inner: ${inner.trim()})`;
  }
  return (
    "Safe execTransaction ExecutionFailure " +
    "(Safe 1.3/1.4: outer success with non-zero safeTxGas/gasPrice; " +
    "inner reason requires debug_traceCall+callTracer)"
  );
}

/** GS013 / zero-gas outer revert copy (bubbled Error(string) or plain GS013). */
export function gs013OrBubbledReason(decodedOrMessage: string): string {
  const msg = decodedOrMessage.trim();
  if (/GS013/i.test(msg)) {
    return msg.includes("GS013") ? msg : `GS013: ${msg}`;
  }
  return msg;
}

export function isGs013Message(message: string): boolean {
  return /GS013/i.test(message);
}

import { recoverTransactionAddress, type Hex } from "viem";
import type { RpcCaller } from "./rpcClient.js";
import type { ParsedSend } from "./txParse.js";
import { decodeRevertData, extractRevertHex } from "../decode/revert.js";
import type { SimResult } from "../types/index.js";
import { gs013OrBubbledReason } from "./safeExec.js";

/**
 * Fallback: eth_call with recovered `from` at latest block.
 * Definite revert when node returns standard revert data;
 * uncertain on network / node errors.
 */
export async function simulateEthCall(
  call: RpcCaller,
  parsed: ParsedSend,
  from: Hex
): Promise<SimResult> {
  const txCall: Record<string, string> = {
    from,
    data: parsed.data ?? "0x",
    value: `0x${parsed.value.toString(16)}`,
  };
  if (parsed.to) txCall.to = parsed.to;
  if (parsed.gas) txCall.gas = `0x${parsed.gas.toString(16)}`;

  try {
    await call("eth_call", [txCall, "latest"]);
    return {
      ok: true,
      method: "eth_call",
      confidence: "definite",
    };
  } catch (err) {
    const hex = extractRevertHex(err);
    if (hex) {
      const decoded = decodeRevertData(hex);
      return {
        ok: false,
        method: "eth_call",
        confidence: "definite",
        reason: gs013OrBubbledReason(decoded.reason),
        rawData: hex,
        code: "DEFINITE_REVERT",
      };
    }

    const msg = err instanceof Error ? err.message : String(err);
    // Classic revert without data still counts as definite if message says so
    if (/execution reverted|revert/i.test(msg)) {
      return {
        ok: false,
        method: "eth_call",
        confidence: "definite",
        reason: gs013OrBubbledReason(msg),
        code: "DEFINITE_REVERT",
      };
    }

    return {
      ok: false,
      method: "eth_call",
      confidence: "uncertain",
      reason: `eth_call failed: ${msg}`,
      code: "SIM_FAILURE",
    };
  }
}

/** Recover signer address from signed raw tx (no key custody). */
export async function recoverSender(raw: Hex): Promise<Hex> {
  return recoverTransactionAddress({
    serializedTransaction: raw as Parameters<
      typeof recoverTransactionAddress
    >[0]["serializedTransaction"],
  });
}

import type { SpendPolicyConfig } from "../policy/types.js";
/** Certainty that a simulation result reflects on-chain truth. */
export type Certainty = "definite" | "uncertain";

/** @deprecated Use Certainty — kept as alias for older imports. */
export type Confidence = Certainty;

/**
 * Provenance of the simulation used for a send decision.
 * Surface name in abort / fail_open / forward responses.
 */
export type MethodConfidence = "simulate_v1" | "eth_call" | "unknown";

/** How the simulation was performed (internal). */
export type SimMethod =
  | "eth_simulateV1"
  | "eth_call"
  | "unavailable";

/** Guard policy: open = fail-open on uncertain; strict = abort on uncertain. */
export type GuardMode = "open" | "strict";

/** Decision taken by the guard for a send. */
export type GuardDecision =
  | "abort"
  | "fail_open"
  | "forward"
  | "policy_denied"
  | "chain_mismatch"
  | "unsigned_refused";

export interface SimSuccess {
  ok: true;
  method: SimMethod;
  confidence: Certainty;
  gasUsed?: bigint;
  /**
   * eth_simulateV1 returned a logs array that was scanned for Safe
   * ExecutionFailure. Absent/false means log proof was not available.
   */
  logsInspected?: boolean;
}

export interface SimRevert {
  ok: false;
  method: SimMethod;
  confidence: Certainty;
  reason: string;
  rawData?: `0x${string}`;
  gasUsed?: bigint;
  /** Short machine-readable code for clients */
  code: "DEFINITE_REVERT" | "UNCERTAIN_REVERT" | "SIM_FAILURE";
}

export type SimResult = SimSuccess | SimRevert;

export interface ChainConfig {
  id: string;
  name: string;
  chainId: number;
  /** Upstream JSON-RPC URL (user's existing RPC — we sit in front) */
  upstreamRpcUrl: string;
  /**
   * Optional alternate RPC used only for simulation when primary eth_call
   * is uncertain (e.g. a node that supports eth_simulateV1 / richer eth_call).
   * Send forwarding always uses upstreamRpcUrl.
   */
  fallbackRpcUrl?: string;
  /** Prefer eth_simulateV1 when the node advertises it */
  preferSimulateV1: boolean;
  /** Ecosystem tag for multi-L2 differentiation */
  ecosystem: "arbitrum" | "op-stack" | "base" | "other";
}

export interface GuardConfig {
  listenHost: string;
  listenPort: number;
  chains: Record<string, ChainConfig>;
  /** Default chain key when request has no x-l2sg-chain header */
  defaultChain: string;
  /**
   * open = fail-open on uncertain (default);
   * strict = abort when sim missing / unknown / low-confidence.
   */
  guardMode: GuardMode;
  /** Derived: true iff guardMode === "open". Kept for callers/tests. */
  failOpen: boolean;
  /** Layer 2 address/spend policy (default enabled=false). */
  policy: SpendPolicyConfig;
  /**
   * Append-only JSONL of send decisions. Unset = do not write.
   * See docs/DECISION_LOG.md.
   */
  decisionLogPath?: string;
}

/** Guard metadata attached to every send abort / fail_open / forward. */
export interface GuardResponseMeta {
  l2SendGuard: true;
  decision: GuardDecision;
  /** Simulation method provenance */
  confidence: MethodConfidence;
  /** definite | uncertain */
  certainty: Certainty;
  chainId: number;
  simMethod: SimMethod;
  /** Present when a revert was decoded */
  decoded?: {
    reason: string;
    kind?: string;
    selector?: string;
  };
  reason?: string;
  code?: string;
  rawData?: `0x${string}`;
  aborted?: boolean;
  failOpen?: boolean;
  /** 1 = simulation, 2 = spend policy, null = not a layer decision */
  layer?: 1 | 2 | null;
  /** Machine policy code, or null when this decision is not a policy deny. */
  policyCode?: string | null;
  /** Signed tx chain id when it disagreed with the selected chain. */
  signedChainId?: number;
  to?: `0x${string}`;
  value?: `0x${string}`;
  hint?: string;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown[];
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
  /** Non-standard extension: send-guard metadata on forward / fail_open success */
  l2sg?: GuardResponseMeta;
}

/** Methods that submit signed txs — intercepted for simulation. */
export const SEND_METHODS = new Set([
  "eth_sendRawTransaction",
  "eth_sendRawTransactionSync",
]);

/**
 * Unsigned send methods — refused (no key custody).
 * Agents/wallets must sign externally and use eth_sendRawTransaction.
 */
export const UNSIGNED_SEND_METHODS = new Set([
  "eth_sendTransaction",
]);

/** Custom error code: definite revert blocked by L2 Send Guard */
export const ERR_DEFINITE_REVERT = -32080;

/** Custom error code: unsigned send refused (use raw + external signer) */
export const ERR_UNSIGNED_SEND_REFUSED = -32081;

/** Custom error code: strict-mode abort on uncertain / missing sim */
export const ERR_STRICT_UNCERTAIN = -32082;

/** Custom error code: Layer 2 address/spend policy denied (definite stop, not fail-open) */
export const ERR_POLICY_DENIED = -32083;

/**
 * Signed tx chainId disagrees with the chain selected by x-l2sg-chain
 * (or the default chain). Not forwarded. Not a policy deny and not a sim abort.
 */
export const ERR_CHAIN_MISMATCH = -32084;

/** Map internal SimMethod → response confidence provenance. */
export function methodConfidence(method: SimMethod): MethodConfidence {
  if (method === "eth_simulateV1") return "simulate_v1";
  if (method === "eth_call") return "eth_call";
  return "unknown";
}

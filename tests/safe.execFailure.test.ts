import { describe, it, expect, beforeEach } from "vitest";
import { encodeErrorResult } from "viem";
import type { ChainConfig, GuardConfig } from "../src/types/index.js";
import { ERR_DEFINITE_REVERT } from "../src/types/index.js";
import { simulateRawTransaction } from "../src/sim/simulator.js";
import {
  clearAllCapabilityCaches,
  isDebugTraceCallUnsupported,
} from "../src/sim/capabilityCache.js";
import {
  EXECUTION_FAILURE_TOPIC,
  isExecTransactionData,
  logsContainExecutionFailure,
} from "../src/sim/safeExec.js";
import { COMMON_ERRORS_ABI } from "../src/decode/revert.js";
import { handleRequest } from "../src/proxy/handler.js";
import { defaultSpendPolicy } from "../src/policy/index.js";
import { FAKE_FROM, FAKE_RAW, SAFE_EXEC_RAW } from "./fixtures.js";

const baseChain = (over: Partial<ChainConfig> = {}): ChainConfig => ({
  id: "arb-sepolia",
  name: "Arbitrum Sepolia",
  chainId: 421614,
  upstreamRpcUrl: "http://primary-rpc",
  preferSimulateV1: true,
  ecosystem: "arbitrum",
  ...over,
});

function unsupported32601() {
  const err = new Error("Method not found") as Error & { code?: number };
  err.code = -32601;
  return err;
}

describe("Safe execTransaction ExecutionFailure (#17)", () => {
  beforeEach(() => {
    clearAllCapabilityCaches();
  });

  it("detects execTransaction selector on SAFE_EXEC_RAW only", () => {
    expect(SAFE_EXEC_RAW.toLowerCase()).toContain("6a761202");
    expect(isExecTransactionData("0x6a761202dead" as `0x${string}`)).toBe(true);
    expect(isExecTransactionData("0x")).toBe(false);
    // FAKE_RAW is a simple transfer (empty data)
    expect(FAKE_RAW.toLowerCase().includes("6a761202")).toBe(false);
  });

  it("logsContainExecutionFailure matches Safe topic0", () => {
    expect(
      logsContainExecutionFailure([
        {
          topics: [EXECUTION_FAILURE_TOPIC, "0x" + "ab".repeat(32)],
          data: "0x" + "00".repeat(32),
        },
      ])
    ).toBe(true);
    expect(
      logsContainExecutionFailure([
        { topics: ["0x" + "11".repeat(32)], data: "0x" },
      ])
    ).toBe(false);
  });

  it("lock1: V1 outer success + ExecutionFailure logs → DEFINITE_REVERT abort", async () => {
    const methods: string[] = [];
    const call = async (method: string) => {
      methods.push(method);
      if (method === "eth_simulateV1") {
        return [
          {
            calls: [
              {
                status: "0x1",
                returnData: "0x",
                gasUsed: "0x5208",
                logs: [
                  {
                    address: "0x1111111111111111111111111111111111111111",
                    topics: [EXECUTION_FAILURE_TOPIC, "0x" + "cd".repeat(32)],
                    data: "0x" + "00".repeat(32),
                  },
                ],
              },
            ],
          },
        ];
      }
      throw new Error("unexpected " + method);
    };
    const result = await simulateRawTransaction(baseChain(), SAFE_EXEC_RAW, {
      call,
      recover: async () => FAKE_FROM,
      capabilityKey: "http://primary-rpc",
    });
    expect(methods).toEqual(["eth_simulateV1"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.confidence).toBe("definite");
      expect(result.code).toBe("DEFINITE_REVERT");
      expect(result.reason).toMatch(/ExecutionFailure/);
    }
  });

  it("lock2: V1 outer success without logs + no trace → uncertain (not definite forward)", async () => {
    const methods: string[] = [];
    const call = async (method: string) => {
      methods.push(method);
      if (method === "eth_simulateV1") {
        return [
          {
            calls: [
              {
                status: "0x1",
                returnData: "0x",
                gasUsed: "0x5208",
                // no logs field
              },
            ],
          },
        ];
      }
      if (method === "debug_traceCall") throw unsupported32601();
      throw new Error("unexpected " + method);
    };
    const result = await simulateRawTransaction(baseChain(), SAFE_EXEC_RAW, {
      call,
      recover: async () => FAKE_FROM,
      capabilityKey: "http://primary-rpc",
    });
    expect(methods).toEqual(["eth_simulateV1", "debug_traceCall"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.confidence).toBe("uncertain");
      expect(result.code).toBe("SIM_FAILURE");
      expect(result.reason).toMatch(/without log\/trace/);
    }
    expect(isDebugTraceCallUnsupported("http://primary-rpc")).toBe(true);
  });

  it("lock2: non-execTransaction eth_call success stays definite forward", async () => {
    const call = async (method: string) => {
      if (method === "eth_simulateV1") throw unsupported32601();
      if (method === "eth_call") return "0x";
      throw new Error("unexpected " + method);
    };
    const result = await simulateRawTransaction(baseChain(), FAKE_RAW, {
      call,
      recover: async () => FAKE_FROM,
      capabilityKey: "http://primary-rpc",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.confidence).toBe("definite");
  });

  it("lock3: abort on ExecutionFailure without needing inner reason; trace enriches when present", async () => {
    const call = async (method: string) => {
      if (method === "eth_simulateV1") {
        return [
          {
            calls: [
              {
                status: "0x1",
                returnData: "0x",
                logs: [
                  {
                    topics: [EXECUTION_FAILURE_TOPIC],
                    data: "0x" + "00".repeat(32),
                  },
                ],
              },
            ],
          },
        ];
      }
      throw new Error("unexpected " + method);
    };
    const result = await simulateRawTransaction(baseChain(), SAFE_EXEC_RAW, {
      call,
      recover: async () => FAKE_FROM,
      capabilityKey: "http://primary-rpc",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.confidence).toBe("definite");
      // 1.3/1.4 copy — no inner bytes required
      expect(result.reason).toMatch(/1\.3\/1\.4|ExecutionFailure/);
    }
  });

  it("lock3: debug_traceCall callTracer alone can prove ExecutionFailure", async () => {
    const call = async (method: string) => {
      if (method === "eth_simulateV1") {
        return [
          {
            calls: [{ status: "0x1", returnData: "0x" }],
          },
        ];
      }
      if (method === "debug_traceCall") {
        return {
          type: "CALL",
          calls: [
            {
              type: "CALL",
              error: "execution reverted: slippage",
              logs: [
                {
                  topics: [EXECUTION_FAILURE_TOPIC],
                  data: "0x" + "00".repeat(32),
                },
              ],
            },
          ],
        };
      }
      throw new Error("unexpected " + method);
    };
    const result = await simulateRawTransaction(baseChain(), SAFE_EXEC_RAW, {
      call,
      recover: async () => FAKE_FROM,
      capabilityKey: "http://primary-rpc",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.confidence).toBe("definite");
      expect(result.code).toBe("DEFINITE_REVERT");
      expect(result.reason).toMatch(/ExecutionFailure/);
      expect(result.reason).toMatch(/slippage/);
    }
  });

  it("lock6: GS013 zero-gas outer revert → definite abort with GS013 copy", async () => {
    const call = async (method: string) => {
      if (method === "eth_simulateV1") throw unsupported32601();
      if (method === "eth_call") {
        const err = new Error("execution reverted: GS013") as Error & {
          code?: number;
        };
        err.code = 3;
        throw err;
      }
      throw new Error("unexpected " + method);
    };
    const result = await simulateRawTransaction(baseChain(), SAFE_EXEC_RAW, {
      call,
      recover: async () => FAKE_FROM,
      capabilityKey: "http://primary-rpc",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.confidence).toBe("definite");
      expect(result.code).toBe("DEFINITE_REVERT");
      expect(result.reason).toMatch(/GS013/);
    }
  });

  it("lock6: bubbled Error(string) on zero-gas path → definite abort with inner copy", async () => {
    const data = encodeErrorResult({
      abi: COMMON_ERRORS_ABI,
      errorName: "Error",
      args: ["transfer failed"],
    });
    const call = async (method: string) => {
      if (method === "eth_simulateV1") throw unsupported32601();
      if (method === "eth_call") {
        const err = new Error("execution reverted") as Error & {
          code?: number;
          data?: string;
        };
        err.code = 3;
        err.data = data;
        throw err;
      }
      throw new Error("unexpected " + method);
    };
    const result = await simulateRawTransaction(baseChain(), SAFE_EXEC_RAW, {
      call,
      recover: async () => FAKE_FROM,
      capabilityKey: "http://primary-rpc",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.confidence).toBe("definite");
      expect(result.reason).toBe("transfer failed");
    }
  });

  it("handler: outer-success+ExecutionFailure → -32080 abort, never forward", async () => {
    const call = async (method: string) => {
      if (method === "eth_simulateV1") {
        return [
          {
            calls: [
              {
                status: "0x1",
                returnData: "0x",
                logs: [{ topics: [EXECUTION_FAILURE_TOPIC], data: "0x" }],
              },
            ],
          },
        ];
      }
      throw new Error("unexpected");
    };
    const config: GuardConfig = {
      listenHost: "127.0.0.1",
      listenPort: 8545,
      guardMode: "open",
      failOpen: true,
      policy: defaultSpendPolicy(),
      defaultChain: "arb-sepolia",
      chains: { "arb-sepolia": baseChain() },
    };
    const forward = async () => {
      throw new Error("must not forward");
    };
    const res = await handleRequest(
      config,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendRawTransaction",
        params: [SAFE_EXEC_RAW],
      },
      undefined,
      {
        simulate: (chain, raw) =>
          simulateRawTransaction(chain, raw, {
            call,
            recover: async () => FAKE_FROM,
            capabilityKey: chain.upstreamRpcUrl,
          }),
        forward,
      }
    );
    expect(res.error?.code).toBe(ERR_DEFINITE_REVERT);
    expect(String(res.error?.message)).toMatch(/ExecutionFailure/);
  });

  it("V1 success with empty logs array → definite success for execTransaction", async () => {
    const call = async (method: string) => {
      if (method === "eth_simulateV1") {
        return [
          {
            calls: [
              {
                status: "0x1",
                returnData: "0x0000000000000000000000000000000000000000000000000000000000000001",
                logs: [],
              },
            ],
          },
        ];
      }
      throw new Error("unexpected " + method);
    };
    const result = await simulateRawTransaction(baseChain(), SAFE_EXEC_RAW, {
      call,
      recover: async () => FAKE_FROM,
      capabilityKey: "http://primary-rpc",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.confidence).toBe("definite");
      expect(result.logsInspected).toBe(true);
    }
  });
});

/**
 * Sealed offline demo — Safe execTransaction ExecutionFailure abort (#17).
 * Mock upstream only. No public RPC, keys, capital, or checkout URLs.
 *
 * Usage (after npm run build):
 *   node scripts/demo-safe-exec.mjs
 *
 * Exit 0 only when stdout matches docs/fixtures/safe-exec.expected.txt
 */
import http from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "../dist/proxy/server.js";
import { defaultSpendPolicy } from "../dist/policy/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED = join(ROOT, "docs/fixtures/safe-exec.expected.txt");

/** Anvil #0 signed Safe-shaped execTransaction (Arb Sepolia) — fixture only */
const SAFE_EXEC_RAW =
  "0x02f901f483066eee80843b9aca00843b9aca00830493e094111111111111111111111111111111111111111180b901846a761202000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c080a0fdebfe3d1e29d8e48a87cdc1aa18f171271aae0aa7167c999b26524a23610f45a03a43cbce7298bdc964e8ef41e1402018d658feadcd7fc7b14f5b659f805e1f96";

const EXECUTION_FAILURE_TOPIC =
  "0x23428b18acfb3ea64b08dc0c1d296ea9c09702c09083ca5272e64d115b687d23";

const lines = [];
function emit(line) {
  lines.push(line);
  console.log(line);
}

function startMockUpstream() {
  let forwardedSends = 0;
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const { method, id } = body;
      let payload;

      if (method === "eth_chainId") {
        payload = { jsonrpc: "2.0", id, result: "0x66eee" };
      } else if (method === "eth_simulateV1") {
        payload = {
          jsonrpc: "2.0",
          id,
          result: [
            {
              calls: [
                {
                  status: "0x1",
                  returnData: "0x",
                  gasUsed: "0x5208",
                  logs: [
                    {
                      address: "0x1111111111111111111111111111111111111111",
                      topics: [EXECUTION_FAILURE_TOPIC, "0x" + "ab".repeat(32)],
                      data: "0x" + "00".repeat(32),
                    },
                  ],
                },
              ],
            },
          ],
        };
      } else if (method === "eth_sendRawTransaction") {
        forwardedSends += 1;
        payload = {
          jsonrpc: "2.0",
          id,
          result: "0x" + "ff".repeat(32),
        };
      } else {
        payload = {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Method not found" },
        };
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${addr.port}`,
        getForwarded: () => forwardedSends,
      });
    });
  });
}

async function main() {
  const upstream = await startMockUpstream();
  const config = {
    listenHost: "127.0.0.1",
    listenPort: 0,
    guardMode: "open",
    failOpen: true,
    defaultChain: "arb-sepolia",
    policy: defaultSpendPolicy(),
    chains: {
      "arb-sepolia": {
        id: "arb-sepolia",
        name: "Arbitrum Sepolia",
        chainId: 421614,
        upstreamRpcUrl: upstream.url,
        preferSimulateV1: true,
        ecosystem: "arbitrum",
      },
    },
  };

  const proxy = createServer(config);
  await new Promise((r) => proxy.listen(0, "127.0.0.1", r));
  const addr = proxy.address();
  const proxyUrl = `http://127.0.0.1:${addr.port}`;

  try {
    emit("L2 Send Guard — sealed Safe execTransaction ExecutionFailure demo");
    emit("fixture-only · no live RPC · no checkout URL");
    emit("");

    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-l2sg-chain": "arb-sepolia",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendRawTransaction",
        params: [SAFE_EXEC_RAW],
      }),
    }).then((r) => r.json());

    const code = res.error?.code ?? null;
    const decision = res.error?.data?.decision ?? null;
    const forwarded = upstream.getForwarded();

    emit(`decision: ${decision}`);
    emit(`error.code: ${code}`);
    emit(`forwarded_sends: ${forwarded}`);
    emit(
      `reason_has_ExecutionFailure: ${String(res.error?.message ?? "").includes("ExecutionFailure")}`
    );
    emit("");
    if (code === -32080 && decision === "abort" && forwarded === 0) {
      emit("PASS: outer-success+ExecutionFailure aborted; not forwarded");
    } else {
      emit("FAIL: expected -32080 abort with zero forwards");
      process.exitCode = 1;
    }
  } finally {
    await new Promise((r) => proxy.close(r));
    await new Promise((r) => upstream.server.close(r));
  }

  const actual = lines.join("\n") + "\n";
  const expected = readFileSync(EXPECTED, "utf8");
  if (actual !== expected) {
    console.error("\nstdout drifted from docs/fixtures/safe-exec.expected.txt");
    console.error("--- expected ---\n" + expected);
    console.error("--- actual ---\n" + actual);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

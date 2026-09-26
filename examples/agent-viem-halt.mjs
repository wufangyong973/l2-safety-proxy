/**
 * Agent halt sample — viem HTTP transport pointed at L2 Send Guard.
 *
 * Offline: boots a local proxy (no keys, no public RPC, no capital).
 * After `npm run build`:
 *   node examples/agent-viem-halt.mjs
 *
 * Decisions:
 *   -32083 / policy_denied (including TX_UNPARSEABLE) → non-retryable halt
 *   -32080 definite revert → abort; the same raw is not sent again
 *   -32084 chain_mismatch → also non-retryable (covered by demo:dual-layer)
 *   never calls eth_sendTransaction
 *   viem transport retryCount is 0 so the client does not replay a deny
 *
 * Published consumers import helpers from "l2-send-guard/sdk".
 * This file imports the built package so it runs inside the repo without a publish.
 * If dist/ is missing it exits with a build instruction instead of a module error.
 */
import { existsSync } from "node:fs";
import http from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http as viemHttp, encodeErrorResult } from "viem";

const distServer = join(dirname(fileURLToPath(import.meta.url)), "../dist/proxy/server.js");
if (!existsSync(distServer)) {
  console.error(
    "agent-viem-halt: dist/ is missing. Run `npm run build`, then `node examples/agent-viem-halt.mjs`."
  );
  process.exit(1);
}

const { createServer } = await import("../dist/proxy/server.js");
const { defaultSpendPolicy } = await import("../dist/policy/index.js");
const { isDefiniteRevertError, isPolicyDeniedError, viemHttpArgs } = await import(
  "../dist/sdk/index.js"
);

const FAKE_RAW =
  "0x02f86d83066eee80843b9aca00843b9aca008252089400000000000000000000000000000000000000018080c001a07eade7c743ff2ea60f61c687ccca4b77553a14de08378371ac40c7d52a8f1d74a06fed4faa592ac84bae32b9311844176fc059eb70057c18450d4310072a880629";

const ERR_ABI = [
  {
    type: "error",
    name: "Error",
    inputs: [{ name: "message", type: "string" }],
  },
];

function startMockUpstream(mode) {
  let rawSends = 0;
  let unsignedSends = 0;
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const { method, id } = body;
      if (method === "eth_sendTransaction") unsignedSends += 1;
      if (method === "eth_sendRawTransaction") rawSends += 1;
      let payload;
      if (method === "eth_simulateV1") {
        payload = { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
      } else if (method === "eth_call" && mode === "definite-revert") {
        const data = encodeErrorResult({
          abi: ERR_ABI,
          errorName: "Error",
          args: ["demo: definite revert"],
        });
        payload = { jsonrpc: "2.0", id, error: { code: 3, message: "execution reverted", data } };
      } else if (method === "eth_call") {
        payload = { jsonrpc: "2.0", id, result: "0x" };
      } else if (method === "eth_sendRawTransaction") {
        payload = { jsonrpc: "2.0", id, result: "0x" + "ab".repeat(32) };
      } else {
        payload = { jsonrpc: "2.0", id, result: "0x1" };
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
        counts: () => ({ rawSends, unsignedSends }),
      });
    });
  });
}

async function boot(mode, policy) {
  const upstream = await startMockUpstream(mode);
  const proxy = createServer({
    listenHost: "127.0.0.1",
    listenPort: 0,
    guardMode: "open",
    failOpen: true,
    defaultChain: "arb-sepolia",
    policy,
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
  });
  await new Promise((r) => proxy.listen(0, "127.0.0.1", r));
  const addr = proxy.address();
  const proxyUrl = `http://127.0.0.1:${addr.port}`;
  const [guardUrl, guardOpts] = viemHttpArgs({ proxyUrl, chain: "arb-sepolia" });
  const client = createPublicClient({
    transport: viemHttp(guardUrl, { ...guardOpts, retryCount: 0 }),
  });
  return { proxy, upstream, client };
}

async function closeAll(proxy, upstream) {
  await new Promise((r) => proxy.close(r));
  await new Promise((r) => upstream.server.close(r));
}

/**
 * Submit one signed raw tx. Halts on policy deny. Refuses to rebroadcast a raw
 * that already aborted. This function never calls eth_sendTransaction.
 */
function createSubmitter(client) {
  let halted = false;
  const abortedRaws = new Set();
  let rpcCalls = 0;

  return {
    rpcCalls: () => rpcCalls,
    halted: () => halted,
    async submit(raw) {
      if (halted) return { action: "halted_skip" };
      if (abortedRaws.has(raw)) return { action: "no_rebroadcast" };
      rpcCalls += 1;
      try {
        await client.request({
          method: "eth_sendRawTransaction",
          params: [raw],
        });
        return { action: "forward" };
      } catch (err) {
        if (isPolicyDeniedError(err)) {
          halted = true;
          return { action: "halt" };
        }
        if (isDefiniteRevertError(err)) {
          abortedRaws.add(raw);
          return { action: "abort" };
        }
        throw err;
      }
    },
  };
}

// In-memory fence for this sample only. The raw tx targets 0x000…0001, which is
// not the entry below, so Layer 2 denies. This map is not a policy file: poison
// placeholders in policy JSON still fail `policy:check` and refuse process start.
const policy = defaultSpendPolicy();
policy.enabled = true;
policy.destinations = new Map([
  ["0x1111111111111111111111111111111111111111", {}],
]);

const deny = await boot("success", policy);
const denyLoop = createSubmitter(deny.client);
const firstDeny = await denyLoop.submit(FAKE_RAW);
const secondDeny = await denyLoop.submit(FAKE_RAW);
const denyCounts = deny.upstream.counts();
await closeAll(deny.proxy, deny.upstream);

const off = defaultSpendPolicy();
const abortBoot = await boot("definite-revert", off);
const abortLoop = createSubmitter(abortBoot.client);
const firstAbort = await abortLoop.submit(FAKE_RAW);
const secondAbort = await abortLoop.submit(FAKE_RAW);
const abortCounts = abortBoot.upstream.counts();
await closeAll(abortBoot.proxy, abortBoot.upstream);

const haltOk = firstDeny.action === "halt" && secondDeny.action === "halted_skip" && denyLoop.rpcCalls() === 1;
const abortOk =
  firstAbort.action === "abort" &&
  secondAbort.action === "no_rebroadcast" &&
  abortLoop.rpcCalls() === 1 &&
  abortCounts.rawSends === 0;
const neverUnsigned = denyCounts.unsignedSends === 0 && abortCounts.unsignedSends === 0;

console.log(`HALT policy_denied non-retryable: ${haltOk ? "PASS" : "FAIL"} (${firstDeny.action} then ${secondDeny.action})`);
console.log(`ABORT no rebroadcast same raw: ${abortOk ? "PASS" : "FAIL"} (${firstAbort.action} then ${secondAbort.action}, upstreamRaw=${abortCounts.rawSends})`);
console.log(`never eth_sendTransaction: ${neverUnsigned ? "PASS" : "FAIL"}`);

if (!haltOk || !abortOk || !neverUnsigned) process.exit(1);
console.log("agent-viem-halt OK");

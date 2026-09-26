# L2 Send Guard — client SDK

Thin helpers so wallets, bots, and agents can point at the proxy **without key custody**.
The SDK only builds a URL + optional `x-l2sg-chain` header. Signing stays in your wallet.

## Install / import

```bash
npm install l2-send-guard@0.5.0
```

Do not use `@latest`. From a git checkout, build first (`npm run build`) and import the same entry points.

```ts
import {
  viemHttpArgs,
  ethersV6Connection,
  createGuardFetch,
  createGuardConnection,
  GUARD_CHAIN_HEADER,
} from "l2-send-guard"; // or relative: ../sdk/index.js
```

Start the proxy first (`npm start` → `http://127.0.0.1:8545`).

## viem

```ts
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { viemHttpArgs } from "l2-send-guard";

const transport = http(
  ...viemHttpArgs({
    proxyUrl: "http://127.0.0.1:8545",
    chain: "base-sepolia",
  })
);

const client = createWalletClient({
  account: privateKeyToAccount(process.env.DEMO_KEY as `0x${string}`),
  chain: baseSepolia,
  transport,
});

// eth_sendRawTransaction goes through the guard (simulate → abort or fail-open)
await client.sendTransaction({ to: "0x…", value: 0n, data: "0xdeadbeef" });
```

Or inject a custom fetch:

```ts
import { createGuardFetch } from "l2-send-guard";

const transport = http("http://127.0.0.1:8545", {
  fetch: createGuardFetch({
    proxyUrl: "http://127.0.0.1:8545",
    chain: "arb-sepolia",
  }),
});
```

## ethers v6

```ts
import { FetchRequest, JsonRpcProvider, Wallet } from "ethers";
import { ethersV6Connection } from "l2-send-guard";

const { url, headers } = ethersV6Connection({
  proxyUrl: "http://127.0.0.1:8545",
  chain: "arb-sepolia",
});
const req = new FetchRequest(url);
for (const [k, v] of Object.entries(headers)) req.setHeader(k, v);

const provider = new JsonRpcProvider(req);
const wallet = new Wallet(process.env.DEMO_KEY!, provider);
// Sends are simulated by the proxy before broadcast
await wallet.sendTransaction({ to: "0x…", value: 0, data: "0xdeadbeef" });
```

## Raw JSON-RPC

```ts
import { createGuardConnection } from "l2-send-guard";

const { url, headers } = createGuardConnection({
  proxyUrl: "http://127.0.0.1:8545",
  chain: "base-sepolia",
});

await fetch(url, {
  method: "POST",
  headers,
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_sendRawTransaction",
    params: ["0x…"], // already signed — proxy never sees keys
  }),
});
```

## Notes

- **Fail-open** remains the proxy default: uncertain sims forward upstream.
- Definite reverts return JSON-RPC `-32080` with `data.confidence: "definite"`.
- `eth_sendTransaction` is **refused** (`-32081`) — sign externally and use `eth_sendRawTransaction`. See [docs/AGENTS.md](../../docs/AGENTS.md).
- Chain keys: `arb-sepolia`, `op-sepolia`, `base-sepolia`.
- No secrets belong in the SDK. Do not commit private keys.

## Typed errors (`-32080` / `-32083`)

```ts
import {
  isDefiniteRevertError,
  isPolicyDeniedError,
  classifyGuardError,
} from "l2-send-guard/sdk";

try {
  await client.sendTransaction({ ... });
} catch (err) {
  if (isDefiniteRevertError(err)) {
    // Layer 1 — definite revert aborted; do not broadcast same calldata
  } else if (isPolicyDeniedError(err)) {
    // Layer 2 — allowlist/caps; never fail-open
  } else {
    const kind = classifyGuardError(err); // definite_revert | policy_denied | ...
    throw err;
  }
}
```

## AgentKit / CDP

See [`examples/agentkit-viem.ts`](../../examples/agentkit-viem.ts) — pass Guard `proxyUrl` + `x-l2sg-chain` via `viemHttpArgs` / `createGuardFetch`. No `@coinbase/agentkit` dependency in this package.

**CDP Policy Engine** (hosted allowlist / `ethValue`) is complementary. Guard adds **Layer 1 definite-revert simulation** and **self-hosted** Layer 2 for local-sign / non-CDP RPC paths. We do not replace CDP. Competitive one-pager: [docs/COMPETITIVE.md](../../docs/COMPETITIVE.md).

## Layer 2 and halt

When the proxy has policy enabled, denials surface as `-32083` with `data.layer: 2`, `data.decision: "policy_denied"`, and `data.policyCode`. Treat that as a non-retryable halt. `-32080` means do not rebroadcast the same raw. Never send `eth_sendTransaction` (`-32081`). Signed `chainId` ≠ selected chain is `-32084` (`isChainMismatchError`).

Offline sample: [`examples/agent-viem-halt.mjs`](../../examples/agent-viem-halt.mjs).  
Decision table: [`docs/AGENT_DECISION_TABLE.md`](../../docs/AGENT_DECISION_TABLE.md).  
Agent template (poison placeholders — replace before use): [`policy.agent.example.json`](../../policy.agent.example.json).

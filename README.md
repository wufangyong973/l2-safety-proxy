# L2 Send Guard

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-public-brightgreen)](https://github.com/yellowgram/l2-safety-proxy)

**Multi-L2 pre-broadcast safety middleware** for agent wallets. It simulates `eth_sendRawTransaction` and aborts definite reverts. An optional **thin Layer 2** policy (allowlist + native caps) can stop a send before simulation. Signing stays outside the proxy.

Public: `git clone https://github.com/yellowgram/l2-safety-proxy.git`

There is no single “fail closed out of the box” mode. Pick a path below. Layer 1 `open` forwards uncertain simulations. Layer 2 off means there is no spend fence.

> **Support:** bugs with an offline repro go to Issues. How-to goes to Discussions. Paid wire-up is not a checkout — [SUPPORT.md](./SUPPORT.md).  
> **Offline proof:** [`docs/fixtures/dual-layer.expected.txt`](./docs/fixtures/dual-layer.expected.txt) · [`docs/INBOUND_DEMO.md`](./docs/INBOUND_DEMO.md)

## Supported surface (this release)

| | |
| --- | --- |
| **Chains** | `arb-sepolia`, `op-sepolia`, `base-sepolia` only. **Testnet only.** No mainnet SLA. |
| **Is** | A JSON-RPC proxy in front of your existing RPC |
| **Submit** | Signed `eth_sendRawTransaction` (and Sync). `eth_sendTransaction` is refused (`-32081`) |
| **Layer 1** | Sim → abort definite revert (`-32080`) or forward. Uncertain + `GUARD_MODE=strict` → `-32082` |
| **Layer 2** | Optional allowlist + native caps. Deny → `-32083` `policy_denied` (never fail-open). Default **off** |
| **Chain check** | Signed `chainId` ≠ selected chain → `-32084` `chain_mismatch` (not forwarded) |

**Not in this product:** key custody, Safe / Zodiac / ERC-7579, approval unwinding, hosted SaaS, a managed RPC, MEV protection. Those requests are Discussions or a paid SKU, not unlimited Issue debugging. See [SUPPORT.md](./SUPPORT.md).

## Pin

Install the exact version. Do not use `@latest`.

```bash
npm install l2-send-guard@0.5.0
```

The CLI is `l2-send-guard` (`npx l2-send-guard`). Imports are `l2-send-guard`, `l2-send-guard/sdk`, and `l2-send-guard/agent`.

Offline tests and `demo:dual-layer` run from the git tree (the npm package is the runtime, not the test suite):

```bash
git clone https://github.com/yellowgram/l2-safety-proxy.git
cd l2-safety-proxy
git checkout <commit>   # the commit published as l2-send-guard@0.5.0
npm ci && npm test && npm run build
```

There is no tagged binary. A Docker image digest is not published here. Compose is below for people who build the image themselves. Upgrade notes: [CHANGELOG.md](./CHANGELOG.md).

## Two install paths

### Human / ops (simulation first)

Layer 2 **off**. Layer 1 `GUARD_MODE=open` (uncertain sims forward). This matches a middleware that must not brick good sends when simulation is flaky.

```bash
cp .env.example .env
# leave L2SG_POLICY_ENABLED unset or false
npm ci && npm test && npm run build && npm start
# http://127.0.0.1:8545
```

### Agent MSP (policy is the spend fence)

Layer 2 **on**, with your allowlist. Copy `policy.agent.example.json`, **replace** the `0x1111…` / `0x2222…` placeholders, then:

```bash
npm run policy:check -- ./policy.json
# must print policy:check OK — the example file itself is poison and must fail a strict check
L2SG_POLICY_ENABLED=true L2SG_POLICY_FILE=./policy.json npm start
```

If policy is enabled and the file is missing, invalid, or still full of placeholders, the process **refuses to start**. It will not silently run with policy off. The same refusal happens when the merged config sets `allowAnyDestination` (file, a chain overlay, or `L2SG_POLICY_ALLOW_ANY`). `npm run policy:check` reads the file only; start is what applies the env overrides.

`GUARD_MODE` is a separate choice:

| Mode | Uncertain simulation | Risk |
| --- | --- | --- |
| `open` (default) | forward (`fail_open`) | A bad agent can still broadcast when sim is unsure |
| `strict` | abort (`-32082`) | Good sends can brick when the upstream sim is flaky |

**Policy ON is not a safe agent.** Allowlisting a router, Permit2, or multicall still moves value. Read [docs/RESIDUAL_BYPASSES.md](./docs/RESIDUAL_BYPASSES.md) before the first agent send. Decision table: [docs/AGENT_DECISION_TABLE.md](./docs/AGENT_DECISION_TABLE.md).

`L2SG_HOST` defaults to `127.0.0.1`. Binding `0.0.0.0` without an ACL turns the proxy into an unauthenticated raw-tx forwarder onto your upstream RPC. The process warns when it binds a wildcard.

## Error codes

| Code | `decision` | Meaning |
| --- | --- | --- |
| **-32080** | `abort` | Layer 1: definite revert. Not forwarded. Do not rebroadcast the same raw |
| **-32081** | `unsigned_refused` | `eth_sendTransaction` refused. No key custody |
| **-32082** | `abort` | Layer 1: uncertain sim and `GUARD_MODE=strict` |
| **-32083** | `policy_denied` | Layer 2: destination, cap, or `TX_UNPARSEABLE` (raw tx did not parse). Not forwarded. Non-retryable halt |
| **-32084** | `chain_mismatch` | Signed `chainId` ≠ selected chain. Not a policy deny and not a sim result |

**Simulation is not policy.** `-32080` means the tx would revert. `-32083` means the allowlist or cap said no — the tx might have succeeded on chain. Do not “fix” a policy deny by turning Layer 2 off.

Stable `error.data` fields: `decision`, `certainty`, `confidence`, `chainId`, `layer` (`1`, `2`, or `null`), `policyCode` (string on `-32083`, otherwise `null`).

Order inside a send: unsigned refuse → if policy is on and the raw tx does not parse, `-32083` `TX_UNPARSEABLE` → chain mismatch (`-32084`; legacy txs with no `chainId` are not compared) → Layer 2 policy (stop, no sim) → Layer 1 sim (abort or forward).

## Prove it offline

No keys, no capital, no public RPC. The demo exits non-zero if stdout drifts from the fixture.

```bash
npm ci
npm test
npm run build
npm run policy:check          # self-test: examples are poison, clean fixture passes
npm run demo:dual-layer       # diff vs docs/fixtures/dual-layer.expected.txt
node examples/agent-viem-halt.mjs
```

`/health` reports `guardMode`, `policy.enabled`, `policy.destinationCount` (not the addresses), and `policy.notifyConfigured` (`true`/`false`).

Troubleshooting: [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md). Decision log schema: [docs/DECISION_LOG.md](./docs/DECISION_LOG.md).

## Docker

Build locally. Publish **localhost** on the host. The process inside the container binds `0.0.0.0` so Docker can proxy the port, and it prints the wildcard warning.

```bash
docker compose up --build
# host: http://127.0.0.1:8545/health
```

The compose file mounts `policy.agent.example.json` read-only at `/policy/policy.json` and leaves Layer 2 off. Enable Layer 2 only after you replace placeholders and `policy:check` passes. Do not publish `0.0.0.0:8545:8545`.

## Agent transport

Point HTTP at the proxy. The halt sample never calls `eth_sendTransaction`:

```bash
npm run build   # the sample imports dist/; without a build it exits and says so
node examples/agent-viem-halt.mjs
```

```ts
import { http } from "viem";
import { viemHttpArgs, isPolicyDeniedError } from "l2-send-guard/sdk";

const transport = http(
  ...viemHttpArgs({ proxyUrl: "http://127.0.0.1:8545", chain: "base-sepolia" })
);
```

`-32083` → stop the loop. `-32080` → do not send that raw again. Table: [docs/AGENT_DECISION_TABLE.md](./docs/AGENT_DECISION_TABLE.md). Wiring notes: [`examples/agentkit-viem.ts`](./examples/agentkit-viem.ts), [`src/sdk/README.md`](./src/sdk/README.md).

## GUARD_MODE

| Mode | Env | Uncertain / missing sim |
| --- | --- | --- |
| **open** (default) | `GUARD_MODE=open` | **fail_open** — forward upstream |
| **strict** | `GUARD_MODE=strict` | **abort** (`-32082`) |

Alias: `L2SG_GUARD_MODE`. Legacy `L2SG_FAIL_OPEN` applies only when `GUARD_MODE` is unset, and stays through 0.6.0. It does not affect `-32083`.

## Other checks

Read-only Reth gas-cap probe (no keys, no broadcast): `RETH_BIN=$(which reth) npm run probe:gascap`. Notes: [docs/drafts/27342-design.md](./docs/drafts/27342-design.md).

## License

MIT — see [LICENSE](./LICENSE).

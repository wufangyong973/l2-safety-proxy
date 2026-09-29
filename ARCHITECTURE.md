# L2 Send Guard — Architecture

## What this is

Drop-in **JSON-RPC middleware** that sits **in front of an existing L2 RPC** (Alchemy, QuickNode, public endpoints, eRPC, self-hosted). On `eth_sendRawTransaction` (and related submit paths) it:

1. Parses the signed raw tx (**no private keys** — recovery of `from` only)
2. Simulates against the upstream node
3. If **definite** revert → abort with decoded reason + `confidence: "definite"`
4. If uncertain / stale / sim failure → **fail-open** (forward to upstream)
5. All other RPC methods pass through unchanged

It is **not** a general RPC cloud, indexer, MEV product, or key custodian.

## Request flow

```
Wallet / bot / agent
        │  JSON-RPC (eth_sendRawTransaction)
        ▼
┌─────────────────────────────────────┐
│   L2 Send Guard                     │
│  1. select chain                    │  (env + x-l2sg-chain header)
│  2. parse signed raw (no keys)      │
│  3. Layer 2 policy (if enabled)     │  address/spend — default OFF
│     ├ outside policy → -32083 STOP  │  (never fail-open)
│     └ within policy  → continue     │
│  4. Layer 1 simulate                │
│     ├ eth_simulateV1 / eth_call     │
│     ├ definite revert → -32080      │
│     ├ success         → forward     │
│     └ uncertain       → fail-open / strict (-32082)
└───────────────┬─────────────────────┘
                ▼
        Existing upstream RPC
```

**Why policy before sim:** denials are local and deterministic; skip upstream sim cost and avoid leaking denied destinations to the sim node.

## Confidence model

| Outcome | Confidence | Action (default) |
| --- | --- | --- |
| Node returns standard revert data / status=0 from sim (incl. GS013 / bubbled inner) | `definite` | **Abort** — return decoded error |
| Simulated Safe `ExecutionFailure` log (or trace proof) on `execTransaction` | `definite` | **Abort** — even if outer status success |
| Sim succeeds (non-`execTransaction`, or `execTransaction` with logs/trace inspected and no `ExecutionFailure`) | `definite` | Forward send |
| `execTransaction` outer success **without** log/trace inspection | `uncertain` | **Fail-open** / strict — never definite forward |
| Method missing, HTTP/network error, unparseable tx, unexpected shape | `uncertain` | **Fail-open** forward |
| `GUARD_MODE=open` (default) / legacy `L2SG_FAIL_OPEN=true` | uncertain | **fail_open** forward |
| `GUARD_MODE=strict` / legacy `L2SG_FAIL_OPEN=false` | uncertain / missing / unknown | **abort** (`-32082`) |

Response metadata on every send decision: `decision`, `confidence` (`simulate_v1`\|`eth_call`\|`unknown`), `certainty`, `chainId`, `decoded` when present.

**Ethics:** default fail-open so middleware lag or node quirks never brick operators. Simulation is advisory relative to on-chain truth; confidence flags make that explicit.

## Simulation strategy

1. **Prefer `eth_simulateV1`** when `preferSimulateV1` is true for the chain (Base Flashblocks-aware nodes, and any geth/OP build that advertises it).
2. If the method is **unsupported or unavailable for our request shape** — JSON-RPC `-32601` / `-32602`, **or** Arb Nitro Go unmarshal/`simOpts` shape rejects (`-32000`) — **fallback to `eth_call`** with recovered `from` at `latest` **before** any fail-open forward.
3. **Per-upstream capability cache (process lifetime):** after `-32601`/`-32602` (or equivalent message) for `eth_simulateV1`, that upstream URL skips V1 for the rest of the process and goes straight to `eth_call`.
4. **Optional `L2SG_RPC_FALLBACK_<CHAIN>`:** if primary `eth_call` is still uncertain, retry simulation against the alternate RPC (sends still forward to the primary upstream).
5. Decode `Error(string)` / `Panic(uint256)` / custom selectors for human-readable reasons. Confidence stays `definite` only on clear revert/success; unsupported V1 alone never fail-opens without trying `eth_call`.
6. **Safe-shaped `execTransaction` (`0x6a761202`):** after sim, require log inspect (`eth_simulateV1` logs) and/or optional `debug_traceCall`+`callTracer` before labeling outer success definite. `ExecutionFailure` → hard abort. Abort does not require inner revert bytes (1.3/1.4 event is txHash+payment only). This is **proposal→broadcast drift**, complementary to Protocol Kit sign-time sim — not a Safe product. Details: [docs/SAFE_EXEC_DRIFT.md](./docs/SAFE_EXEC_DRIFT.md).

No local revm dependency in M1 (KISS TypeScript). A future M2 may add an optional local engine for offline CI.

## Multi-ecosystem (hard differentiation)

Day-one config templates:

| Key | Ecosystem | Default public RPC |
| --- | --- | --- |
| `arb-sepolia` | Arbitrum | `sepolia-rollup.arbitrum.io` |
| `op-sepolia` | OP Stack | `sepolia.optimism.io` |
| `base-sepolia` | Base (OP Stack + Flashblocks path) | `sepolia.base.org` |

Select chain per request via `x-l2sg-chain: arb-sepolia` (or numeric chain id). This is explicitly **not** OP-only.

If the signed transaction includes a `chainId` and it disagrees with the selected chain, the proxy returns `-32084` `chain_mismatch` and does not simulate or forward. Legacy transactions with no `chainId` are not compared. Send order: unsigned refuse → if policy is enabled and the raw tx does not parse, `-32083` `TX_UNPARSEABLE` → chain mismatch → Layer 2 policy (if enabled) → Layer 1 simulation.


## Layer 1 vs Layer 2

| Layer | Question | On deny / uncertain | Default |
| --- | --- | --- | --- |
| **1 — Simulation** | Will this raw tx definitely revert? | Definite revert → `-32080` abort. Uncertain → **fail-open** (or strict `-32082`) | ON |
| **2 — Address/spend policy** | Should this address get money / be called at all? | Outside policy → `-32083` `policy_denied` **STOP** (never fail-open) | **OFF** |

### What Layer 2 is

- Optional config-driven **allowlist**, **per-destination / global native wei caps**, optional `requireApproval` + fire-and-forget notify hook.
- Inside the allowlist and under the cap, the send still goes through Layer 1. It forwards only when simulation does not abort.
- Outside policy = STOP; operator keeps keys and updates config.
- Best-effort ERC20 `transfer` / `transferFrom` **recipient** allowlist check (no ERC20 amount caps).

### What Layer 2 is not

- Not a Safe-enterprise / Zodiac / ERC-7579 policy engine, not on-chain enforcement. (Layer 1 **does** abort Safe-shaped `execTransaction` inner `ExecutionFailure` at Gate-2 — see [docs/SAFE_EXEC_DRIFT.md](./docs/SAFE_EXEC_DRIFT.md).)
- Not rolling daily aggregates, drip detection, or token-decimals accounting.
- Not key custody or a blocking human-approval server.
- Does **not** change Layer 1 fail-open semantics for simulation uncertainty.

### Residual bypasses (honesty)

Even with Layer 2 **ON**, these paths can move value or authority **without** the allowlisted “final” destination appearing as `tx.to`:

| Pattern | Why allowlist alone is incomplete |
| --- | --- |
| `approve` / `setApprovalForAll` | Spender later pulls tokens; Guard does not denylist selectors by default |
| **Permit2** / signature permits | Off-chain permit + later spend; not fully modeled in thin policy |
| **Multicall** / aggregators / routers | `tx.to` is the router; inner targets are in calldata — we do **not** unwind |
| Eth sent to a contract that forwards | Native `to` is allowlisted; onward calls are out of scope |

Document these to operators; do not claim “policy ON = safe agent.” One-pager: [docs/RESIDUAL_BYPASSES.md](./docs/RESIDUAL_BYPASSES.md). Optional future selector denylist stays **OFF-by-default** (see feature-addon backlog).

Enable via `L2SG_POLICY_ENABLED=true` and/or `L2SG_POLICY_FILE` (see `policy.example.json`, `policy.agent.example.json`).

## Threat model (M1)

| Threat | Mitigation |
| --- | --- |
| Middleware blocks good txs due to stale state | Fail-open on uncertain; document confidence |
| Middleware used as key custody | Never accepts seeds/keys; only signed raw txs |
| Operator thinks abort = on-chain certainty | `confidence` + `simMethod` in error `data` |
| Upstream outage during sim | Fail-open forward (may still fail at upstream) |
| Malicious upstream | Out of scope — trust model = user's chosen RPC |
| MEV / order-flow steering | None — no reordering, no private mempool product |
| DoS via heavy sim | M1: single sim per send; rate limits = hosted tier later |

## vs related tools

| Tool | Relation |
| --- | --- |
| **OP Security Proxy** | Problem validation (revert intercept + fail-open). Their scope is local OP Stack / revm. We differentiate: **Arbitrum + OP/Base from day one**, prefer **`eth_simulateV1`**, TypeScript drop-in, confidence UX. Do not clone OP-only. |
| **Tenderly** | Full simulation DevOps suite (paid, heavy). We are a **thin fail-open RPC middleware** for wallets/bots/agents that already have an RPC. |
| **eRPC** | Multi-upstream reliability/cache proxy. **Complementary** — place Send Guard in front of eRPC (or any RPC). Do not rebuild failover/indexing. |
| **Alchemy / QuickNode** | Managed RPC clouds. We sit in front; we do not replace them. |
| **CDP Policy Engine** | Hosted allowlist / ethValue for CDP wallets. **Complement** — Guard adds Layer 1 sim + self-hosted Layer 2 for local-sign paths. We do not replace CDP. |
| **Agent Control–style hosted policy** | Policy/approval UX. Differentiator: Guard = sim + thin policy self-hosted JSON-RPC. See [docs/COMPETITIVE.md](./docs/COMPETITIVE.md). |
| **Safe Protocol Kit** | Sign-time `estimateSafeTxGas` / `simulateAndRevert`. **Complementary** — Guard covers last-mile proposal→broadcast drift + `ExecutionFailure` abort at send time. Not a Protocol Kit replacement. |

## Out of scope (M1)

Hosted SaaS, billing, indexing, MEV, private-key custody, Safe-enterprise / Zodiac / ERC-7579 policy engines (Layer 2 stays thin allowlist+caps only). `execTransactionFromModule` is out of P0 (residual). Complement Protocol Kit; do not replace it.

## Package layout

```
src/
  config/     chain templates + env loader
  decode/     revert decoding
  sim/        eth_simulateV1 + eth_call + tx parse + capability cache
  proxy/      HTTP JSON-RPC server + intercept handler
  sdk/        viem / ethers helpers + typed -32080/-32083 errors (no key custody)
  agent/      check() dry-run API
  policy/     Layer 2 address/spend policy (default off)
  types/      shared types
scripts/      mocked latency bench (`npm run bench`)
tests/        unit + mocked integration (no secrets)
BENCH.md      raw vs guarded send methodology
```

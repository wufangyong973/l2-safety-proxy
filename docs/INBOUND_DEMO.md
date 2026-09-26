# Inbound demo pack (no keys, no capital)

**Audience:** strangers evaluating L2 Send Guard before asking for paid help.  
**Goal:** reproduce Layer 1 abort (`-32080`) and Layer 2 policy stop (`-32083`) offline in under 10 minutes — or read the expected transcript below without running.

OSS stays free. Paid SKUs (optional): [`SUPPORT.md`](../SUPPORT.md). Pilot skeleton: [`PILOT_SOW.md`](./PILOT_SOW.md). Positioning: [`COMPETITIVE.md`](./COMPETITIVE.md).

---

## Exact commands

```bash
git clone https://github.com/yellowgram/l2-safety-proxy.git
cd l2-safety-proxy
npm install
npm test
npm run build
npm run demo:dual-layer
```

Optional follow-ons (still free / self-hosted):

```bash
npm run demo:offline    # Layer 1 only (abort + fail-open)
npm start               # http://127.0.0.1:8545 — then curl /health
```

Agent wiring (signing stays local — no custody):

- Halt sample: [`examples/agent-viem-halt.mjs`](../examples/agent-viem-halt.mjs) (`-32083` stops the loop; `-32080` does not resend the same raw)
- Transport notes: [`examples/agentkit-viem.ts`](../examples/agentkit-viem.ts)
- Policy template: [`policy.agent.example.json`](../policy.agent.example.json) — placeholders fail `npm run policy:check -- policy.agent.example.json`
- Residual bypasses: [`docs/RESIDUAL_BYPASSES.md`](./RESIDUAL_BYPASSES.md)

---

## How to read the error codes

| Code | Meaning | Layer | Fail-open? |
| --- | --- | --- | --- |
| **`-32080`** | Definite-revert **abort** — sim says the signed raw tx will revert; **not** forwarded upstream | 1 (simulation) | No |
| **`-32083`** | **Policy stop** (`policy_denied`) — destination / spend outside Layer 2 allowlist or caps; **not** forwarded | 2 (address/spend) | **Never** (deny is definite) |
| `-32081` | `eth_sendTransaction` refused (no key custody) | — | N/A |
| `-32082` | Uncertain sim aborted because `GUARD_MODE=strict` | 1 | No (strict only) |
| `-32084` | Signed `chainId` ≠ selected chain (`chain_mismatch`) | — | N/A (not forwarded) |

On aborts, inspect `error.data`: `decision`, `confidence` / `certainty`, `chainId`, `layer`, `decoded` (Layer 1) or `policyCode` / `hint` (Layer 2). Success / fail-open forwards may attach the same shape under JSON-RPC extension `l2sg`.

**Honesty:** simulation ≠ on-chain truth. Layer 2 allowlist does **not** unwind `approve` / Permit2 / multicall — see [ARCHITECTURE.md](../ARCHITECTURE.md#what-layer-2-is-not).

---

## Expected dual-layer transcript

Run after `npm run build`. No public RPC, keys, or capital. The script exits 1 if its stdout differs from [`docs/fixtures/dual-layer.expected.txt`](./fixtures/dual-layer.expected.txt).

```bash
npm run demo:dual-layer
```

PASS lines in that file:

```text
-32080 definite-revert abort: PASS
-32081 unsigned refusal: PASS
-32083 policy_denied stop: PASS
-32084 chain mismatch: PASS
chain-select arb/op/base: PASS
```

---

## Next steps if it fits

1. Try AgentKit / viem drop-in (`examples/agentkit-viem.ts` + `policy.agent.example.json`). Before a funded burner, walk [`OPERATOR.md`](./OPERATOR.md).
2. Compare vs hosted policy engines: [`COMPETITIVE.md`](./COMPETITIVE.md).
3. Want hands-on wire-up or a policy pack review? Read [`SUPPORT.md`](../SUPPORT.md) first. There is no payee in this repo. Bring the artifacts in [`BUYER_ACCEPTANCE.md`](./BUYER_ACCEPTANCE.md). Scope skeleton: [`PILOT_SOW.md`](./PILOT_SOW.md).

Income / kill clock (internal): [`INCOME_GATE.md`](./INCOME_GATE.md).

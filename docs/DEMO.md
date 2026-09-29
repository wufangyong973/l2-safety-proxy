# Public demo — Sepolia (Arb / Base / OP), no secrets required

Integrator walkthrough for **L2 Send Guard**: run the proxy against **public** Arbitrum Sepolia, Base Sepolia, and OP Sepolia RPCs, then prove **definite-revert abort** and **fail-open**.

| Constraint | Status |
| --- | --- |
| API keys | Not required (public RPCs) |
| Capital / funded wallet | Not required for abort + fail-open demos |
| Private keys in repo / `.env` | Never — ephemeral or offline fixtures only |
| Mainnet | Out of scope |

> Simulation is not on-chain truth. Always read `confidence` / `aborted` on error payloads.

---

## Path A — npm (recommended first)

### 1. Install, test, build

```bash
git clone https://github.com/yellowgram/l2-safety-proxy.git
cd l2-safety-proxy          # package root (this directory)
npm install
npm test                    # must pass
npm run build
```

Optional env (public defaults already work):

```bash
cp .env.example .env        # do not put keys or mnemonics here
# Defaults:
#   L2SG_RPC_ARB_SEPOLIA  → https://sepolia-rollup.arbitrum.io/rpc
#   L2SG_RPC_BASE_SEPOLIA → https://sepolia.base.org
#   L2SG_RPC_OP_SEPOLIA   → https://sepolia.optimism.io
```

### 2. Start the proxy

```bash
npm start
# → http://127.0.0.1:8545
```

Health (expect all three chains + `failOpen: true`):

```bash
curl -s http://127.0.0.1:8545/health | jq .
```

### 3. Pass-through smoke (public RPCs, read-only)

```bash
# Default chain = arb-sepolia (421614 / 0x66eee)
curl -s http://127.0.0.1:8545 -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'

# Base Sepolia (84532 / 0x14a34)
curl -s http://127.0.0.1:8545 -H 'content-type: application/json' \
  -H 'x-l2sg-chain: base-sepolia' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'

# OP Sepolia (11155420 / 0xaa37dc)
curl -s http://127.0.0.1:8545 -H 'content-type: application/json' \
  -H 'x-l2sg-chain: op-sepolia' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
```

### 4. Offline proof: abort + fail-open (no network capital)

Best first proof — **no public RPC, no keys, no broadcast**:

```bash
npm run build
npm run demo:dual-layer    # -32080 + -32083
npm run demo:safe-exec     # Safe execTransaction ExecutionFailure → -32080 (fixture-only)
node scripts/demo-offline.mjs   # Layer 1 abort + fail-open only
```

Dual-layer expected summary (full file: `docs/fixtures/dual-layer.expected.txt`):

```text
-32080 definite-revert abort: PASS
-32081 unsigned refusal: PASS
-32083 policy_denied stop: PASS
-32084 chain mismatch: PASS
chain-select arb/op/base: PASS
```

Layer-1-only offline expected summary:

```text
definite-revert abort: PASS   # JSON-RPC -32080, aborted:true, upstream sends: 0
fail-open forward:     PASS   # result hash returned, upstream sends: 1
```

### 5. Live Sepolia: definite-revert abort (Base public RPC)

Unfunded ephemeral key + known-reverting calldata against Base Sepolia USDC. The proxy aborts before broadcast (`-32080`). No capital required; key is generated in memory and discarded.

```bash
# with proxy NOT already bound on :8545 — script starts its own ephemeral listener
node scripts/live-smoke-cache.mjs
```

Expect JSON-RPC **`-32080`**, `confidence: "definite"`, `aborted: true`, `simMethod: "eth_call"` (after `eth_simulateV1` unsupported on the public Base endpoint). See [SMOKE.md](./SMOKE.md) for dated results.

### 6. Wire your app / SDK

Point your HTTP RPC URL at `http://127.0.0.1:8545` and set `x-l2sg-chain`. Signing stays in your wallet — the guard only sees signed raw txs.

- Agent submit rules: [AGENTS.md](./AGENTS.md)
- viem / ethers helpers: [src/sdk/README.md](../src/sdk/README.md)

---

## Path B — Docker

```bash
git clone https://github.com/yellowgram/l2-safety-proxy.git
cd l2-safety-proxy
docker compose up --build
# → http://127.0.0.1:8545  (L2SG_HOST=0.0.0.0 inside the container)
```

Then run the same health + `eth_chainId` curls from Path A §2–3 against `http://127.0.0.1:8545`.

Offline abort/fail-open demo still uses npm (needs Node on the host):

```bash
npm install && npm run build && node scripts/demo-offline.mjs
```

Or exec into a Node sidecar; the compose file only ships the proxy service.

---

## What you should see

| Scenario | Confidence | Proxy action | Integrator signal |
| --- | --- | --- | --- |
| Clear revert (decoded / `execution reverted`) | `definite` | **Abort** — do **not** forward | JSON-RPC **`-32080`**, `data.aborted: true`, `data.l2SendGuard: true` |
| Sim success | `definite` | Forward `eth_sendRawTransaction` | Upstream result (tx hash) |
| Unsupported method / network / parse / unclear | `uncertain` | **Fail-open** forward (default) | Upstream response; availability preserved |
| `eth_sendTransaction` | n/a | **Refuse** | JSON-RPC **`-32081`** — no key custody |

Default `L2SG_FAIL_OPEN=true`. Set `false` only if you explicitly want uncertain sims to surface as errors instead of forwarding.

---

## What not to do

- Do not put private keys, mnemonics, or funded wallets in `.env`
- Do not commit `.env`
- Do not treat simulation as absolute on-chain truth — read `confidence`
- Do not change GitHub visibility or publish secrets for a “public demo”
- Do not apply for grants / AF from this demo alone — see [AF_TRACTION_PREP.md](./AF_TRACTION_PREP.md)

## Related

- Architecture & threat model: [ARCHITECTURE.md](../ARCHITECTURE.md)
- Live smoke log: [SMOKE.md](./SMOKE.md)
- Soft WTP brief (no outreach): [SOFT_WTP.md](./SOFT_WTP.md)
- Agent traction plan: [TRACTION_PLAN.md](./TRACTION_PLAN.md)

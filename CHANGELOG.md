# Changelog

## 0.5.0

Minimum-support bar for the thin Guard. Pin `l2-send-guard@0.5.0`. Do not use `@latest`. The npm tarball ships `dist/` (CLI `l2-send-guard` → `dist/index.js`, library entry `dist/api.js`). No container image digest and no separate binary are published.

### Behavior

- Signed `chainId` is compared with the chain selected by `x-l2sg-chain` (name or numeric id) or the default chain. A mismatch returns **`-32084`** `chain_mismatch` and is not simulated or forwarded. Transactions with no `chainId` are not compared.
- `L2SG_POLICY_ENABLED=true` with no `L2SG_POLICY_FILE` and no `L2SG_POLICY_ALLOWLIST` refuses to start.
- A missing, unreadable, or schema-invalid `L2SG_POLICY_FILE` refuses to start. Policy does not silently turn off.
- An **enabled** policy that still contains placeholder destinations (`0x1111…` / `0x2222…`, any repeated non-zero nibble) refuses to start.
- An **enabled** policy with `allowAnyDestination: true` on the base document, a chain overlay, or `L2SG_POLICY_ALLOW_ANY` refuses to start. A file that stays disabled may still contain the flag. `npm run policy:check` flags that flag only when the file's `enabled` is true. It does not read env overrides; process start is the check for the merged config.
- `L2SG_POLICY_ALLOWLIST` entries that are not `0x` + 40 hex refuse to start.
- When policy is enabled and the raw transaction does not parse, the proxy returns **`-32083`** `policy_denied` with `policyCode: TX_UNPARSEABLE` and does not simulate or forward. Policy off keeps the Layer 1 path.
- `/health` `policy.destinationCount` is the number of distinct addresses on the base map or any chain overlay. It is not the effective allowlist for one chain, and it does not list addresses. `policy.allowAnyDestination` is true when the base flag or any overlay is true.
- `docker-compose.yml` publishes `127.0.0.1:8545:8545` and mounts the policy file read-only. The process inside the container still binds `0.0.0.0` so Docker's proxy can reach it, and it logs a wildcard-bind warning.

### Added

- `npm run policy:check` (self-test) and `npm run policy:check -- <file>` (strict).
- `npm run demo:dual-layer` checks stdout against `docs/fixtures/dual-layer.expected.txt` (`-32080`, `-32081`, `-32083`, `-32084`, chain select).
- `examples/agent-viem-halt.mjs` — `-32083` halts, `-32080` does not rebroadcast the same raw, never `eth_sendTransaction`.
- `error.data` for `-32080`..`-32083` includes `decision`, `certainty`, `confidence`, `chainId`, `layer`, and `policyCode` (`null` when the decision is not a policy deny).
- Optional `L2SG_DECISION_LOG` JSONL. Schema: [docs/DECISION_LOG.md](./docs/DECISION_LOG.md).
- Docs: [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md), [docs/AGENT_DECISION_TABLE.md](./docs/AGENT_DECISION_TABLE.md), [docs/RESIDUAL_BYPASSES.md](./docs/RESIDUAL_BYPASSES.md), [docs/BUYER_ACCEPTANCE.md](./docs/BUYER_ACCEPTANCE.md), [docs/DESIGN_ITERS.md](./docs/DESIGN_ITERS.md), [SUPPORT.md](./SUPPORT.md), [SECURITY.md](./SECURITY.md).

### Upgrade notes

- `GUARD_MODE` (`open` default, `strict`) is canonical. `L2SG_GUARD_MODE` is an alias. `L2SG_FAIL_OPEN` applies only when `GUARD_MODE` is unset. That legacy alias stays at least through **0.6.0** and will not be removed before then.
- Error code meanings `-32080` definite-revert abort, `-32081` unsigned refusal, `-32082` strict uncertain abort, and `-32083` policy deny are unchanged. `-32081` `error.data` gained `decision`, `certainty`, `confidence`, `layer`, and `policyCode` and kept `refused`, `code`, `useMethod`, and `hint`.
- Supported chains remain `arb-sepolia`, `op-sepolia`, and `base-sepolia` only. No mainnet chain was added.
- Policy JSON: unknown keys (other than `_` comment keys) now fail load and `policy:check`. `humanGate.mode`, when set, must be `"stop"`.

## 0.4.0

SDK helpers, `/health` policy summary, and an offline dual-layer demo that printed `-32080` and `-32083` without a checked-in transcript diff, chain mismatch enforcement, or `policy:check`.

## 0.3.0

Optional Layer 2 allowlist and native caps (`-32083`), default off, beside Layer 1 simulation.

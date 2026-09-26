# Remaining gaps

Verified on the tree, not from PR #15's description. Base checked was `3328052` (PR #15 merged). This file is the status after the operator pack.

## Still open

Only these:

1. **Checklist #26 — deferred (founder payee).** [SUPPORT.md](./SUPPORT.md) says there is no payee in the repo and nothing to pay until a founder invoice includes one. No Wise, Polar, USDT, or contact address was added.
2. **Soft-WTP and out of charter.** Existing Soft-WTP notes were not expanded. Not built: custody, Safe / Zodiac / ERC-7579, mainnet SLA, hosted SaaS, MEV protection. User-need items 48–56 are hard stops in [docs/OPERATOR.md](./docs/OPERATOR.md).
3. **User-owned fill-ins.** The templates exist. The RPC URLs, keys, host, allowlist addresses, cap numbers, RACI names, burner capital, notify endpoint, log store, alert destination, and prompt text stay with the operator. See the user-need table.

## Checklist 1–30

| # | Status | Evidence |
| --- | --- | --- |
| 1 | Done | `npm run demo:dual-layer` diffs `docs/fixtures/dual-layer.expected.txt` (`-32080`, `-32083`). CI runs it. No public RPC. |
| 2 | Done | `examples/agent-viem-halt.mjs` halts on `-32083`, does not rebroadcast `-32080`, never calls `eth_sendTransaction`. |
| 3 | Done | Same transcript: chain select arb/op/base and `-32084` when header and signed `chainId` disagree. |
| 4 | Done | Same transcript: `-32081` `unsigned_refused`. |
| 5 | Done | README "Two install paths". `.env.example`. `policy.agent.example.json`. |
| 6 | Done | README: there is no single "fail closed out of the box" mode. Open vs strict tradeoff is in that section. |
| 7 | Done | `src/policy/load.ts` throws on missing, invalid, placeholder, or `allowAnyDestination` when policy is enabled. `src/index.ts` exits 1. `/health` `policy.enabled` is the loaded flag. |
| 8 | Done | `L2SG_HOST` default `127.0.0.1` (`src/config/env.ts`). Wildcard bind warns (`src/proxy/server.ts`). Compose publishes `127.0.0.1:8545:8545`. |
| 9 | Done | `npm run policy:check` fails poison placeholders. Enabled poison refuses start. |
| 10 | Done | `docs/RESIDUAL_BYPASSES.md` linked from the Agent path in README. |
| 11 | Done | README codes `-32080`–`-32084`, sim ≠ policy, testnet-only. `docs/INBOUND_DEMO.md`. |
| 12 | Done | `docs/TROUBLESHOOTING.md`. Nonce/fee called out as client/upstream. |
| 13 | Done | `docs/AGENT_DECISION_TABLE.md`. |
| 14 | Done | README "Supported surface". |
| 15 | Done | Bug template requires the repro. `.github/workflows/repro-triage.yml` comments, labels `needs-repro`, closes after 14 days. `scripts/repro-triage.mjs`. |
| 16 | Done | `SECURITY.md` points at a private GitHub advisory. |
| 17 | Done | `.github/workflows/ci.yml` runs tests, `policy:check`, `demo:dual-layer`. No Sepolia job. |
| 18 | Done | `engines.node` `>=20`. Lockfile committed. CI matrix Node 20, 22, and 24. |
| 19 | Done | `npm run policy:check` in CI and in the Agent path README. |
| 20 | Done | `tests/golden.error-data.test.ts` for `-32080`–`-32083` including `layer` and `policyCode`. |
| 21 | Done (publish held) | Pin story is `l2-send-guard@0.5.0` in README, `package.json`, and CHANGELOG. `npm publish` is not run. No tagged binary is advertised. |
| 22 | Done | `CHANGELOG.md` upgrade notes, including the `L2SG_FAIL_OPEN` window through 0.6.0. |
| 23 | Done | README: npm pin, no tagged binary, no published image digest. |
| 24 | Done | `docker-compose.yml` read-only policy mount, localhost publish, `restart: unless-stopped`. |
| 25 | Done | `SUPPORT.md`. Issue template and discussion template match it. |
| 26 | Deferred | Founder payee. Boundary text only. |
| 27 | Done | `docs/BUYER_ACCEPTANCE.md`. |
| 28 | Done | SUPPORT.md out-of-scope reply. |
| 29 | Done | `/health` includes chains, `defaultChain`, `guardMode`, `policy.enabled`, `policy.destinationCount`, `policy.notifyConfigured`. |
| 30 | Done | `docs/DECISION_LOG.md` and `L2SG_DECISION_LOG`. |

## User needs

Guard-shippable means a doc, template, sample, or CI check an operator can follow. **User-owned** means they still have to fill or run it. Items 48–56 are out of charter.

| # | Theme | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Mental model | Done | `docs/PRE_INSTALL.md` |
| 2 | Role fit (`eth_sendRawTransaction` only) | Done | `docs/PRE_INSTALL.md` |
| 3 | Conscious install-path choice | Done | README, `.env.example`, `docs/templates/risk-acceptance.md` |
| 4 | Host and Node | Done (doc) / User-owned (the machine) | `docs/PRE_INSTALL.md`, `engines` |
| 5 | Upstream RPC plan | Done (blanks) / User-owned (URLs and keys) | `docs/PRE_INSTALL.md` |
| 6 | Signer separate from Guard | Done (doc) / User-owned (keys) | `docs/PRE_INSTALL.md`, `docs/AGENTS.md` |
| 7 | Burner and faucet | Done (note) / User-owned (capital) | `docs/templates/funding.md`, `docs/ENVIRONMENTS.md` |
| 8 | Allowlist inventory | Done (template) / User-owned (addresses) | `docs/templates/allowlist-inventory.md` |
| 9 | Their bypass map | Done (template) / User-owned (decisions) | `docs/templates/bypass-map.md`, `docs/RESIDUAL_BYPASSES.md` |
| 10 | Network topology | Done | `docs/TOPOLOGY.md` |
| 11 | RACI | Done (blanks) / User-owned (names) | `docs/templates/raci-and-oncall.md` |
| 12 | Pin in their lockfile | Done (instruction) / User-owned | `docs/UPGRADE.md`, README pin |
| 13 | Archive offline transcript | Done (instruction) / User-owned (their copy) | `docs/PRE_INSTALL.md` |
| 14 | Unsigned and wrong-chain on their client | Done (demo) / User-owned (their wiring) | dual-layer transcript, `docs/TRIAGE.md` |
| 15 | Health gate and alert | Done (what to page on) / User-owned (the monitor) | `docs/templates/health-alerts.md` |
| 16 | `policy:check` on their file | Done | README, `scripts/policy-check.ts` |
| 17 | Halt sample in their process | Done (sample) / User-owned (adoption) | `examples/agent-viem-halt.mjs` |
| 18 | Live testnet graduation | Done (note) / User-owned (capital and receipt) | `docs/ENVIRONMENTS.md` |
| 19 | Decision table in their repo | Done (page) / User-owned (paste) | `docs/AGENT_DECISION_TABLE.md` |
| 20 | Env contract | Done | `.env.example` |
| 21 | Policy file, caps rationale, read-only mount | Done (template + compose) / User-owned (numbers) | allowlist template, `docker-compose.yml` |
| 22 | Real notify URL | Done (warning) / User-owned (endpoint) | `docs/PRE_INSTALL.md` |
| 23 | Process supervision | Done (samples) / User-owned (install) | compose `restart`, `docs/templates/l2-send-guard.service` |
| 24 | Log sink and retention | Done (schema) / User-owned (disk) | `docs/DECISION_LOG.md` |
| 25 | Strict vs open sign-off | Done (template) / User-owned (signature) | `docs/templates/risk-acceptance.md` |
| 26 | Sim ≠ policy rule | Done | README, `docs/TRIAGE.md` |
| 27 | Transport inventory | Done (checklist) / User-owned (their clients) | `docs/templates/transport-inventory.md` |
| 28 | Chain header alignment | Done | `docs/TROUBLESHOOTING.md`, dual-layer `-32084` |
| 29 | Error state machine | Done (sample + table) / User-owned (their loop) | halt sample, decision table |
| 30 | SDK helpers | Done | README, `src/sdk/README.md` |
| 31 | Pre-flight `check()` | Done | `docs/CHANGE_PROTOCOL.md`, `docs/AGENTS.md` |
| 32 | Tool ↔ allowlist change protocol | Done | `docs/CHANGE_PROTOCOL.md` |
| 33 | Prompt / tool / allowlist alignment | Done (rule) / User-owned (prompt text) | `docs/CHANGE_PROTOCOL.md` |
| 34 | Funding runbook | Done (blanks) / User-owned | `docs/templates/funding.md` |
| 35 | Alert on policy drift | Done (signals) / User-owned (pager) | `docs/templates/health-alerts.md` |
| 36 | Upgrade discipline | Done | `docs/UPGRADE.md` |
| 37 | Staging vs funded testnet | Done | `docs/ENVIRONMENTS.md` |
| 38 | Latency budget | Done | `docs/LATENCY.md`, `BENCH.md` |
| 39 | Multi-agent topology | Done | `docs/TOPOLOGY.md` |
| 40 | Periodic bypass review | Done | `docs/CHANGE_PROTOCOL.md` |
| 41 | Their supply-chain pin | Done (instruction) / User-owned | `docs/UPGRADE.md` |
| 42 | On-call split | Done (blanks) / User-owned (names) | `docs/templates/raci-and-oncall.md` |
| 43 | Repro pack | Done | bug template, repro-triage workflow |
| 44 | First-line triage tree | Done | `docs/TRIAGE.md` |
| 45 | Loss taxonomy | Done | `docs/INCIDENTS.md` |
| 46 | Rollback and kill switch | Done | `docs/ROLLBACK.md` |
| 47 | Escalation chosen in advance | Done (template) / User-owned (which door) | `docs/templates/escalation.md`, `docs/BUYER_ACCEPTANCE.md` |
| 48–56 | Custody, mainnet, Safe, SaaS, treasury, public multi-tenant auth, bypass guarantee, founder on-call, compliance claim | Out of charter | `docs/OPERATOR.md` "Not provided" |

## Closed in this change

Checklist **#15** (auto comment and 14-day close; PR #15 left this manual) and **#18** (Node 24 on the CI matrix; PR #15 tested 20 and 22).

User-need docs that were absent on `3328052`: **#1, #2, #10, #32, #34, #36, #37, #38, #39, #44, #45, #46**, plus the fill-in templates for **#5, #8, #9, #11, #15, #23, #25, #27, #35, #42, #47**.

`npm publish` was not run. Version stays `0.5.0`.

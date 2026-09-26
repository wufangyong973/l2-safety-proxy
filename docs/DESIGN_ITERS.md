# Design iterations and code reviews (0.5.0 quality gate)

Strategy lock after these reviews: low-support OSS. Ticket-cutting docs and the halt sample only. No new chains, custody, Safe, mainnet, hosted service, or paid/grant pages.

Publish surface for `l2-send-guard@0.5.0`: `files` includes `dist` (gitignored, so a bare pack used to omit the bin), `bin` is `dist/index.js`, and `main` / `exports` point at `dist/api.js` so importing the library does not start the server. `npm publish` is not run from this tree when `NPM_TOKEN` is absent.

Scope of the attacks: policy semantics, refuse-start, dual-path defaults, error shapes, the offline demo contract, and the support boundary. No custody product, no Safe or ERC-7579, no mainnet SLA, no hosted service, and no payment processor is in this design.

## Design iteration 1 — security / ops

**Attack on the design that was about to ship.** `npm run policy:check` can exit 0, or be skipped, while process start still opens the destination fence: `allowAnyDestination: true` in the file, on a chain overlay, or via `L2SG_POLICY_ALLOW_ANY`. An enabled policy whose raw transaction does not parse skipped Layer 2 and, with `GUARD_MODE=open`, fail-opened into simulation and forward. `L2SG_POLICY_ALLOWLIST` tokens that are not addresses became useless map keys. `/health` reported `allowAnyDestination` from the base flag only, so an overlay could hide an open fence. The eval corpus kept `op-sepolia` / `base-sepolia` labels on a raw transaction signed for Arb Sepolia chainId 421614.

**Deltas**

| | |
| --- | --- |
| Keep | `-32084` `chain_mismatch` stays a separate code from policy deny. Poison placeholders refuse start only when the merged policy is enabled. Human/ops path stays Layer 2 off. The dual-layer demo still fails when stdout drifts from `docs/fixtures/dual-layer.expected.txt`. Support stays invoice documentation in SUPPORT.md; this repo has no payee. |
| Kill | "Enabled policy plus `allowAnyDestination` is a supported caps-only mode." That mode removes the fence the Agent path claims to turn on. |
| Change | Process start refuses when the merged enabled policy has `allowAnyDestination` on the base, any overlay, or the env flag. Unparseable raw with policy on returns `-32083` and does not simulate or forward. Invalid allowlist tokens refuse start. Health `allowAnyDestination` is the base flag OR any overlay. Corpus rows are labeled `arb-sepolia` only. |

## Design iteration 2 — maintainer / DX, attacking iteration 1

**Attack.** Refusing `allowAnyDestination` inside `evaluateSpendPolicy` would delete a flag the in-memory tests and the dual-layer demo still construct without the loader. Failing `policy:check` on `allowAnyDestination` even when `enabled: false` would reject files that process start accepts. Treating a missing `chainId` (legacy transactions) as `-32084` needs new fixtures and changes the rule "the header disagrees with the signed chainId" into "every transaction must carry a chainId." A new JSON-RPC code for unparseable bytes would miss every halt sample that only switches on `-32083`.

**Deltas**

| | |
| --- | --- |
| Keep | Iteration 1's start-time fence refusal, poison refusal, and `-32084` separation. `evaluateSpendPolicy` still honors `allowAnyDestination` for in-process callers (tests, demo) that do not go through `loadSpendPolicy`. |
| Kill | A new JSON-RPC code for parse failure. A `policy:check` failure on `allowAnyDestination` when the file is disabled. |
| Change | Unparseable raw stays `-32083` with `policyCode: TX_UNPARSEABLE`, in both the HTTP handler and `check()`, so an existing policy-deny halt covers it. `policy:check` records an `allowAnyDestination` sanity error only when that file has `enabled: true`. Document that `policy:check` does not see env; start does. Legacy transactions with no `chainId` are not compared. |

## Design iteration 3 — buyer / agent integrator, attacking iteration 2

**Attack.** Start is the authority for file plus env, but a buyer who only runs `policy:check` on a disabled file can still be surprised when `L2SG_POLICY_ENABLED=true` refuses. viem's HTTP transport retries by default, so a deny can be replayed even when the decision table says non-retryable. The halt sample's static `dist/` imports fail before `npm run build` with a module-not-found that does not say that. `-32084` is in the decision table and the demo transcript, and the halt sample never executes it, so an integrator can miss that it is also non-retryable. `PACKAGE_VERSION` can drift from `package.json` with no test.

**Deltas**

| | |
| --- | --- |
| Keep | Iteration 2's error shape (`-32083` / `TX_UNPARSEABLE`, `-32084` separate, legacy chainId not enforced). Demo transcript contract. Human path Layer 2 off, Agent path Layer 2 on only after placeholders are replaced. |
| Kill | Nothing further in the product surface. Do not add a checkout, a payee, or a second error code. |
| Change | Troubleshooting states that a disabled file can pass `policy:check` and still fail start once env enables it. The viem sample sets `retryCount: 0` and comments that `-32084` and `TX_UNPARSEABLE` are non-retryable. `tests/version.test.ts` pins `PACKAGE_VERSION` to `package.json` and to `0.5.0`. The halt sample does not grow a second executed mismatch case; `demo:dual-layer` already locks `-32084`. |

## Code review 1 — security / ops

Reviewed the proxy send order, `loadSpendPolicy`, health, notify, decision log, and compose publish line.

| Finding | Disposition |
| --- | --- |
| Enabled `allowAnyDestination` (file, overlay, or `L2SG_POLICY_ALLOW_ANY`) left the destination fence open after a clean-looking file. | **Fixed.** `loadSpendPolicy` throws before listen. Tests cover the file, env-enable of a disabled file, `L2SG_POLICY_ALLOW_ANY`, and a chain overlay. |
| Policy on plus a raw tx that does not parse fell through to Layer 1 and could fail-open. | **Fixed.** Handler and `check()` return `-32083` `TX_UNPARSEABLE` and do not simulate or forward. Golden test uses `0xdeadbeef`. |
| Non-address `L2SG_POLICY_ALLOWLIST` tokens were stored as keys. | **Fixed.** Start throws. |
| `/health` and the listen log counted only the base destination map, so overlay-only addresses looked like an empty list. `allowAnyDestination` ignored overlays. | **Fixed.** Count is the distinct union of base and overlay addresses (not the effective set for one chain, and not the address list). `allowAnyDestination` is the OR of base and overlays. |
| Notify URL is an operator-configured webhook with a 2s timeout. A multi-tenant SSRF control does not match this single-operator proxy, and an https-only rule would break the localhost example. | **Deferred.** Documented as operator-owned. No URL product added. |
| `appendFileSync` decision log is not rotated or atomic across processes. | **Deferred.** `docs/DECISION_LOG.md` already says the operator owns retention. No log sink. |
| Legacy transactions omit `chainId`, so they are not compared to `x-l2sg-chain`. | **Deferred.** Enforcing it would reject valid pre-EIP-155 testnet txs and needs its own fixture. Troubleshooting and residual bypasses state the gap. |
| The container process binds `0.0.0.0` so Docker's proxy can reach it. Compose publishes `127.0.0.1:8545:8545` and logs a wildcard warning. | **Kept.** Forbidding `0.0.0.0` inside the container breaks published port proxy. The warning stays. |

## Code review 2 — OSS maintainer / DX

Reviewed scripts, CI, changelog, examples, and the eval corpus generator.

| Finding | Disposition |
| --- | --- |
| `policy:check` treated `allowAnyDestination` as a sanity failure even when start would accept a disabled file. | **Fixed.** Sanity error only when the document's `enabled` is true. Strict check of an enabled file still fails. |
| `src/version.ts` could drift from `package.json`. | **Fixed.** `tests/version.test.ts`. |
| Changelog omitted the fence refusal and `TX_UNPARSEABLE`. | **Fixed.** 0.5.0 behavior notes. |
| Eval corpus `chainKey` rotated through OP and Base while `chainId` was 421614. | **Fixed.** Generator pins `arb-sepolia` / 421614. `evaluation/README.md` says the committed raw is Arb-signed and lists `policy_denied` in the class table. Per-chain signed fixtures are **deferred**; one raw cannot honestly cover three chains. |
| `examples/agent-viem-halt.mjs` imports `dist/` and failed with a module-not-found if build had not run. | **Fixed.** The sample checks for `dist/proxy/server.js` and exits with `npm run build` before importing. CI still builds first. |
| `policy:check` cannot see `L2SG_POLICY_*` overrides. | **Documented, not "fixed" in the checker.** Start is the merged-config authority. Teaching the checker to reimplement env merge would fork the loader. Troubleshooting says to start after the file check. |

## Code review 3 — buyer / agent integrator

Reviewed error parity between HTTP and `check()`, the halt sample, and the decision table.

| Finding | Disposition |
| --- | --- |
| `check()` did not return `TX_UNPARSEABLE` when the handler did, so a dry-run could disagree with the proxy. | **Fixed.** Same decision, layer 2, and `policyCode` before the chain check. |
| `chain_mismatch` from `check()` omitted `policyCode`, while HTTP `error.data` has `policyCode: null`. | **Fixed.** `check()` sets `policyCode: null` on that path. Abort results still omit the field so existing shape tests stay stable. |
| viem transport default retries can replay `-32083`. | **Fixed** in the sample: `retryCount: 0`. |
| Halt sample never sends a mismatched chainId, so `-32084` was easy to miss. | **Deferred as an executed case.** The decision table and the sample comment call it non-retryable. `npm run demo:dual-layer` already diffs a `-32084` line against `docs/fixtures/dual-layer.expected.txt`. A second live case in the halt sample would duplicate that contract. |
| Support boundary: Issues for offline repros, Discussions for how-to, no SLA, no payee in the repo. | **Kept.** No checkout and no invented contact channel. |

## Operator pack (after 0.5.0)

Scope: docs, templates, the repro-triage workflow, and CI on Node 24. No new proxy behavior, no payee, no npm publish. Version stays 0.5.0.

### Design iteration 1 — security / ops

**Attack.** A stack of "you own this" pages can still tell an operator to bind `0.0.0.0`, treat policy ON as safety, or invent a payee. An auto-close bot that treats every Issue as a bug will close vulnerability reports and how-to threads.

| | |
| --- | --- |
| Keep | Human path stays Layer 2 off. Agent path stays placeholders-must-fail. Localhost is the bind. SUPPORT.md stays the payee boundary. |
| Kill | Any template that includes a real key, a payment rail, or "policy ON means safe." Closing issues that are not bugs. |
| Change | Operator pages repeat the honesty lines. The triage workflow only labels `bug` / `[bug]`, skips `CVE-` / `GHSA-` / security advisories, and honors `keep-open`. The systemd sample sets `L2SG_HOST=127.0.0.1`. |

### Design iteration 2 — maintainer / DX, attacking iteration 1

**Attack.** Fifteen essays will drift from the decision table. Claiming Node 24 in prose while CI stays on 20 and 22 is a lie. Rewriting the bug template into a form breaks paste. An untested classifier in YAML will false-positive on the empty template.

| | |
| --- | --- |
| Keep | Markdown bug template. Decision table stays the code-semantics source. `policy:check` and `demo:dual-layer` stay offline. |
| Kill | A second copy of the decision table. A Node 24 claim without a matrix entry. |
| Change | `docs/OPERATOR.md` is an index. Short pages link the existing docs. CI matrix adds `"24"`. `scripts/repro-triage.mjs` is what the workflow runs, and vitest covers it. Empty template fields must not steal the next line (`[ \t]` instead of `\s`). |

### Design iteration 3 — buyer / integrator, attacking iteration 2

**Attack.** A canary that reverts looks like a failed policy edit. A kill switch inside Guard does not stop an agent that still has a direct RPC. "Staging vs prod" will be read as mainnet. A bench millisecond quoted as production RTT is a lie. A weekly job that closes `needs-repro` even after the body was fixed punishes the person who replied in the wrong box. Recommending one shared Guard hides blast radius.

| | |
| --- | --- |
| Keep | Both environments are Sepolia. No mainnet promotion. Latency page points at `npm run bench` and forbids treating mock milliseconds as RTT. |
| Kill | A kill switch that is "restart the proxy." |
| Change | Change protocol lists `-32080` as simulation, not a bad policy edit. Rollback stops the agent first. Topology says one process per funded wallet is the smaller blast radius. The stale pass clears the label when the repro is now present. |

### Code review 1 — security / ops

| Finding | Disposition |
| --- | --- |
| `\s` after `Node version:` / `OS:` / the pin colon treated the next bullet as filled, so an empty bug template looked complete. | **Fixed.** Same-line `[ \t]` only. Test uses the checked-in template. |
| The template sentence "Vulnerability reports do not belong here" matched `vulnerabilit`, so every bug filed on the template was skipped and never labeled. | **Fixed.** That sentence is stripped before the word match. `CVE-`, `GHSA-`, "security advisory", and a `security` label still skip. |
| `restart: unless-stopped` plus a poison policy (exit 1) restart-loops. `StartLimitBurst` in `[Service]` is ignored on current systemd. | **Fixed.** Compose comment says `docker compose stop`. Systemd limits sit in `[Unit]` (3 failures / 60s). Topology says so. |
| Comment-then-label, and `removeLabel` 404, so a retry or a missing label does not fail the job closed. | **Fixed** in the workflow. A retry that comments twice if the label never stuck is **deferred** — the second comment is the same text. |

### Code review 2 — maintainer / DX

| Finding | Disposition |
| --- | --- |
| Classifier imported for tests could also run `main` and `process.exit`. | **Fixed.** Direct-run check uses `import.meta.url`. A CLI spawn test covers `classify`. |
| Operator links and the npm `files` list can drift. | **Fixed.** `tests/operator-docs.test.ts` checks the pages exist, are listed in `package.json` `files`, resolve relative links, and do not contain a payee or a safe-agent claim. |
| Fallback RPC is not "one extra call on every send." It runs only after primary `eth_call` is uncertain. | **Fixed** in `docs/LATENCY.md` to match `src/sim/simulator.ts`. |
| Node 24 is on the matrix. | **Checked.** The suite passed under Node v24.10.0 (140 tests) and under Node 22. The CI job is the same offline steps. No Sepolia. |

### Code review 3 — buyer / integrator

| Finding | Disposition |
| --- | --- |
| Canary step omitted `-32080`, so a reverting tool call looked like the policy edit failed. | **Fixed** in `docs/CHANGE_PROTOCOL.md`. |
| Halt sample's in-memory `0x1111…` could be read as a loaded policy file. | **Fixed** with a comment: that map is not a file; poison JSON still fails `policy:check`. |
| Kill switch, staging, and shared-Guard wording match iteration 3. | **Kept.** |
| No payee, no `@latest`, no mainnet SLA in the new pages. | **Kept.** `npm publish` was not run. Version stays 0.5.0. |

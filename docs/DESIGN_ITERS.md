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

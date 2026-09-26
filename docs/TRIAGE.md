# First-line triage

Walk this tree before you open an Issue. Stop at the first step that explains the symptom. Detail for that branch is [TROUBLESHOOTING.md](./TROUBLESHOOTING.md). Decision semantics are [AGENT_DECISION_TABLE.md](./AGENT_DECISION_TABLE.md).

1. **Is every broadcast client pointed at Guard?** If any script, cron, or human wallet still uses the upstream RPC directly, Guard is not in that path. [templates/transport-inventory.md](./templates/transport-inventory.md).
2. **`GET /health`.** `policy.enabled` must match the path you recorded. Agent path expects `true`. `guardMode` must match the risk note. `destinationCount` is a count, not the list. If the process is down, that is supervision ([ROLLBACK.md](./ROLLBACK.md)), not a policy bug.
3. **What code came back?**
   - `-32083` `policy_denied` — halt. Read `policyCode`. `TX_UNPARSEABLE` is a client bug, not an allowlist edit. Any other code is the fence working. Change policy only through [CHANGE_PROTOCOL.md](./CHANGE_PROTOCOL.md).
   - `-32080` `abort` — do not rebroadcast that raw. Simulation said it reverts.
   - `-32084` `chain_mismatch` — header, wallet chain, and signed `chainId` disagree. Do not retry the same raw on the other chain.
   - `-32081` `unsigned_refused` — you asked Guard to sign. It will not.
   - `-32082` — uncertain sim and `GUARD_MODE=strict`. Either accept the brick or change mode and the upstream. Same raw will abort again while sim stays uncertain.
   - HTTP success with `l2sg.decision: fail_open` — uncertain sim was forwarded because mode is `open`. That is the risk you accepted, not a policy allow.
   - Nonce, underpriced, replacement, intrinsic gas — the signing client and the upstream. Not a Guard bug.
4. **Upstream.** `fail_open` or `confidence: unknown` / `eth_call` usually means `eth_simulateV1` is missing or flaky. Set your fallback RPC if you have one. Public testnet weather is yours.
5. **Process will not start.** Policy enabled with a missing file, invalid JSON, placeholders, or `allowAnyDestination` refuses start on purpose. Run `policy:check`. A file that passes with `enabled: false` can still fail start when `L2SG_POLICY_ENABLED=true`.
6. **`GUARD_MODE` vs `L2SG_FAIL_OPEN`.** `GUARD_MODE` wins. The legacy alias applies only when `GUARD_MODE` is unset, and it stays through 0.6.0. It never fail-opens `-32083`.

If the tree does not explain it, open an Issue with the repro in the bug template. How-to goes to Discussions. Vulnerability reports go to a private advisory ([SECURITY.md](../SECURITY.md)), not a public Issue.

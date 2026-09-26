# Tool ↔ allowlist change protocol

Most production breaks are a new tool against an old policy. There is no hot reload. Policy is read at process start.

Do these in order. Skip none of them on the Agent path.

1. **Edit the policy file you own.** Add the destination and a native cap with a one-line reason (see [templates/allowlist-inventory.md](./templates/allowlist-inventory.md)). If the tool is a router, multicall, Permit2, or forwarder, fill [templates/bypass-map.md](./templates/bypass-map.md) first and accept the residual or do not allowlist it.
2. **`npm run policy:check -- ./policy.json`.** Exit 0 and the line `policy:check OK`. This reads the file only. It does not see `L2SG_POLICY_*` env overrides. Start does.
3. **Restart Guard** on the staging process ([ENVIRONMENTS.md](./ENVIRONMENTS.md)). Confirm `GET /health` shows `policy.enabled: true` and a destination count that moved the way you expect. The count is not the address list.
4. **Canary.** One signed raw transaction from that tool, through Guard, from the staging burner. Expect a forward you intended, a `-32083` you understand, or a `-32080` when the calldata reverts. A revert abort is simulation, not a failed policy edit. Do not retry a deny or the same reverting raw. Optional dry-run before the canary: `check(rawTx, chain)` from `l2-send-guard/agent` ([AGENTS.md](./AGENTS.md)).
5. **Only then** enable the tool in the funded agent's config. Update the system prompt and the tool schema in the same change. A prompt that says the model may send anywhere, while Layer 2 is tight, produces a `-32083` loop that looks like a Guard bug.

## Prompt alignment

The allowlist, the tool schema, and the system prompt name the same destinations. If they disagree, fix the prompt or the policy before you restart the funded agent. Do not "fix" a deny by setting `allowAnyDestination` or by turning Layer 2 off. Start refuses an enabled policy with `allowAnyDestination`.

## Review cadence

Re-read [RESIDUAL_BYPASSES.md](./RESIDUAL_BYPASSES.md) against the current tool list when you upgrade Guard and at least twice a year. Remove routers that landed in the allowlist without a bypass-map row.

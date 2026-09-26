# Health alerts (your monitor)

Point the check at `GET /health` on the Guard you run. Do not send the allowlist, RPC URLs, or keys to the alert.

Page when:

- The process does not answer `/health`.
- You are on the Agent path and `policy.enabled` is `false`.
- `guardMode` is not the value in [risk-acceptance.md](./risk-acceptance.md).
- `version` is not the pin you recorded.

Optional, from your log sink ([../DECISION_LOG.md](../DECISION_LOG.md)), not from Guard's pager:

- A spike in `fail_open` (uncertain sims forwarding).
- A spike in `policy_denied` (the agent is thrashing on the fence, or a tool and the allowlist drifted).

You choose the threshold and the retention. Guard does not ship a log sink or an alerting product. `destinationCount` changing after a restart is expected when you followed [../CHANGE_PROTOCOL.md](../CHANGE_PROTOCOL.md). It changing with no policy edit is a drift signal.

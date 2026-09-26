# Operator pack

Templates and runbooks for teams running L2 Send Guard. Guard ships the proxy, the offline demo, and these blanks. You fill the blanks. Guard does not operate your host, your keys, your RPC account, your allowlist, or your treasury.

**Policy ON is not a safe agent.** Testnet only (`arb-sepolia`, `op-sepolia`, `base-sepolia`). No mainnet SLA.

| Step | Page |
| --- | --- |
| Before you copy `.env` | [PRE_INSTALL.md](./PRE_INSTALL.md) |
| Record the open/strict choice | [templates/risk-acceptance.md](./templates/risk-acceptance.md) |
| Draft destinations and caps | [templates/allowlist-inventory.md](./templates/allowlist-inventory.md) |
| Map your tools to residual bypasses | [templates/bypass-map.md](./templates/bypass-map.md) |
| Name owners and on-call | [templates/raci-and-oncall.md](./templates/raci-and-oncall.md) |
| Inventory every broadcast client | [templates/transport-inventory.md](./templates/transport-inventory.md) |
| Add a tool without draining the burner | [CHANGE_PROTOCOL.md](./CHANGE_PROTOCOL.md) |
| First page during an incident | [TRIAGE.md](./TRIAGE.md) |
| Label a loss before you call it a Guard bug | [INCIDENTS.md](./INCIDENTS.md) |
| Bump the pin | [UPGRADE.md](./UPGRADE.md) |
| Staging burner vs funded burner | [ENVIRONMENTS.md](./ENVIRONMENTS.md) |
| Where the process sits, and one Guard or many | [TOPOLOGY.md](./TOPOLOGY.md) |
| Timeouts | [LATENCY.md](./LATENCY.md) |
| Roll back the pin and stop the agent | [ROLLBACK.md](./ROLLBACK.md) |
| What to alert on | [templates/health-alerts.md](./templates/health-alerts.md) |
| Who tops up the burner | [templates/funding.md](./templates/funding.md) |
| Free issue vs paid SKU, chosen before the outage | [templates/escalation.md](./templates/escalation.md) |
| Process file (you install it) | [templates/l2-send-guard.service](./templates/l2-send-guard.service) |

Product docs these pages do not replace: [AGENT_DECISION_TABLE.md](./AGENT_DECISION_TABLE.md), [TROUBLESHOOTING.md](./TROUBLESHOOTING.md), [RESIDUAL_BYPASSES.md](./RESIDUAL_BYPASSES.md), [DECISION_LOG.md](./DECISION_LOG.md), [BUYER_ACCEPTANCE.md](./BUYER_ACCEPTANCE.md), [SUPPORT.md](../SUPPORT.md).

## Not provided

Do not open an Issue expecting Guard to become any of these:

- Key custody, MPC, KMS, or session keys
- A mainnet SLA, fee-market product, or MEV protection
- Safe, Zodiac, ERC-7579, or approval unwinding
- Hosted Guard or a managed RPC
- Treasury management, faucet reliability, or gas sponsorship
- An authenticated multi-tenant proxy for the public internet
- A guarantee that approve / Permit2 / multicall / forwarders cannot move value
- Founder on-call
- A legal claim that policy ON means a safe autonomous agent

Paid wire-up, when it exists, still needs a founder invoice. This repository has no payee. See [SUPPORT.md](../SUPPORT.md).

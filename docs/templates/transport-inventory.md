# Transport inventory (your clients)

Every process that can broadcast must use Guard. One direct RPC client is a silent bypass.

| Client (AgentKit, script, cron, human wallet) | Host | HTTP URL it actually uses | Sends `eth_sendRawTransaction`? | Chain header (`x-l2sg-chain` or numeric id) matches signed `chainId`? | Direct upstream URL still configured? |
| --- | --- | --- | --- | --- | --- |
| | | `http://127.0.0.1:8545` | yes | yes | no |

If "direct upstream URL still configured" is yes, remove it or block it before you fund the agent. Header wiring: [../../src/sdk/README.md](../../src/sdk/README.md). Halt behavior: [../AGENT_DECISION_TABLE.md](../AGENT_DECISION_TABLE.md).

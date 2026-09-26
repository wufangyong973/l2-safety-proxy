# Risk acceptance (your signature)

Fill this before the first send from an agent. One file per environment ([../ENVIRONMENTS.md](../ENVIRONMENTS.md)).

| Field | Value |
| --- | --- |
| Date | |
| Environment name | |
| Install path | Human/ops (Layer 2 off) / Agent MSP (Layer 2 on) |
| `GUARD_MODE` | `open` / `strict` |
| Pin | `l2-send-guard@` |

`open`: uncertain simulations forward. A confused agent can broadcast when sim cannot tell. `strict`: those simulations abort with `-32082`, and a flaky upstream can brick good sends.

Policy denies (`-32083`) do not forward in either mode.

Name and the sentence you accept:

Policy ON is not a safe agent. We have a bypass map for every allowlisted tool, or we are not on the Agent path.

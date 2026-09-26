# Agent decision table

Paste this into the agent repo. The sample that implements the halt and no-rebroadcast rows is [`examples/agent-viem-halt.mjs`](../examples/agent-viem-halt.mjs).

| Code | `error.data.decision` | Retry the same raw? | Halt the loop? | Surface to a human? | Change policy? |
| --- | --- | --- | --- | --- | --- |
| **-32080** | `abort` | **No.** Definite revert. Same calldata will revert again. | No, unless your task cannot proceed without this call | Optional | No. This is simulation, not the allowlist |
| **-32081** | `unsigned_refused` | **No.** Do not switch to `eth_sendTransaction` | Yes, until the client signs externally and sends `eth_sendRawTransaction` | Yes if the stack expected the proxy to sign | No |
| **-32082** | `abort` (`certainty: uncertain`) | Only after you change `GUARD_MODE` or the upstream. Same raw in `strict` will abort again while sim stays uncertain | Your choice. `strict` is doing what you configured | Yes if good sends are bricking | No |
| **-32083** | `policy_denied` | **No. Non-retryable.** Includes `policyCode: TX_UNPARSEABLE` (raw tx did not parse). Same code so a halt on policy deny covers both. | **Yes.** Stop the loop | **Yes.** A human updates the allowlist or rejects the tool. Unparseable bytes are a client bug, not an allowlist edit | Yes, if the destination is intended — follow [CHANGE_PROTOCOL.md](./CHANGE_PROTOCOL.md) (`policy:check`, restart, canary). No policy edit for `TX_UNPARSEABLE` |
| **-32084** | `chain_mismatch` | **No.** | Yes until the header and the signed `chainId` agree | Yes | No |

`fail_open` (HTTP success, `l2sg.decision`) means the sim was uncertain and `GUARD_MODE=open` forwarded. That is not an abort and not a policy deny. If you did not want uncertain forwards, set `GUARD_MODE=strict` and accept `-32082`.

Upstream nonce and fee errors are not in this table. Handle them in the client.

Policy ON does not make the agent safe. Read [RESIDUAL_BYPASSES.md](./RESIDUAL_BYPASSES.md) before adding a router to the allowlist.

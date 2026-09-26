# Loss and incident labels

Use one label before the write-up. These are operator and architecture incidents. They are not "Guard failed to be a Safe."

| Label | What happened | What it is not |
| --- | --- | --- |
| `residual-bypass` | An allowlisted token, router, Permit2, multicall, or forwarder moved value. Thin Layer 2 saw `tx.to` and the native cap. | A missed revert |
| `fail-open-forward` | `GUARD_MODE=open` forwarded an uncertain simulation. | A policy allow |
| `policy-off` | `/health` showed `policy.enabled: false` while you thought the fence was on. | A silent product default change. Off is the Human/ops path. Enabled plus a bad file refuses start. |
| `direct-rpc` | A client broadcast to the upstream and skipped Guard. | A proxy bug |
| `wrong-chain` | A send landed on a chain you did not select, usually because that client did not use Guard or used a legacy tx with no `chainId` (those are not compared). | `-32084`, which is Guard stopping a mismatch |
| `key-compromise` | The signer leaked. Guard never held the key. | Custody failure inside the proxy |
| `allowlist-mistake` | The destination was one you added, including a router you did not mean to trust. | Placeholder poison. Enabled placeholders refuse start. |
| `client-nonce-fee` | Nonce or fee errors from the signer or upstream. | A Guard subsystem |

Collect, and do not collect:

- Include: pin or commit, `guardMode`, `policy.enabled`, `destinationCount`, `policyCode`, a decision-log line (`policy_denied`, `fail_open`, `abort`, `chain_mismatch`).
- Omit: private keys, raw transactions from a funded key, RPC URLs with secrets, the allowlist itself. A redacted diff shape is enough.

Rollback steps: [ROLLBACK.md](./ROLLBACK.md). Escalation choice you already wrote down: [templates/escalation.md](./templates/escalation.md).

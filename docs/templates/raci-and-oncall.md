# Owners and on-call (your org)

Guard's maintainer is not this on-call. Free support has no SLA ([../../SUPPORT.md](../../SUPPORT.md)).

| Duty | Name | Backup |
| --- | --- | --- |
| Policy file (edits, review, `policy:check`) | | |
| Guard process (pin, restart, host) | | |
| Agent halt on `-32083` / no rebroadcast on `-32080` | | |
| Upstream RPC account | | |
| Burner funding | | |

| Page | Who is woken | Who is not |
| --- | --- | --- |
| Guard process down | Process owner | The founder |
| Agent stuck on `policy_denied` | Agent owner, then policy owner if the destination is intended | Not an upstream incident |
| Upstream RPC errors, nonce, fees | RPC owner and the signing client | Not a Layer 2 bug |
| Suspected vulnerability | Private advisory ([../../SECURITY.md](../../SECURITY.md)) | Not a public Issue |

Topology choice (see [../TOPOLOGY.md](../TOPOLOGY.md)): one Guard per funded wallet / one shared Guard.

Write the choice and the reason:

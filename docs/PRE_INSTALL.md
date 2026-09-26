# Before install

Read this once, out loud if you are about to point a funded burner at the proxy. Then fill [templates/risk-acceptance.md](./templates/risk-acceptance.md).

## Mental model

Guard is a pre-broadcast JSON-RPC proxy. It can abort a definite revert (`-32080`) and, when you turn Layer 2 on, stop a send that misses your allowlist or cap (`-32083`). Signing stays in your wallet, AgentKit signer, KMS, or HSM. Guard is not a wallet, a custodian, a Safe, an RPC cloud, or an indexer.

Simulation is not policy. A revert abort means the transaction would fail on chain. A policy deny means the allowlist or cap said no — the transaction might have succeeded. Policy ON is not a safe agent. Read [RESIDUAL_BYPASSES.md](./RESIDUAL_BYPASSES.md) before the first agent send.

## Role fit

Continue only if every broadcast is a signed `eth_sendRawTransaction` (or Sync) from a signer that is not Guard.

Stop before install if the stack only sends `eth_sendTransaction`, uses an unlocked node account, or expects a Safe / session-key module. Guard answers those with `-32081` or sits outside the architecture. Redesign, or do not install.

## Pick a path before you copy `.env`

| Path | Layer 2 | Layer 1 | When |
| --- | --- | --- | --- |
| Human / ops | Off | `GUARD_MODE=open` (uncertain sims forward) | You want simulation and you accept fail-open |
| Agent MSP | On, after placeholders are replaced | `open` or `strict`, written down | The allowlist is the spend fence |

Do not flip from one path to the other under load without a new risk note. `open` can forward a send when simulation is unsure. `strict` can brick a good send (`-32082`) when the upstream sim is flaky. Neither mode fail-opens a policy deny.

## You provision

- Node on the range in `package.json` `engines` (`>=20`). CI runs 20, 22, and 24.
- git and npm if you are proving the demo from the git tree.
- A host or container that can listen on `127.0.0.1`, or a private network with an ACL if the agent is not on the same host. See [TOPOLOGY.md](./TOPOLOGY.md). Binding `0.0.0.0` on a reachable interface without an ACL turns the proxy into an unauthenticated forwarder onto your upstream RPC.

## Upstream RPC

Public testnet URLs are built in for smoke (`L2SG_RPC_*` overrides them). They are not a durable plan. Write down, in your own secret store, not in this repo:

| Chain | Primary URL owner | Fallback URL (`L2SG_RPC_FALLBACK_<CHAIN>`, sim only) |
| --- | --- | --- |
| arb-sepolia (421614) | | |
| op-sepolia (11155420) | | |
| base-sepolia (84532) | | |

CI does not call these URLs. A flaky public RPC is your upstream, not a Guard bug. See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## Signer, burner, allowlist

Keys never go in Guard config. `L2SG_BURNER_KEY` in `.env.example` is a commented live-smoke hook for your machine. Do not commit it.

The offline demo needs no capital. A live forward needs a burner and testnet ETH you fund. Archive the offline transcript (`npm run demo:dual-layer` matches [fixtures/dual-layer.expected.txt](./fixtures/dual-layer.expected.txt)) before you spend that ETH. See [ENVIRONMENTS.md](./ENVIRONMENTS.md) and [templates/funding.md](./templates/funding.md).

On the Agent path, copy `policy.agent.example.json` to a file you own. Replace `0x1111…` / `0x2222…`. Draft the list in [templates/allowlist-inventory.md](./templates/allowlist-inventory.md) and the tool map in [templates/bypass-map.md](./templates/bypass-map.md). `npm run policy:check -- ./policy.json` must print `policy:check OK`. The example file is poison and must fail a strict check. Process start refuses an enabled policy that still has placeholders or `allowAnyDestination`.

`humanGate.notifyUrl` in the example points at `127.0.0.1:9999`. That is not a pager. If you set a URL, you run the service that receives it.

## Pin

Record `l2-send-guard@0.5.0` (or the commit you actually built) in your lockfile or image digest. Do not float `@latest`. There is no published container digest in this repo. See [UPGRADE.md](./UPGRADE.md).

## Prove, then attach the agent

1. `npm ci && npm test && npm run build && npm run policy:check && npm run demo:dual-layer`
2. Keep that transcript with the commit SHA.
3. `GET /health` — `policy.enabled`, `guardMode`, and `destinationCount` match the path you chose. Alert plan: [templates/health-alerts.md](./templates/health-alerts.md).
4. `node examples/agent-viem-halt.mjs` after the build. Then implement the same halt in your process ([AGENT_DECISION_TABLE.md](./AGENT_DECISION_TABLE.md)). The sample is not your agent.
5. Confirm `-32081` and `-32084` against the header your wallet will send. The demo already does this offline; your client still has to send that header.

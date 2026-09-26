# Topology

## Default

Agent process → Guard on `127.0.0.1:8545` → your upstream RPC.

That is the supported shape. The listen default is `127.0.0.1`. The process warns if it binds `0.0.0.0`, `::`, or `::0`.

Docker publishes `127.0.0.1:8545:8545`. The process inside the container binds `0.0.0.0` so Docker's port proxy can reach it, and it logs the wildcard warning. Do not change the publish line to `8545:8545`.

If the agent runs on another host or pod, put Guard on a private network or behind an ACL. Do not expose an unauthenticated proxy to the public internet. This product does not add multi-tenant authentication.

## One Guard or many

Write the choice on [templates/raci-and-oncall.md](./templates/raci-and-oncall.md).

| Choice | Blast radius |
| --- | --- |
| **One Guard process per funded wallet** | A bad policy or a bad pin hits that wallet. This is the smaller radius. |
| **One shared Guard, one policy file, several agents** | Every agent shares the allowlist, the caps, the upstream credentials, and a misconfig. Use this only when you mean that shared fence. |

A second policy file requires a second process. There is no per-request policy switch.

Supervision is yours: `restart: unless-stopped` is set on the compose sample, or install [templates/l2-send-guard.service](./templates/l2-send-guard.service) and change the paths. A policy refusal exits 1. Compose will keep restarting that exit until you `docker compose stop`. The systemd unit stops after three failures in a minute. Liveness is `GET /health`.

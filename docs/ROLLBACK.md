# Rollback and kill switch

Keep two artifacts next to the running process:

- The last pin you already proved (`l2-send-guard@x.y.z` or a git commit) 
- The last policy file that passed `policy:check` and a canary

Rollback is remount that policy file and start that pin. Then check `/health`. There is no hot reload, so a restart is required. Restarting Guard does not roll back a transaction that already forwarded.

## Kill switch

Stop the **agent** process, or remove its transport, before you debug the proxy. A Guard restart does not stop a loop that still has a direct RPC URL or a retrying client. viem retries by default; the halt sample sets `retryCount: 0` for that reason.

Order during an incident:

1. Stop the agent (this is the kill switch).
2. Leave Guard up long enough to read `/health` and the decision log, or stop it too if it is bound more widely than you accept.
3. Label the incident ([INCIDENTS.md](./INCIDENTS.md)).
4. Restore the known-good pin and policy, `policy:check`, start, health check, then start the agent only if the label says it is safe to continue.

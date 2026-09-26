# Upgrade discipline

Do this on staging ([ENVIRONMENTS.md](./ENVIRONMENTS.md)) before you change the pin the funded agent uses.

1. Read [CHANGELOG.md](../CHANGELOG.md) for that version. Watch env renames, error `data` fields, policy schema, and the chain list. `GUARD_MODE` is canonical. `L2SG_FAIL_OPEN` applies only when `GUARD_MODE` is unset and stays at least through **0.6.0**.
2. Check out the commit you intend to run. `npm ci && npm test && npm run build && npm run policy:check && npm run policy:check -- ./policy.json && npm run demo:dual-layer`.
3. `GET /health` on the staging process. `policy.enabled` and `guardMode` still match the risk note.
4. Record the pin in your lockfile (`l2-send-guard@x.y.z`) or the image digest you built. Do not use `@latest`. This repo does not publish a tagged binary or a container digest. The Dockerfile base is Node 20. CI tests Node 20, 22, and 24.
5. Restart staging, canary one send, then promote the same pin and the same policy file to the funded process.

Dependency bumps inside your app (viem, the agent framework) are your review. Guard does not float them for you.

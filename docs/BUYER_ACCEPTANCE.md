# Buyer acceptance (self-serve, before any paid wire-up)

Bring these three artifacts. Without them, a wire-up request is still a how-to and belongs in Discussions.

1. **Offline transcript.** Output of `npm test`, `npm run build`, and `npm run demo:dual-layer` from the git checkout published as `l2-send-guard@0.5.0` (do not pin `@latest`). The demo must match [`docs/fixtures/dual-layer.expected.txt`](./fixtures/dual-layer.expected.txt). Include Node version and OS. Those commands run from the repository; the npm package is the runtime.
2. **Health truth.** `GET /health` JSON with `policy.enabled` equal to the path you chose (Human/ops off, Agent MSP on), `guardMode`, and `destinationCount`. Do not paste the allowlist or RPC URLs.
3. **Allowlist diff.** `git diff` (or equivalent) from `policy.agent.example.json` to your file showing placeholder addresses replaced, plus `npm run policy:check -- ./policy.json` printing `policy:check OK`.

Also state which install path you chose and whether `GUARD_MODE` is `open` or `strict`.

Paid scope starts only after a founder invoice with a real payee. This repo does not list one. See [SUPPORT.md](../SUPPORT.md).

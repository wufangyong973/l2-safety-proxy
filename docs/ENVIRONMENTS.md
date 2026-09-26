# Staging and funded testnet

Both environments are **Sepolia** (arb, op, or base). This release has no mainnet promotion path and no mainnet SLA.

| | Staging | Funded testnet |
| --- | --- | --- |
| Purpose | Policy edits, new tools, pin bumps | The agent whose balance you care about |
| Policy file | A separate file | The reviewed file, mounted read-only if you use Docker |
| Burner | A different key from the funded one | Its own key, outside Guard |
| Capital | Empty or a faucet dust amount you can lose | Whatever you chose in [templates/funding.md](./templates/funding.md) |
| Promotion | Copy the policy diff and the pin across only after `policy:check`, restart, and a canary | Do not experiment here |

The offline demo (`npm run demo:dual-layer`) is neither environment. It uses no key and no public RPC. Keep its transcript as the baseline for "is Guard broken, or is our agent?"

Live graduation, when you want it, is yours: one known-revert abort (`-32080`) and one successful forward, with the explorer receipt stored next to the offline transcript. CI will not do that for you.

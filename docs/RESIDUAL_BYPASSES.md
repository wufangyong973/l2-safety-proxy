# Residual bypasses (thin Layer 2)

**Policy ON is not a safe agent.** Layer 2 is an allowlist plus native-value caps on the signed transaction. It does not unwind calldata, and it does not custody keys.

These paths can move value or authority even when the allowlist is tight. They are **in scope for honesty** and **out of scope for this proxy**. Map them against *your* tools before you enable an agent.

| Pattern | What the proxy sees | What can still happen |
| --- | --- | --- |
| `approve` / `increaseAllowance` | `tx.to` is the token, which may be allowlisted | A spender later pulls tokens. Guard does not denylist selectors. |
| `setApprovalForAll` | `tx.to` is the NFT or token contract | An operator can move every token ID later. |
| Permit / **Permit2** | Often a signature plus a later `permit` or `transferFrom` | The value-moving call may not be the transaction you just allowlisted. |
| **Multicall** / routers / aggregators | `tx.to` is the router | Inner targets sit in calldata. Thin L2 does not unwind them. Allowlisting a router allowlists every route it will take. |
| Eth to a forwarder | Native `to` is on the allowlist and under the cap | The contract can forward value onward. The cap applies only to this transaction's `value`. |

ERC-20 `transfer` / `transferFrom` recipient checks (when `erc20RecipientCheck` is true) look at the recipient, not at allowances, permits, or inner calls.

## What to do

1. Do not allowlist a router, multicall, or forwarder unless you accept that it can reach anything it can call.
2. Keep `allowAnyDestination` false and `allowContractCreation` false on the Agent path. Process start refuses an enabled policy that sets `allowAnyDestination`. Legacy transactions with no `chainId` are not compared to the selected chain.
3. Treat `-32083` as a halt, not as a bug to retry. See [AGENT_DECISION_TABLE.md](./AGENT_DECISION_TABLE.md).
4. Re-read this page when the agent gains a tool, and map that tool on [templates/bypass-map.md](./templates/bypass-map.md) using [CHANGE_PROTOCOL.md](./CHANGE_PROTOCOL.md). Your inventory is yours; this page is the generic list.

Out of product: Safe / Zodiac / ERC-7579, approval unwinding, calldata-deep policy, hosted policy SaaS. Those are different systems. See [SUPPORT.md](../SUPPORT.md).

# Residual-bypass map (your tools)

Generic list: [../RESIDUAL_BYPASSES.md](../RESIDUAL_BYPASSES.md). This page is the map for the tools you actually run. Fill it before you allowlist a contract, and again on the cadence in [../CHANGE_PROTOCOL.md](../CHANGE_PROTOCOL.md).

| Tool | Pattern (`approve`, `setApprovalForAll`, Permit2, multicall/router, eth forwarder, or none) | Decision (allow / deny / human gate) | Reviewer | Date |
| --- | --- | --- | --- | --- |
| | | | | |

Allowing a router means you accept every inner target it can call. Thin Layer 2 will not unwind that calldata. Policy ON is not a safe agent.

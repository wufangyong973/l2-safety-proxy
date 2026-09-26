# Latency budget

Every guarded send pays for simulation before broadcast. Guard prefers `eth_simulateV1` on the primary RPC, then `eth_call` when V1 is unavailable. Fallback runs only when that primary `eth_call` is uncertain and `L2SG_RPC_FALLBACK_<CHAIN>` is set: V1 on the fallback URL if it still supports V1, then `eth_call` there. The broadcast still uses the primary RPC.

Set the agent timeout above that cost. A timeout that is only large enough for a bare `eth_sendRawTransaction` will look like Guard is hung.

Measure the relative overhead locally with `npm run bench`. The bench uses a mock upstream. **Do not treat its milliseconds as production RTT.** Public testnet RTT usually dominates. Methodology and the live-optional notes are in [BENCH.md](../BENCH.md).

A definite revert abort (`-32080`) and a policy deny (`-32083`) do not forward the send. They are often faster than broadcasting a reverting transaction and waiting for a receipt. They are still not a reason to retry.

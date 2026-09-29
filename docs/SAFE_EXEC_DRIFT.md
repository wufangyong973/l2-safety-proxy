# Safe `execTransaction` — proposal→broadcast drift (Gate-2)

## What this is

On Safe **1.3.0 / 1.4.1**, `execTransaction` can return **outer success** while the inner call failed when `safeTxGas` or `gasPrice` is non-zero. The Safe emits `ExecutionFailure(txHash, payment)` and still pays gas. A proxy that only watches definite RPC reverts would **forward** that failure.

L2 Send Guard extends Layer 1 simulation for **Safe-shaped** `execTransaction` calldata (`0x6a761202`):

1. **Hard abort** when simulated logs (or `debug_traceCall` + `callTracer`) show `ExecutionFailure` — even if the outer call status is success (`-32080`).
2. For `execTransaction`-shaped sends, **outer success without log/trace inspection is uncertain** (fail-open / strict), never definite forward.
3. Keep the existing definite-revert path (including **GS013** when both gas params are zero, and bubbled inner `Error(string)` when the node returns it).

## What this is not

| Claim | Reality |
| --- | --- |
| Protocol Kit replacement | **No.** Protocol Kit `estimateSafeTxGas` / `simulateAndRevert` already covers **sign-time** simulation. Guard sits on **proposal → broadcast** state drift (balances, allowances, nonces, oracles) in the last-signer / executor window. |
| Safe / Zodiac / ERC-7579 product | **No.** Selector heuristic + require `ExecutionFailure` (or revert) for abort. Not a policy engine, not custody, not module roles. |
| `execTransactionFromModule` coverage | **Out of P0.** Residual only — see [RESIDUAL_BYPASSES.md](./RESIDUAL_BYPASSES.md). |
| Mainnet SLA / on-chain certainty | **No.** Simulation remains advisory; read `certainty` / `confidence` on every decision. |

## Decode vs abort (1.3 / 1.4)

On 1.3.0 / 1.4.1, `ExecutionFailure` carries **only** `txHash` + `payment`. Abort does **not** wait for inner revert bytes. Optional `debug_traceCall` + `callTracer` may enrich buyer-facing copy; missing trace never blocks the abort when logs already prove `ExecutionFailure`.

## Fixture / demo bar

Sealed offline demos stay **fixture-only** (mock upstream, no live keys, no checkout URLs). See `npm run demo:safe-exec` and `tests/safe.execFailure.test.ts`.

## References

- Safe Discussion [#1437](https://github.com/safe-global/safe-core-sdk/discussions/1437)
- safe-smart-account v1.4.1 `execTransaction` / `GS013` / `ExecutionFailure`
- Issue [#17](https://github.com/yellowgram/l2-safety-proxy/issues/17)

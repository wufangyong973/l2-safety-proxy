# Support boundary

**L2 Send Guard stays MIT and free to run.** Simulation, fail-open semantics, and optional thin Layer 2 policy are not paywalled.

Free support is **best-effort**. There is **no SLA** and no on-call.

## Where to write

| Channel | For |
| --- | --- |
| **GitHub Issues** | Bugs with an offline repro: package pin or commit, Node version, OS, `npm test` and `npm run demo:dual-layer` output (or why the offline demo failed), and redacted env **booleans** only. Template: `.github/ISSUE_TEMPLATE/bug_report.md`. |
| **GitHub Discussions** | How-to: install path, policy shape, chain header, reading an error code. |

Bug issues that omit the repro are labeled `needs-repro` by [`.github/workflows/repro-triage.yml`](./.github/workflows/repro-triage.yml). The workflow comments once. If the label is still present after 14 days with no issue update, it closes the issue. It only considers issues labeled `bug` or titled `[bug]`. It does not close vulnerability reports, bot issues, or how-to discussions. Add `keep-open` to pause the close. A later edit that fills the repro removes the label. Maintainers can still close by hand.

Nonce, underpriced, and faucet failures are not Issues. See [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md).

## Paid work is invoice-real, and this repo is not a checkout

Fixed-scope help (AgentKit / viem wire-up, a review of your policy file, retainer triage) is not for sale from this file.

There is **no payee, payment link, or contact email** in this repository. Do not send funds to any address you infer from the code, the docs, or a commit.

A paid engagement exists only after all of the following:

1. You open a GitHub issue or discussion titled `support: <SKU>` and attach the artifacts in [docs/BUYER_ACCEPTANCE.md](./docs/BUYER_ACCEPTANCE.md).
2. Scope is confirmed in writing (multi-day work can start from [docs/PILOT_SOW.md](./docs/PILOT_SOW.md)).
3. The founder sends an invoice that includes **payee details the founder supplies on that invoice**.

Work starts after that invoice is paid, or after a written net-terms agreement. Until the founder attaches a real payee to an invoice, **there is nothing to pay**.

This repo does not configure Wise, Polar, USDT, or any other rail.

## SKUs (scope description, not a payment page)

| SKU | What you get | List price (USD) | Typical calendar |
| --- | --- | --- | --- |
| **AgentKit wire-up** | Point an external signer at Guard; confirm the offline dual-layer demo; tune `policy.agent` to your allowlist; a short handoff note | 1200 | 3 days |
| **Policy pack review** | Review of your Layer 2 JSON (allowlist, native caps, notify URL) and a written residual-bypass note. Not a Safe redesign | 600 | 1–2 days |
| **Priority triage retainer** | A queue for Guard questions you can repro offline | 800 / month | Monthly |

Prices are a public list so scope is not negotiated from scratch. They are not an offer you can accept by sending money. Settlement currency is whatever the founder writes on the invoice, after scope is confirmed.

## Out of scope (auto-reply)

Use this text when a request is outside the free project and outside the SKUs:

> This request is out of scope for L2 Send Guard free support and for the published SKUs: key custody, new chains, Safe / Zodiac / ERC-7579 clones, hosted SaaS, grant writing, and Soft-WTP or cold outreach. Thin Layer 2 is an allowlist plus native caps on arb/op/base Sepolia only. Policy ON is not a safe agent. See SUPPORT.md and docs/RESIDUAL_BYPASSES.md.

## What stays free

Run the proxy, Layer 1 simulation, Layer 2 policy (self-hosted), the docs, and the offline demos. Maintainer replies on Issues and Discussions when there is capacity. No response-time commitment.

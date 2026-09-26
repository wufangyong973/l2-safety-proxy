# Allowlist inventory (your file)

Copy this into the repo that owns the policy. One row per destination. Caps are in wei, with a reason (max single-task spend), not a copy of the example `50000000000000000` unless that number is actually your cap.

`0x1111…` and `0x2222…` are poison. `npm run policy:check -- ./policy.json` must print `policy:check OK` before start.

| Chain | Address | Tool name | Why this destination | Max native wei | Why that cap | Router / multicall / forwarder? |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | no |

`allowAnyDestination` stays false. `allowContractCreation` stays false on the Agent path. Contract creation and open destinations are not a spend fence.

Policy JSON lives in your git, reviewed, and mounted read-only when you use Docker (`docker-compose.yml` shows the mount). Guard does not choose the addresses.

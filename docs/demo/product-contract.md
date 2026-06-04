# Demo Product Contract

## Product Truth

Predict Club members must see a clear readiness checklist before self-signing a
DeepBook Predict trade.

## Required Checklist Items

- Wallet connected.
- Correct network selected.
- Round confirmed by leader.
- Oracle is fresh enough for the selected expiry.
- Expiry is not too close.
- Member has enough DUSDC or a funding route is selected.
- Max loss is visible before signing.

## Blocking Rules

- Stale oracle blocks execution.
- Unsafe expiry blocks execution.
- Missing DUSDC routes the member to funding.
- `no-trade` indicator consensus blocks the primary trade action.

## Non-Goals

- No custody of member private keys.
- No automated vault execution.
- No mainnet package assumption.

## Related Real Docs

- `docs/product/predict-club.md`
- `docs/product/predict-club-architecture.md`
- `docs/product/predict-club-funding.md`

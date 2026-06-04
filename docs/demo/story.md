# Demo Story: Guided Trade Checklist

## Status

- State: planned
- Owner: demo
- Last updated: 2026-06-04

## Goal

Members can determine whether a Predict Club round is safe to join before they
self-sign a trade.

## User Value

First-time members avoid signing a Predict trade without understanding oracle,
expiry, DUSDC, and max-loss constraints.

## Scope

- In: checklist model, visible readiness state, blocking messages, funding handoff.
- Out: automated custody, new Move vault, mainnet package deployment.

## Acceptance Criteria

- [ ] The checklist shows wallet, network, oracle, expiry, DUSDC, and max-loss state.
- [ ] Stale oracle and unsafe expiry block the primary trade action.
- [ ] Missing DUSDC sends the member to the funding route instead of execution.
- [ ] The member still signs the final Predict PTB with their own wallet.

## Product Docs

- `docs/demo/product-contract.md`

## Architecture Docs

- `docs/product/predict-club-architecture.md`
- `docs/ARCHITECTURE.md`

## Decisions

- `docs/demo/decision.md`

## Implementation Notes

Keep checklist policy in domain/application code, not in presentation-only UI.

## Validation

- `bun run build`
- Browser smoke on `predict-club.html`
- Manual wallet-flow review
- Stale oracle and unsafe expiry blocking review

## Evidence

Not run. This is a harness demo, not an implementation record.

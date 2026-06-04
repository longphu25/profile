# Demo Feature Intake

## Request

Add a guided trade checklist to Predict Club so members understand whether a
round is safe to join.

## Input Type

Spec slice.

## Lane

High-risk.

## Risk Flags

| Risk flag | Applies? | Notes |
| --- | --- | --- |
| Wallet/signing | yes | Checklist gates a member's self-signed trade path. |
| Authorization | no | No new permissions in the demo scope. |
| Data model | yes | Checklist state may be persisted with a round. |
| External systems | yes | Depends on DeepBook Predict, oracle freshness, and DUSDC readiness. |
| Public contract | yes | Changes visible Predict Club workflow. |
| Existing behavior | yes | Affects round confirmation and execution flow. |
| Weak proof | yes | Requires manual wallet-flow review if implemented. |
| Multi-domain | yes | Product, DeepBook Predict, wallet, and funding state interact. |

## Required Docs

- Product: `docs/demo/product-contract.md`
- Story: `docs/demo/story.md`
- Decisions: `docs/demo/decision.md`
- Architecture/domain: `docs/product/predict-club-architecture.md`
- Validation: `docs/demo/validation.md`

## Validation Plan

Build, browser smoke, manual disconnected/connected wallet review, stale oracle
blocking check, and DUSDC readiness check.

## Notes

This demo stops at documentation. A real implementation would create or update
a story under `docs/stories/`.

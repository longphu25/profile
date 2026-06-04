# Harness Demo

This demo shows how a small request becomes harness artifacts before code
changes. It is intentionally tiny and does not describe a real implementation
commit.

## Example Request

> Add a guided trade checklist to Predict Club so members understand whether a
> round is safe to join.

## Flow

```text
request
  -> feature intake
  -> product contract update
  -> story packet
  -> decision record when a tradeoff is durable
  -> validation note after proof
```

## Demo Artifacts

| Artifact | Purpose |
| --- | --- |
| `feature-intake.md` | Classifies risk before work starts |
| `product-contract.md` | Captures stable product behavior |
| `story.md` | Defines a bounded implementation packet |
| `decision.md` | Records a durable tradeoff |
| `validation.md` | Captures proof and residual risk |

## What This Demonstrates

- Product truth belongs in `docs/product/` or a product-like source.
- Story-sized work belongs in `docs/stories/`.
- Durable tradeoffs belong in `docs/decisions/`.
- Validation is planned before implementation and recorded after checks.
- High-risk Sui wallet/signing work needs stronger proof than docs-only work.

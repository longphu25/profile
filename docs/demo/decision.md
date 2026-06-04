# Demo Decision: Checklist Blocks Execution

## Status

- State: accepted
- Date: 2026-06-04
- Owner: demo

## Decision

The readiness checklist should block unsafe execution instead of only showing
warnings.

## Context

Predict Club guides members toward self-signed DeepBook Predict trades. A
warning-only checklist would still allow a new member to sign during stale
oracle, unsafe expiry, or missing DUSDC conditions.

## Options Considered

- Warning only: show risk labels but leave execution enabled.
- Blocking checklist: disable primary execution when critical checks fail.
- Leader override: let leader force execution for all members.

## Chosen Direction

Use a blocking checklist for critical safety checks and keep non-critical risks
as warnings.

## Rejected Alternatives

Warning-only UX is too weak for wallet/signing flows. Leader override conflicts
with the V1 rule that each member self-signs and controls their own trade.

## Consequences

- Positive: safer first-time member flow.
- Negative: more policy logic is needed before execution.
- Follow-up: decide which checks are warning-only versus blocking.

## Review Trigger

Revisit when V2 group vault execution is implemented.

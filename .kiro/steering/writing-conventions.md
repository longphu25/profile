---
inclusion: always
---

# Writing & Commit Conventions

These apply to all code, docs, and commits in this repo.

## Hard ban: no em-dash

Never use an em-dash (`—`) in any visible string: UI copy, docs, comments, commit
messages. Use a comma, a colon, parentheses, or a period instead. This is a hard rule
from the project design system, not a style preference.

## Safe imports across domain/ and infrastructure/

Anything used only as a type across the `domain/` and `infrastructure/` boundaries must be
`import type { ... }`, never a value import.

Reason: `infrastructure/deepbookPredictPricingService.ts` constructs a Sui RPC client at
module level. A plain value import drags that runtime side effect into pure `domain/`
modules and unit tests, which must stay free of runtime infra. `import type` is erased at
compile time, so it carries the type without the cost. `domain/` must never value-import
`infrastructure/` (presentation to infra is fine). Verify with a grep after adding any
cross-boundary import.

## Bilingual docs

When a doc has a Vietnamese companion, keep the `.md` (English) and `.vi.md` (Vietnamese)
pair in sync. New reference docs in `docs/` follow the same pair.

## Commits

Conventional Commits (`@commitlint/config-conventional`); subject line at or under 100
characters. Prefer small, revertable commits split by logical concern over one large
mixed commit.

## Money path is high-risk

Any change touching transaction building, coin selection, unit scaling, or claim/mint
guards must use exact bigint math for on-chain amounts (`parseToUnits`, never
`Math.floor(x * 10 ** decimals)` which can underpay), and should be verified with the
existing devInspect pre-flight before a real sign.

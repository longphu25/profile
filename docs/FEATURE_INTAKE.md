# Feature Intake

Every implementation request enters this gate before code changes.

## Input Types

| Type | Use when | Typical artifact |
| --- | --- | --- |
| New spec | A new product area needs to become repo knowledge | `product/`, `stories/`, `decisions/` |
| Spec slice | A selected behavior from an accepted plan is being built | Story packet |
| Change request | Existing behavior is being fixed or refined | Story packet or direct patch |
| Maintenance | Dependencies, docs, build, lint, or runtime hygiene | Validation note or direct patch |
| Harness improvement | The docs/process for agents needs improvement | Harness docs update |

## Lanes

### Tiny

Use for typo fixes, narrow docs updates, small copy changes, and localized
maintenance. Patch directly, run quick checks when available, and update indexes
if paths changed.

### Normal

Use for story-sized behavior with bounded blast radius. Create or update a file
under `stories/`, link relevant product and architecture docs, and update
validation expectations.

### High-Risk

Use when the work touches security, wallet signing, authorization, data
ownership, external providers, public contracts, or multiple domains. Create a
story folder, record open decisions, and require stronger validation before
claiming completion.

## Risk Checklist

| Risk flag | Applies when the work touches |
| --- | --- |
| Wallet/signing | connect, disconnect, signing, transaction execution |
| Authorization | permissions, policy contracts, gated decryption |
| Data model | persisted objects, schema, object ownership, migration |
| External systems | Sui, DeepBook, NAVI, Walrus, Seal, Polymarket |
| Public contract | API shape, plugin contract, host API, visible workflow |
| Existing behavior | already implemented user flows |
| Weak proof | unclear tests or no runnable validation |
| Multi-domain | more than one product domain changes at once |

0-1 flags is usually tiny or normal. 2-3 flags is normal with stronger proof.
4+ flags, wallet/signing, authorization, data loss, or security-sensitive work
is high-risk unless the human explicitly narrows scope.

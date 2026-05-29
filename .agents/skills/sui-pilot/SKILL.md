---
name: sui-pilot
description: >
  Sui/Move development expert grounded in current docs. Use when writing, reviewing,
  or debugging Move code, building Sui transactions, working with Walrus storage,
  Seal encryption, or the TypeScript SDK. Routes to bundled documentation before
  generating code.
---

# sui-pilot

Bundled Sui ecosystem documentation for grounded code generation.
Source: https://github.com/contract-hero/sui-pilot

## Docs Location

Docs are cloned at `~/sui-pilot/` and symlinked into the project:

```
.kiro/sui-pilot-docs/
  sui-docs/        → ~/sui-pilot/.sui-docs        (369 files)
  move-book-docs/  → ~/sui-pilot/.move-book-docs  (145 files)
  ts-sdk-docs/     → ~/sui-pilot/.ts-sdk-docs     (115 files)
  walrus-docs/     → ~/sui-pilot/.walrus-docs      (86 files)
  seal-docs/       → ~/sui-pilot/.seal-docs        (14 files)
  sui-prover-docs/ → ~/sui-pilot/.sui-prover-docs  (24 files)
```

To update docs:
```bash
cd ~/sui-pilot && git pull
```

## Doc-First Workflow

Before writing any Sui/Move code:
1. Search the relevant corpus for the topic
2. Read the specific doc page
3. Then write code grounded in current docs

## Routing Table

| Topic | Corpus | Path |
|-------|--------|------|
| Move language (syntax, types, abilities) | Move Book | `.kiro/sui-pilot-docs/move-book-docs/` |
| Sui blockchain (objects, transactions, PTBs) | Sui Docs | `.kiro/sui-pilot-docs/sui-docs/` |
| TypeScript SDK, dapp-kit, React hooks | TS SDK | `.kiro/sui-pilot-docs/ts-sdk-docs/` |
| Walrus blob storage, Walrus Sites | Walrus | `.kiro/sui-pilot-docs/walrus-docs/` |
| Seal encryption, key servers | Seal | `.kiro/sui-pilot-docs/seal-docs/` |
| Formal verification, specs | Prover | `.kiro/sui-pilot-docs/sui-prover-docs/` |

## Search Pattern

```bash
# Find docs about a topic
find .kiro/sui-pilot-docs -name "*.md" | xargs grep -l "shared objects"

# Read specific doc
cat .kiro/sui-pilot-docs/sui-docs/concepts/object-model/shared-objects.md
```

## Capabilities

- **Move Code Quality** — Move 2024 Edition compliance, method syntax, naming conventions
- **Move Code Review** — access control, reentrancy, overflow, hot potato, capability misuse
- **Formal Verification** — `#[spec(prove)]` specs, sui-prover, pre/post conditions

## When NOT to use

- DeepBook Predict specifics → `docs/deepbook/` and `plugins/sui-deepbook-predict/TODO.md`
- Frontend React patterns → `frontend-apps` skill
- Project architecture → `AGENTS.md` and `.kiro/steering/`

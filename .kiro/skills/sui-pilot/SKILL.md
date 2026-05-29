---
name: sui-pilot
description: >
  Sui/Move development expert grounded in current docs. Use when writing, reviewing,
  or debugging Move code, building Sui transactions, working with Walrus storage,
  Seal encryption, or the TypeScript SDK. Routes to bundled documentation before
  generating code.
---

# sui-pilot (adapted from contract-hero/sui-pilot)

Bundled Sui ecosystem documentation for grounded code generation.
Source: https://github.com/contract-hero/sui-pilot

## Setup

Clone the sui-pilot docs into the project (one-time):

```bash
# Clone just the docs directories
git clone --depth 1 --filter=blob:none --sparse https://github.com/contract-hero/sui-pilot.git /tmp/sui-pilot
cd /tmp/sui-pilot
git sparse-checkout set .sui-docs .move-book-docs .ts-sdk-docs .walrus-docs .seal-docs .sui-prover-docs
cp -r .sui-docs .move-book-docs .ts-sdk-docs .walrus-docs .seal-docs .sui-prover-docs ~/p/hackathon/SUI/me/profile/.kiro/sui-pilot-docs/
```

Or symlink if already cloned:
```bash
ln -s /path/to/sui-pilot/.sui-docs .kiro/sui-pilot-docs/.sui-docs
```

## How to Use

### Doc-First Workflow

Before writing any Sui/Move code:
1. Search the relevant corpus for the topic
2. Read the specific doc page
3. Then write code grounded in current docs

### Routing Table

| Topic | Corpus | Path |
|-------|--------|------|
| Move language (syntax, types, abilities) | Move Book | `.sui-pilot-docs/.move-book-docs/` |
| Sui blockchain (objects, transactions, PTBs) | Sui Docs | `.sui-pilot-docs/.sui-docs/` |
| TypeScript SDK, dapp-kit, React hooks | TS SDK | `.sui-pilot-docs/.ts-sdk-docs/` |
| Walrus blob storage, Walrus Sites | Walrus | `.sui-pilot-docs/.walrus-docs/` |
| Seal encryption, key servers | Seal | `.sui-pilot-docs/.seal-docs/` |
| Formal verification, specs | Prover | `.sui-pilot-docs/.sui-prover-docs/` |

### Search Pattern

```bash
# Find docs about a topic
find .kiro/sui-pilot-docs -name "*.md" | xargs grep -l "shared objects"

# Read specific doc
cat .kiro/sui-pilot-docs/.sui-docs/concepts/object-model/shared-objects.md
```

## Skills from sui-pilot

### Move Code Quality (50+ rules)
- Move 2024 Edition compliance
- Method syntax, public(package) visibility, enum usage
- Lint: unused imports, dead code, naming conventions

### Move Code Review (40 checks, 6 categories)
- Access control, reentrancy, overflow
- Object ownership patterns
- Hot potato safety
- Capability misuse

### Formal Verification
- Author `#[spec(prove)]` specs
- Verify with sui-prover binary
- Pre/post conditions, invariants

## When NOT to use

- For DeepBook Predict specifics → use project's own `docs/deepbook/` and `TODO.md`
- For frontend React patterns → use project's existing skills (frontend-apps, dapp-kit)
- For project-specific architecture → use `AGENTS.md` and `.kiro/skills/`

# Project Harness

The app is what users touch. The harness is what agents touch before changing
the app.

This repo already has many technical notes. The harness layer makes them easier
to use by answering four questions before work starts:

1. What product contract is affected?
2. What story or plan does this change belong to?
3. Which architecture boundary could be touched?
4. What proof is needed before the work is considered done?

## Source Hierarchy

```text
User request or supplied spec
  -> docs/FEATURE_INTAKE.md
  -> docs/product/*
  -> docs/stories/*
  -> docs/ARCHITECTURE.md and domain docs
  -> docs/TEST_MATRIX.md
  -> docs/decisions/*
```

Before implementation, product docs describe intent. After implementation,
product docs plus tests and runnable checks become the living contract.

## Task Loop

1. Classify the request with `FEATURE_INTAKE.md`.
2. Locate affected product docs and story files.
3. Read the relevant architecture/domain docs.
4. Implement the smallest bounded change.
5. Run the proof listed in `TEST_MATRIX.md`.
6. Update docs, story status, or decisions if the contract changed.

## Growth Rule

When an agent gets stuck because project context is missing, improve the harness
directly or record the missing context in `HARNESS_BACKLOG.md`.

Good harness changes are small, durable, and useful to the next agent.

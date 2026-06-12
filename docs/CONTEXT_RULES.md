# Context Engineering Rules

Context rules help agents decide what to read, when to read it, and when to stop
reading. They are additive to the stable reading list in the root `AGENTS.md`.

The goal is not to maximize context. The goal is to put the right information in
the model for the current task phase and risk lane (see `FEATURE_INTAKE.md`).

This repo's search tools replace any harness CLI: prefer `codegraph` for source
and `qmd ... -c profile-docs` for docs (see `QMD.md`).

## Context Phases

### Intake Phase

Read to classify the request, find the affected surface, and choose a lane.

| Source | Tiny | Normal | High-Risk |
| --- | --- | --- | --- |
| `AGENTS.md` | Must | Must | Must |
| `docs/FEATURE_INTAKE.md` | Must | Must | Must |
| `docs/TEST_MATRIX.md` | Should | Must | Must |
| `docs/README.md` / `docs/INDEX.md` | Should | Must | Must |
| `docs/HARNESS.md` | Should | Must | Must |
| `docs/ARCHITECTURE.md` | Skip | Should | Must |
| Relevant `docs/product/*` | Skip if unrelated | Must if product behavior changes | Must |
| Relevant `docs/stories/*` | Skip if unrelated | Must if a story exists | Must |
| `docs/decisions/*` | Skip | Should if durable rules touched | Must |

### Planning Phase

Read to decide the smallest safe approach and expected proof.

| Source | Tiny | Normal | High-Risk |
| --- | --- | --- | --- |
| Files to edit | Must | Must | Must |
| `docs/templates/story.md` | Skip | Must when creating/updating a story | Should |
| `docs/ARCHITECTURE.md` | Skip | Should for code/boundary changes | Must |
| `docs/TEST_MATRIX.md` | Should | Must | Must |
| Relevant decisions | Skip | Should | Must |
| `docs/HARNESS_BACKLOG.md` | Skip | Should if friction repeats | Must if changing harness behavior |

### Implementation Phase

Read while making the change. Keep this phase scoped to files that directly
affect the selected story.

| Source | Tiny | Normal | High-Risk |
| --- | --- | --- | --- |
| Files being changed | Must | Must | Must |
| Adjacent files with same pattern (use `codegraph`) | Should | Must | Must |
| Relevant product docs | Skip if copy-only | Must if behavior changes | Must |
| Relevant story packet | Skip if no story needed | Must | Must |
| `.kiro/steering/*` matching the path | Should | Must | Must |
| Provider/API/security docs | Skip | Should if touched | Must |
| Unrelated docs and history | Skip | Skip | Should only if they affect decisions |

### Validation Phase

Read to confirm the proof matches the work type.

| Source | Tiny | Normal | High-Risk |
| --- | --- | --- | --- |
| `docs/TEST_MATRIX.md` row for the work type | Must | Must | Must |
| `docs/templates/validation.md` | Skip | Should | Must |
| Affected story acceptance criteria | Skip | Must | Must |

## Stop Rules

- Stop reading when you can name the affected product contract, the lane, the
  boundary touched, and the proof required.
- Do not read unrelated domains "just in case" — use `codegraph`/`qmd` to pull
  only the symbol or doc you need.
- Re-confirm position from recent file/command output after context compaction
  rather than re-reading everything.

## Growth Rule

When missing context forces a guess, record it in `HARNESS_BACKLOG.md` or fix the
harness directly. Small, durable improvements beat large speculative ones.

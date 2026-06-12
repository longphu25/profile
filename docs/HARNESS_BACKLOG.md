# Harness Backlog

Track improvements that would make the next agent faster or safer.

| Status | Item | Why it matters |
| --- | --- | --- |
| Open | Add a docs link checker | Path moves can silently break Obsidian/wiki links. |
| Open | Add dashboard smoke tests | Plugin registration and production paths are easy to regress. |
| Done | Add story status metadata | `stories/STATUS.md` now exposes a uniform state index for all plans. |
| Done | Context engineering rules | `CONTEXT_RULES.md` defines per-phase / per-lane reading like the reference harness. |
| Open | Backfill `**Status:**` field in older plans | Several plans lack a machine-readable status; `STATUS.md` marks them `unknown`. |
| Open | Glossary of harness terms | Reference harness ships `GLOSSARY.md`; would align vocabulary for new agents. |
| Open | High-risk story template folder | Reference harness has `templates/high-risk-story/`; add if wallet/contract work grows. |

## Ported from reference (hoangnb24/repository-harness)

Adopted (lightweight, project-fit):
- Context phases + risk-lane reading table → `CONTEXT_RULES.md`
- Uniform story status index → `stories/STATUS.md`

Deliberately NOT ported (overkill for this repo):
- Rust `harness-cli` + SQLite durable layer / trace scoring — this repo uses
  `codegraph` (source) and `qmd` (docs) instead of a bespoke CLI.
- Improvement-proposal pipeline (`harness-cli propose`) — manual backlog is enough
  at current scale.

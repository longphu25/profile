# Templates

Use these templates to keep harness artifacts consistent.

| Template | Use when |
| --- | --- |
| `feature-intake.md` | Classifying a request before deciding whether to patch directly or create a story |
| `spec.md` | Turning a new product area or substantial feature request into repo knowledge |
| `story.md` | Planning a bounded work packet with acceptance criteria and validation |
| `decision.md` | Recording durable tradeoffs that future agents should inherit |
| `validation.md` | Capturing proof, residual risk, and follow-up after implementation |

## Flow

```text
human request
  -> feature intake
  -> product/spec docs when product truth changes
  -> story packet for bounded implementation
  -> decision record when a tradeoff should persist
  -> validation note when proof matters
```

Small typo fixes and narrow docs edits can skip new artifacts, but the harness
should still be updated when missing context causes confusion.

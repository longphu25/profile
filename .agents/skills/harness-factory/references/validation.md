# Harness Validation

## Structural Checks

- Skill directories contain `SKILL.md`.
- Skill frontmatter includes `name` and `description`.
- Descriptions include concrete trigger phrases.
- Reference files linked from `SKILL.md` exist.
- Kiro steering files include frontmatter and clear scope.
- Docs referenced from steering files exist.

## Trigger Checks

For each skill, write:

- 5 should-trigger prompts.
- 5 near-miss prompts that should not trigger.

Near misses should be realistic, not obviously unrelated.

## Workflow Checks

- Every phase has an input and output.
- Parallel branches have merge criteria.
- Review gates have concrete checks.
- Error handling says what to do after retry failure.
- Final output has a validation path.

## Repo Checks

- Run `qmd update` after docs changes.
- Search QMD for newly added docs.
- Use `git diff --stat` to confirm scope.
- Avoid committing unrelated dirty worktree changes.

## Suggested Validation Note

```markdown
## Harness Validation

| Check | Result | Notes |
| --- | --- | --- |
| Skill frontmatter | pass/fail | |
| Steering scope | pass/fail | |
| QMD update | pass/fail | |
| Trigger examples | pass/fail | |
| Near-miss examples | pass/fail | |
| Docs links | pass/fail | |

## Residual Risk
```

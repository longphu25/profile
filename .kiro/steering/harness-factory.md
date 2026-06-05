---
inclusion: always
---

# Harness Factory Policy

When the user asks to build, port, audit, extend, or maintain a harness, agent
team, orchestrator workflow, or project-local skill, use the project skill:

```text
.agents/skills/harness-factory/SKILL.md
```

Use this for requests mentioning:

- `revfactory/harness`
- `build a harness`
- `agent team`
- `orchestrator`
- `port skill logic`
- project-local skills or steering rules

Repo-native output should prefer `.agents/skills/`, `.kiro/steering/`, and
`docs/` artifacts. Only generate `.claude/agents/` or `.claude/skills/` when the
user explicitly asks for Claude Code integration.

Still follow the QMD and RTK policies.

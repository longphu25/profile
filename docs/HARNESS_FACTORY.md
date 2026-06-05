# Harness Factory Port

This repo ports the useful logic from `revfactory/harness` without vendoring the
Claude Code plugin.

## What Was Ported

- phased harness design,
- agent/team architecture patterns,
- skill generation principles,
- orchestrator workflow design,
- validation and trigger testing,
- harness evolution rules.

## What Was Not Ported

- Claude Code plugin marketplace installation,
- mandatory `.claude/agents/` output,
- mandatory `.claude/skills/` output,
- Agent Teams runtime assumptions.

## Repo-Native Targets

| Target | Use |
| --- | --- |
| `.agents/skills/harness-factory/SKILL.md` | Codex-readable project-local skill |
| `.agents/skills/harness-factory/references/` | Pattern, artifact, and validation references |
| `.kiro/steering/harness-factory.md` | Kiro policy for harness design requests |
| `docs/HARNESS.md` | General project harness model |
| `docs/demo/` | Small example harness flow |
| `docs/templates/` | Reusable harness artifacts |

## When To Use

Use the ported skill when a request asks for:

- a new agent team,
- a domain-specific harness,
- skill creation,
- orchestrator design,
- audit of existing project harness files,
- adapting `revfactory/harness` ideas to Codex or Kiro.

## Source

The source project describes Harness as a team-architecture factory that
generates domain-specific agent definitions and skills using six architecture
patterns. This repo adapts those ideas into project-local skills, Kiro steering,
and documentation artifacts.

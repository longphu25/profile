---
name: harness-factory
description: Use when the user asks to build, design, extend, audit, or maintain an agent harness, agent team, orchestrator workflow, domain-specific agents, or project-local skills. Also use for requests that mention revfactory/harness, "học/port skill logic", "build a harness", "agent team", "orchestrator skill", "skills for this project", or adapting Claude Harness logic to Codex/Kiro.
---

# Harness Factory

Ported workflow from `revfactory/harness` for this repo's Codex/Kiro setup. The
goal is not to vendor Claude Code Agent Teams, but to design reusable agent
workflows, project-local skills, docs, and validation gates that fit this
workspace.

## Output Targets

Prefer repo-native artifacts:

- Project skills: `.agents/skills/<skill-name>/SKILL.md`
- Optional skill references: `.agents/skills/<skill-name>/references/*.md`
- Kiro policy: `.kiro/steering/*.md`
- Harness docs: `docs/HARNESS.md`, `docs/ORGANIZATION.md`, `docs/templates/*`
- Product/story/decision/validation docs under `docs/product/`, `docs/stories/`,
  `docs/decisions/`, and `docs/demo/`

Only generate `.claude/agents/` or `.claude/skills/` when the user explicitly
asks for Claude Code integration.

## Workflow

### Phase 0: Audit Existing Harness

Before adding agents or skills:

1. Inspect `.agents/skills/`, `.kiro/steering/`, `docs/HARNESS.md`,
   `docs/templates/`, and `AGENTS.md`.
2. Use QMD for docs lookup when relevant: search `profile-docs`, then read the
   matched docs.
3. Detect duplicate skills, stale steering rules, missing templates, or drift
   between docs and actual files.
4. Summarize what exists before changing files.

### Phase 1: Domain Analysis

Identify:

- the domain being automated,
- recurring task types,
- risk boundaries,
- required source docs,
- validation proof,
- whether this needs a skill, steering rule, docs-only harness artifact, or a
  full agent-team design.

Use `docs/FEATURE_INTAKE.md` and `docs/TEST_MATRIX.md` for risk and proof.

### Phase 2: Team Architecture

Choose a coordination pattern:

- Pipeline: sequential dependent steps.
- Fan-out/fan-in: parallel independent analysis merged into one result.
- Expert pool: choose specialists based on task context.
- Producer-reviewer: one agent creates, another reviews.
- Supervisor: central coordinator dynamically assigns work.
- Hierarchical delegation: recursively break work into subdomains.

For Codex, express these as docs, task plans, or callable subagent strategy when
multi-agent tools are available. For Kiro, express them as steering plus
project artifacts.

Read `references/team-patterns.md` when selecting a pattern.

### Phase 3: Agent Role Design

Create a role only when it adds durable value.

Each role should define:

- responsibility,
- inputs,
- outputs,
- when to invoke it,
- boundaries and failure handling,
- which skills or docs it should use.

Avoid duplicate roles with different names. Merge roles when one specialist can
reasonably own both responsibilities.

### Phase 4: Skill Design

Create or update project-local skills when procedural knowledge should persist.

Rules:

- Keep `SKILL.md` concise.
- Put details in `references/` and load them only when needed.
- Make the `description` explicit about trigger cases and near misses.
- Bundle scripts only for repeated deterministic work.
- Do not create extra README/changelog files inside a skill.

Read `references/artifact-templates.md` when creating skill or orchestrator
artifacts.

### Phase 5: Orchestration

For a team workflow, specify:

- phase order,
- role assignment,
- data handoff,
- shared artifact paths,
- retry behavior,
- merge/review gates,
- final validation.

For large workflows, use `_workspace/` or `docs/stories/<packet>/` for
intermediate artifacts so later agents can audit what happened.

### Phase 6: Validation

Validate the harness itself, not only the app:

- Skills have valid frontmatter.
- Steering rules are discoverable and scoped.
- Docs links point to real files.
- Trigger phrases and near-miss phrases are covered.
- The workflow has no missing input/output handoff.
- QMD is updated if docs changed.

Read `references/validation.md` for validation prompts and checks.

### Phase 7: Evolution

Harnesses should change when evidence shows drift:

- repeated user feedback,
- repeated agent failure,
- manual workarounds,
- stale docs,
- missing validation proof,
- duplicate skills or conflicting steering rules.

Record durable changes in `docs/HARNESS_BACKLOG.md`, `docs/decisions/`, or
the affected skill/steering file.

## Default Behavior In This Repo

- Use `rtk` for shell commands.
- Use QMD MCP or `qmd search ... -c profile-docs` for docs lookup.
- Keep English source docs as `*.md`; Vietnamese translations as `*.vi.md`.
- Bump `package.json` for non-trivial harness changes.
- Do not move docs without updating links and QMD.

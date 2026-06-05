# Harness Artifact Templates

## Agent Role Card

```markdown
# {Role Name}

## Responsibility

## Invoke When

## Inputs

## Outputs

## Boundaries

## Failure Handling

## Skills / Docs
```

## Orchestrator Workflow

```markdown
# {Domain} Orchestrator

## Trigger

## Roles

| Role | Responsibility | Output |
| --- | --- | --- |

## Phases

1. Context audit
2. Domain analysis
3. Parallel or sequential work
4. Review / merge
5. Validation
6. Documentation update

## Data Handoff

## Error Handling

## Validation

## Evolution Notes
```

## Project Skill Skeleton

```markdown
---
name: skill-name
description: Use when...
---

# Skill Name

## Workflow

## Decision Rules

## Validation

## References
```

## Kiro Steering Skeleton

```markdown
---
inclusion: always | manual | fileMatch
fileMatchPattern: "optional/glob/**"
---

# Policy Name

When to apply:

Rules:

Related docs:
```

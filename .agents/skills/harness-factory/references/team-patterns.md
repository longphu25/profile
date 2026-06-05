# Harness Team Patterns

Use these patterns when designing a domain-specific harness.

## Pipeline

Sequential specialists. Use when each output depends on the prior step.

Good for: specs -> implementation -> validation -> release notes.

Risk: slow if steps are independent.

## Fan-Out/Fan-In

Several specialists inspect independent surfaces, then one integrator merges
findings.

Good for: code review, docs audit, competitive research, architecture review.

Risk: duplicated work or inconsistent criteria unless merge rules are explicit.

## Expert Pool

Define specialists, but invoke only the ones needed for the task.

Good for: mixed-domain projects like Sui, frontend, Move, docs, and design.

Risk: missed invocation if triggers are vague.

## Producer-Reviewer

One role creates; another role reviews against explicit criteria.

Good for: specs, translations, frontend UI, security-sensitive changes.

Risk: review becomes shallow unless the reviewer has concrete checks.

## Supervisor

One coordinator maintains task state and dynamically assigns work.

Good for: long workflows with uncertainty or changing scope.

Risk: coordinator bottleneck.

## Hierarchical Delegation

Break a large domain into subdomains, each with its own mini-workflow.

Good for: large docs migrations, multi-product platform work, broad audits.

Risk: too much structure for small tasks.

## Selection Heuristic

- 1 specialist: no team; direct skill or docs update.
- 2 roles where one checks the other: producer-reviewer.
- 3+ independent reviews: fan-out/fan-in.
- Recurring mixed-domain task: expert pool.
- Complex ongoing effort: supervisor.
- Large domain tree: hierarchical delegation.

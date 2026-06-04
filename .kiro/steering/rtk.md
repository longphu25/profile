---
inclusion: always
---

# RTK Command Policy

Use `rtk` whenever running shell commands in this repo.

## Rule

Prefix commands with `rtk` so command output is token-optimized before it reaches
the agent context.

Examples:

```bash
rtk git status
rtk bun run build
rtk bun run dev
rtk npm run lint
rtk find docs -name '*.md'
rtk sed -n '1,160p' docs/README.md
```

## Raw Command Escape Hatch

If a command needs unsupported shell syntax or a tool that `rtk` does not wrap
cleanly, use `rtk proxy`:

```bash
rtk proxy <command>
```

## Verification

Use these checks if command wrapping behaves unexpectedly:

```bash
rtk --version
rtk gain
which rtk
```

Current project expectation: commands should be run through `rtk` unless there
is a specific reason to bypass it.

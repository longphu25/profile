# Default Model: Composer 2.5

How to make **grok-composer-2.5-fast** the default model for Grok Build CLI,
subagents, headless workers, and forked sessions.

## Model ID

Run `grok models` to list IDs on your machine. Typical output:

```text
Default model: grok-composer-2.5-fast

Available models:
  * grok-composer-2.5-fast (default)
  - grok-build
```

Use the exact slug from that list. Do not guess `composer-2.5` without the
`grok-` prefix unless your catalog shows otherwise.

## Global default (`~/.grok/config.toml`)

```toml
[models]
default = "grok-composer-2.5-fast"

[ui]
fork_secondary_model = "grok-composer-2.5-fast"
```

| Key | Effect |
| --- | --- |
| `[models].default` | New TUI and headless sessions (unless overridden) |
| `[ui].fork_secondary_model` | Model used when forking a session (`/fork`) |

If `fork_secondary_model` stays on `grok-build`, forks may switch away from
Composer even when `default` is already Composer.

Verify:

```bash
grok models
```

## Per-repo default (`.grok/config.toml`)

At the repository root (for example this `profile` repo):

```toml
[models]
default = "grok-composer-2.5-fast"

[subagents.models]
explore = "grok-composer-2.5-fast"
general-purpose = "grok-composer-2.5-fast"
```

Config precedence: cwd `.grok/config.toml` → repo-root `.grok/config.toml` →
`~/.grok/config.toml`.

## Subagents

By default, subagents inherit the parent session model. To pin Composer for
specific agent types:

```toml
[subagents.models]
explore = "grok-composer-2.5-fast"
plan = "grok-composer-2.5-fast"
```

## Headless and VPS workers

`[models].default` applies to many headless runs, but automation scripts should
still pass `-m` explicitly:

```bash
grok -p "Implement issue #42" \
  -m grok-composer-2.5-fast \
  --cwd /opt/repos/my-app \
  --yolo
```

See [TECHNICAL.md](./TECHNICAL.md) for worker script examples.

## Active session (TUI)

An open session keeps its current model until you change it:

```
/model grok-composer-2.5-fast
```

Shortcuts: `Ctrl+M` from scrollback (not from prompt focus), or `/m` alias.

Start fresh: `/new` or quit and run `grok` again.

## Agent mode (ACP / IDE stdio)

```bash
grok agent --model grok-composer-2.5-fast stdio
```

## Cursor IDE built-in Grok chat

The **Cursor Agent / Composer panel** (this IDE chat) uses **Cursor model
settings**, not `~/.grok/config.toml`. Pick Composer 2.5 in Cursor's model
dropdown or Settings → Models.

See [CURSOR-IDE.md](./CURSOR-IDE.md) for the full Cursor vs Grok CLI split.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Still uses `grok-build` | Check `grok models`; set `[models].default`; `/model` in active session |
| Fork uses wrong model | Set `[ui].fork_secondary_model` |
| VPS worker wrong model | Add `-m grok-composer-2.5-fast` to `grok -p` |
| Subagent uses `grok-build` | Add `[subagents.models]` overrides |
| Cursor chat not Composer | Change model in Cursor UI, not Grok config |

## Related

- [CURSOR-IDE.md](./CURSOR-IDE.md)
- [TECHNICAL.md](./TECHNICAL.md)
- Local reference: `~/.grok/docs/user-guide/11-custom-models.md`
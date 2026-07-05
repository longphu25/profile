# Grok on VPS with GitHub Automation

Run **Grok Build CLI** on a Linux VPS to react to GitHub issues, implement fixes,
open pull requests, and keep working near 24/7. Grok is a **CLI coding agent**,
not a managed daemon. You add a thin orchestration layer (webhook, cron, or
systemd) on top of headless mode.

## Documents

| File | Audience | Contents |
| --- | --- | --- |
| [TECHNICAL.md](./TECHNICAL.md) | Operators and agent authors | Architecture, auth, MCP, scripts, security, troubleshooting |
| [TECHNICAL.vi.md](./TECHNICAL.vi.md) | Same (Vietnamese) | Bản tiếng Việt của tài liệu kỹ thuật |
| [CURSOR-IDE.md](./CURSOR-IDE.md) | Cursor users | Grok in Cursor: built-in agent, terminal TUI, headless |
| [CURSOR-IDE.vi.md](./CURSOR-IDE.vi.md) | Same (Vietnamese) | Grok trên Cursor IDE |
| [MODEL-DEFAULT.md](./MODEL-DEFAULT.md) | All environments | Default model `grok-composer-2.5-fast` |
| [MODEL-DEFAULT.vi.md](./MODEL-DEFAULT.vi.md) | Same (Vietnamese) | Model mặc định Composer 2.5 |
| [config.toml.example](./config.toml.example) | Copy-paste | Starter Grok config for repo + VPS |

## Quick Answer

| Question | Answer |
| --- | --- |
| Can Grok run on a VPS? | Yes. Install the CLI on Ubuntu/Debian and run headless prompts. |
| Does it stay on 24/7 by itself? | No. Use cron, systemd, or a webhook listener to trigger `grok -p`. |
| Can it read GitHub issues? | Yes, via GitHub MCP, `gh` CLI, or REST API in shell scripts. |
| Can it code and open PRs? | Yes, with `git`, `gh pr create`, and `--yolo` for unattended runs. |
| Subscription | Grok Build beta requires SuperGrok or X Premium+ ([x.ai/cli](https://x.ai/cli)). |
| Headless auth | `XAI_API_KEY` from [console.x.ai](https://console.x.ai) or `grok login --device-auth`. |
| Grok in Cursor IDE? | Yes: built-in agent chat, or `grok` / `grok -p` in integrated terminal. See [CURSOR-IDE.md](./CURSOR-IDE.md). |
| Default model Composer 2.5 | `[models].default = "grok-composer-2.5-fast"` in `~/.grok/config.toml`. See [MODEL-DEFAULT.md](./MODEL-DEFAULT.md). |

## Minimal Flow

```text
GitHub issue (label: agent)
        |
        v
Webhook or cron worker on VPS
        |
        v
grok -p "Implement issue #N ..." --yolo --cwd /opt/repo
        |
        v
branch + commit + gh pr create + issue comment
```

## When to Use This Pattern

**Good fit:**

- Small repo with clear `AGENTS.md` rules and CI on every PR
- Issues labeled explicitly (for example `agent`, `good-first-issue`)
- You want full control over skills, MCP, and repo conventions

**Poor fit:**

- Unreviewed direct pushes to `main`
- Secrets or money-path code without human gate
- High-volume polling every minute (token cost)

## Prerequisites

1. VPS with Node 20+, `git`, `gh`, and enough disk for repo clones
2. Grok Build CLI: `curl -fsSL https://x.ai/cli/install.sh | bash`
3. GitHub token (fine-grained PAT or GitHub App) with repo + PR scope
4. Clone of the target repository under a dedicated Unix user

## Next Steps

Read [TECHNICAL.md](./TECHNICAL.md) for:

- `~/.grok/config.toml` with GitHub MCP
- Example `grok-issue-worker.sh` and systemd unit
- Webhook listener sketch
- Permission hardening (`--allow`, `--deny`, branch policy)
- Operational checklist before production use

## Related Repo Docs

- [open-design-grok/README.md](../open-design-grok/README.md): Open Design desktop +
  Grok Build for local UI design (complements VPS automation)
- [SETUP.md](../../SETUP.md): harness, QMD, and MCP setup in this project
- [HARNESS.md](../../HARNESS.md): how agents should read docs here
- [CONTEXT_RULES.md](../../CONTEXT_RULES.md): what to load per task phase

## External References

- [Grok Build CLI](https://x.ai/cli)
- [xAI Build docs](https://docs.x.ai/build/overview)
- [Grok headless mode](https://docs.x.ai) (see local `~/.grok/docs/user-guide/14-headless-mode.md` after install)
- [GitHub MCP server](https://github.com/modelcontextprotocol/servers)
# Grok trên VPS với tự động hóa GitHub

Chạy **Grok Build CLI** trên VPS Linux để phản hồi GitHub issue, sửa code, mở
pull request và hoạt động gần như 24/7. Grok là **CLI coding agent**, không phải
daemon được quản lý sẵn. Bạn cần thêm một lớp orchestration mỏng (webhook, cron,
hoặc systemd) trên headless mode.

## Tài liệu

| File | Đối tượng | Nội dung |
| --- | --- | --- |
| [TECHNICAL.md](./TECHNICAL.md) | Operator và tác giả agent | Kiến trúc, auth, MCP, script, bảo mật, troubleshooting (tiếng Anh) |
| [TECHNICAL.vi.md](./TECHNICAL.vi.md) | Cùng đối tượng | Bản tiếng Việt chi tiết |
| [CURSOR-IDE.vi.md](./CURSOR-IDE.vi.md) | Người dùng Cursor | Grok trên Cursor: agent tích hợp, TUI terminal, headless |
| [MODEL-DEFAULT.vi.md](./MODEL-DEFAULT.vi.md) | Mọi môi trường | Model mặc định `grok-composer-2.5-fast` |
| [config.toml.example](./config.toml.example) | Copy-paste | Mẫu config Grok cho repo + VPS |

## Trả lời nhanh

| Câu hỏi | Trả lời |
| --- | --- |
| Grok chạy trên VPS được không? | Có. Cài CLI trên Ubuntu/Debian và chạy prompt headless. |
| Tự bật 24/7 không? | Không. Dùng cron, systemd, hoặc webhook listener để gọi `grok -p`. |
| Đọc GitHub issue được không? | Có, qua GitHub MCP, `gh` CLI, hoặc REST API trong shell script. |
| Code và mở PR được không? | Có, với `git`, `gh pr create`, và `--yolo` cho chạy không giám sát. |
| Gói đăng ký | Grok Build beta cần SuperGrok hoặc X Premium+ ([x.ai/cli](https://x.ai/cli)). |
| Auth headless | `XAI_API_KEY` từ [console.x.ai](https://console.x.ai) hoặc `grok login --device-auth`. |
| Grok trên Cursor IDE? | Có: chat agent tích hợp, hoặc `grok` / `grok -p` trong terminal. Xem [CURSOR-IDE.vi.md](./CURSOR-IDE.vi.md). |
| Model mặc định Composer 2.5 | `[models].default = "grok-composer-2.5-fast"` trong `~/.grok/config.toml`. Xem [MODEL-DEFAULT.vi.md](./MODEL-DEFAULT.vi.md). |

## Luồng tối thiểu

```text
GitHub issue (label: agent)
        |
        v
Webhook hoặc cron worker trên VPS
        |
        v
grok -p "Làm issue #N ..." --yolo --cwd /opt/repo
        |
        v
branch + commit + gh pr create + comment issue
```

## Khi nào nên dùng

**Phù hợp:**

- Repo nhỏ, có `AGENTS.md` rõ, CI chạy trên mọi PR
- Issue được gắn label rõ (ví dụ `agent`, `good-first-issue`)
- Bạn muốn kiểm soát skills, MCP, và convention của repo

**Không phù hợp:**

- Push thẳng lên `main` không review
- Code money-path hoặc secret không có cổng human
- Poll liên tục mỗi phút (tốn token)

## Điều kiện tiên quyết

1. VPS có Node 20+, `git`, `gh`, đủ disk cho clone repo
2. Grok Build CLI: `curl -fsSL https://x.ai/cli/install.sh | bash`
3. GitHub token (fine-grained PAT hoặc GitHub App) có quyền repo + PR
4. Clone repo đích dưới Unix user riêng

## Bước tiếp theo

Đọc [TECHNICAL.vi.md](./TECHNICAL.vi.md) để có:

- `~/.grok/config.toml` với GitHub MCP
- Ví dụ `grok-issue-worker.sh` và systemd unit
- Phác thảo webhook listener
- Cứng hóa quyền (`--allow`, `--deny`, chính sách branch)
- Checklist vận hành trước khi đưa vào production

## Tài liệu liên quan trong repo

- [SETUP.md](../../SETUP.md): thiết lập harness, QMD, MCP trong dự án này
- [HARNESS.md](../../HARNESS.md): cách agent nên đọc docs ở đây
- [CONTEXT_RULES.md](../../CONTEXT_RULES.md): đọc gì theo từng phase

## Tham chiếu bên ngoài

- [Grok Build CLI](https://x.ai/cli)
- [xAI Build docs](https://docs.x.ai/build/overview)
- [Grok headless mode](https://docs.x.ai) (xem `~/.grok/docs/user-guide/14-headless-mode.md` sau khi cài)
- [GitHub MCP server](https://github.com/modelcontextprotocol/servers)
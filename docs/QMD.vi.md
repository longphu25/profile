# Thiết Lập QMD

QMD được cấu hình cho việc tìm kiếm tài liệu cục bộ đơn giản.

## Collection

- Tên: `profile-docs`
- Đường dẫn: `docs/`
- Mask: `**/*.md`
- Phạm vi: tài liệu nguồn tiếng Anh và bản dịch tiếng Việt `*.vi.md`.
- Số file index: **270** file `*.md` trong `docs/` (phải khớp `find docs -name '*.md' | wc -l`)
- Context theo thư mục:

| Đường dẫn QMD | Chủ đề |
|---------------|--------|
| `qmd://profile-docs/` | Harness gốc: INDEX, HARNESS, product |
| `qmd://profile-docs/telegram/` | Mini App, auto-login, Turso/Convex, ROADMAP |
| `qmd://profile-docs/btc-chart/` | Plugin chart, Trade Setup, ML, WASM |
| `qmd://profile-docs/agents/` | Grok VPS, GitHub, Cursor IDE |
| `qmd://profile-docs/decisions/` | ADR |
| `qmd://profile-docs/stories/` | Story plans (plan 24 telegram) |

Kiểm tra (số file phải khớp):

```bash
find docs -name '*.md' | wc -l
bun run docs:status
qmd collection show profile-docs
qmd ls profile-docs/telegram
```

## Các Lệnh Ưu Tiên

```bash
qmd search "plugin architecture" -c profile-docs
qmd search "telegram auto-login Turso Convex" -c profile-docs
qmd get qmd://profile-docs/telegram/TECHNICAL.vi.md
qmd get qmd://profile-docs/decisions/telegram-data-backend.vi.md
qmd update
```

Shortcut trong repo:

```bash
bun run docs:index    # qmd update + khôi phục context thư mục
bun run docs:context  # chỉ gắn lại context (máy mới / index mới)
bun run docs:status
```

Context nằm trong `~/.cache/qmd/index.sqlite`, không commit git. Máy mới: chạy
`bun run docs:context` sau khi đã add collection `profile-docs`.

Dùng `qmd search` cho tìm kiếm từ khóa BM25 và `qmd get` để lấy nội dung. Tránh
`qmd query`, `qmd vsearch` và `qmd embed` trừ khi tác vụ thực sự cần model cục
bộ.

## MCP

Cấu hình MCP global của Codex bao gồm:

```toml
[mcp_servers.qmd]
command = "qmd"
args = [ "mcp" ]
enabled = true
```

Nếu dùng công cụ MCP `query`, hãy truyền `rerank: false` để tránh nạp mô hình
reranker.

## Kiro MCP

Cấu hình MCP workspace của Kiro nằm ở:

```text
.kiro/settings/mcp.json
```

Nó expose cùng server:

```json
{
  "mcpServers": {
    "qmd": {
      "command": "/Users/longphu/.bun/bin/qmd",
      "args": ["mcp"],
      "disabled": false
    }
  }
}
```

Kiro steering cũng có `.kiro/steering/qmd.md`, yêu cầu Kiro dùng QMD để tra cứu
tài liệu trước khi tìm kiếm rộng trên filesystem.

## Bảo Trì

Chạy các lệnh này sau khi thêm, dịch, di chuyển hoặc xóa tài liệu:

```bash
qmd update
qmd status
```

Collection `profile-docs` nên bao gồm toàn bộ Markdown trong `docs/`, gồm cả
các bản dịch `*.vi.md`.

Sau khi thêm, di chuyển hoặc xóa tài liệu:

```bash
bun run docs:index
find docs -name '*.md' | wc -l   # phải bằng số file profile-docs trong docs:status
```

Chỉ search sau khi hai số khớp nhau.

## Ghép với RTK

Trong shell Kiro/Codex, prefix lệnh nặng bằng `rtk` (xem `.kiro/steering/rtk.md`):

```bash
rtk qmd search "trade setup confluence" -c profile-docs
```

`qmd search` (BM25) không cần model GGUF. Chỉ chạy `qmd embed` khi cần `qmd vsearch`.

# Thiết Lập QMD

QMD được cấu hình cho việc tìm kiếm tài liệu cục bộ đơn giản.

## Collection

- Tên: `profile-docs`
- Đường dẫn: `docs/`
- Mask: `**/*.md`
- Phạm vi: tài liệu nguồn tiếng Anh và bản dịch tiếng Việt `*.vi.md`.
- Context (gốc collection): harness Sui profile, btc-chart, Predict Club, Telegram
  Mini App, Turso, Convex, stories và ADR.

Kiểm tra nhanh:

```bash
bun run docs:status
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
bun run docs:index
bun run docs:status
```

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

Sau khi thêm tài liệu (`docs/telegram/`, `docs/decisions/`, `docs/stories/`),
chạy `bun run docs:index` trước khi search.

## Ghép với RTK

Trong shell Kiro/Codex, prefix lệnh nặng bằng `rtk` (xem `.kiro/steering/rtk.md`):

```bash
rtk qmd search "trade setup confluence" -c profile-docs
```

`qmd search` (BM25) không cần model GGUF. Chỉ chạy `qmd embed` khi cần `qmd vsearch`.

# Thiết Lập QMD

QMD được cấu hình cho việc tìm kiếm tài liệu cục bộ đơn giản.

## Collection

- Tên: `profile-docs`
- Đường dẫn: `docs/`
- Mask: `**/*.md`

## Các Lệnh Ưu Tiên

```bash
qmd search "plugin architecture" -c profile-docs
qmd get qmd://profile-docs/ARCHITECTURE.md
qmd update
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

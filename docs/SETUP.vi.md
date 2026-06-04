# Thiết Lập

Trang này ghi lại thiết lập cấp repo cho agent và cho việc tìm kiếm tài liệu
cục bộ.

## Agent Harness

Hãy đọc các tài liệu này trước khi bắt đầu công việc tài liệu hoặc triển khai:

1. `docs/README.md`
2. `docs/HARNESS.md`
3. `docs/FEATURE_INTAKE.md`
4. `docs/ARCHITECTURE.md`
5. `docs/TEST_MATRIX.md`

Hãy dùng nhất quán các thư mục sau:

- `docs/product/`: product truth ổn định.
- `docs/stories/`: scoped plan, story packet và roadmap slice.
- `docs/decisions/`: tradeoff bền vững và quyết định kiến trúc.
- `docs/templates/`: định dạng dùng lại cho story, decision và validation.

## RTK

RTK đã được cài đặt và cấu hình cho Codex.

```bash
rtk --version
rtk init -g --codex
rtk gain
```

Binary hiện đang quan sát được:

```text
/usr/local/bin/rtk
```

## QMD

QMD đã được cài đặt và cấu hình cho việc tìm kiếm tài liệu cục bộ đơn giản.

```bash
qmd --version
qmd collection list
qmd search "plugin architecture" -c profile-docs
qmd get qmd://profile-docs/ARCHITECTURE.md
qmd update
```

Collection hiện tại:

```text
profile-docs
Path: docs/
Mask: **/*.md
```

Dùng `qmd search` và `qmd get` cho công việc thông thường. Không chạy
`qmd query`, `qmd vsearch` hoặc `qmd embed` trừ khi tác vụ thực sự yêu cầu
model cục bộ.

## QMD MCP

Cấu hình global của Codex chứa:

```toml
[mcp_servers.qmd]
command = "qmd"
args = [ "mcp" ]
enabled = true
```

Công cụ MCP `query` mặc định sẽ rerank. Nếu dùng công cụ đó, hãy truyền
`rerank: false` để giữ thiết lập không phụ thuộc model. Với tra cứu docs thông
thường, ưu tiên CLI `qmd search`.

Khởi động lại Codex sau khi thay đổi `~/.codex/config.toml` để danh sách MCP
server được nạp lại.

## Chính Sách Mô Hình QMD

Các file model GGUF cache của QMD đã được xóa khỏi:

```text
~/.cache/qmd/models/
```

`qmd status` vẫn có thể hiển thị URL model mặc định từ upstream. Điều đó không
có nghĩa là model đang có sẵn cục bộ. Hãy kiểm tra thư mục cache nếu còn nghi
ngờ.

# Model mặc định: Composer 2.5

Cách đặt **grok-composer-2.5-fast** làm model mặc định cho Grok Build CLI,
subagent, worker headless, và session fork.

## Model ID

Chạy `grok models` để xem ID trên máy bạn. Ví dụ:

```text
Default model: grok-composer-2.5-fast

Available models:
  * grok-composer-2.5-fast (default)
  - grok-build
```

Dùng đúng slug từ lệnh trên. Không đoán `composer-2.5` thiếu prefix `grok-`
trừ khi catalog của bạn hiển thị khác.

## Mặc định toàn cục (`~/.grok/config.toml`)

```toml
[models]
default = "grok-composer-2.5-fast"

[ui]
fork_secondary_model = "grok-composer-2.5-fast"
```

| Key | Tác dụng |
| --- | --- |
| `[models].default` | Session TUI và headless mới (trừ khi bị ghi đè) |
| `[ui].fork_secondary_model` | Model khi fork session (`/fork`) |

Nếu `fork_secondary_model` vẫn là `grok-build`, fork có thể chuyển sang
`grok-build` dù `default` đã là Composer.

Kiểm tra:

```bash
grok models
```

## Mặc định theo repo (`.grok/config.toml`)

Ở root repository (ví dụ repo `profile`):

```toml
[models]
default = "grok-composer-2.5-fast"

[subagents.models]
explore = "grok-composer-2.5-fast"
general-purpose = "grok-composer-2.5-fast"
```

Thứ tự ưu tiên: `.grok/config.toml` (cwd) → repo root → `~/.grok/config.toml`.

## Subagent

Mặc định subagent kế thừa model của session cha. Để pin Composer:

```toml
[subagents.models]
explore = "grok-composer-2.5-fast"
plan = "grok-composer-2.5-fast"
```

## Headless và worker VPS

`[models].default` áp dụng cho nhiều lần chạy headless, nhưng script automation
nên chỉ rõ `-m`:

```bash
grok -p "Làm issue #42" \
  -m grok-composer-2.5-fast \
  --cwd /opt/repos/my-app \
  --yolo
```

Xem [TECHNICAL.vi.md](./TECHNICAL.vi.md) cho ví dụ worker.

## Session đang mở (TUI)

Session hiện tại giữ model cũ cho đến khi đổi:

```
/model grok-composer-2.5-fast
```

Phím tắt: `Ctrl+M` từ scrollback (không phải khi focus prompt), hoặc alias `/m`.

Mở mới: `/new` hoặc thoát và chạy lại `grok`.

## Agent mode (ACP / IDE stdio)

```bash
grok agent --model grok-composer-2.5-fast stdio
```

## Grok chat tích hợp trong Cursor IDE

**Panel Agent / Composer** trong Cursor dùng **cài đặt model của Cursor**, không
đọc `~/.grok/config.toml`. Chọn Composer 2.5 trong dropdown model hoặc Settings →
Models.

Xem [CURSOR-IDE.vi.md](./CURSOR-IDE.vi.md) cho sự khác nhau giữa Cursor và Grok CLI.

## Troubleshooting

| Triệu chứng | Cách sửa |
| --- | --- |
| Vẫn dùng `grok-build` | `grok models`; set `[models].default`; `/model` trong session |
| Fork sai model | Set `[ui].fork_secondary_model` |
| Worker VPS sai model | Thêm `-m grok-composer-2.5-fast` vào `grok -p` |
| Subagent dùng `grok-build` | Thêm `[subagents.models]` |
| Chat Cursor không phải Composer | Đổi model trong UI Cursor, không phải config Grok |

## Liên quan

- [CURSOR-IDE.vi.md](./CURSOR-IDE.vi.md)
- [TECHNICAL.vi.md](./TECHNICAL.vi.md)
- Tham chiếu local: `~/.grok/docs/user-guide/11-custom-models.md`
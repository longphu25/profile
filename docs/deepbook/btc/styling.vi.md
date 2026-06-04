# Styling & Design Discipline

## Design Tokens

Plugin dùng Shadow DOM nên mọi token phải được khai báo lại trong `:host`. Giá
trị được lấy từ TaskForm design system cộng với bảng màu đã khóa.

## Quy Tắc Accent Bị Khóa

Chỉ dùng 4 màu dữ liệu: `--up`, `--dn`, `--neu`, `--hi`. Không đưa các accent
orange / yellow / cyan / purple mặc định kiểu TradingView vào giao diện.

NWE upper/lower dùng tint của `--dn` / `--up` với alpha 0.6. VP buy/sell dùng
tint của `--up` / `--dn` với alpha 0.3-0.95 tùy tier POC/HVN/VA.

## Typography

- Pair, headline: Satoshi 700
- Numeric: JetBrains Mono
- Eyebrow / label: Satoshi 600 uppercase
- Status bar / status tags: JetBrains Mono 9-10px

## Kỷ Luật Không Dùng Emoji

Theo skill `design-taste-frontend`, mọi icon UI nên là SVG hoặc text. Plugin này
tránh emoji trong panel title, status bar và alert label. Một vài ký hiệu như
▲▼ vẫn chấp nhận được vì đó là directional arrow chuẩn.

## Kỷ Luật Layout

### Flex Panes

`min-height: 0` trên `__col` và cả ba pane là bắt buộc, nếu không flex children
sẽ không co lại đúng cách.

`.btc-chart` dùng `position: absolute; inset: 0` để thoát khỏi mount-point `<div>`
của ShadowContainer, vốn không cung cấp chiều cao ổn định.

JS không bao giờ set `el.style.height`; pixel height được cập nhật qua
`applyOptions({ height })` với `clientHeight` thực từ `ResizeObserver`.

### Page-level Cascade

Rule `.btc-page > div` là cầu nối để chiều cao từ viewport chảy xuống Shadow root.

## Ghost Borders

Không dùng viền đặc 1px quá đậm. Hầu hết viền dùng `--border` hoặc
`--border-strong`.

Ngoại lệ:
- Nút active dùng inset shadow thay cho border.
- Alert fired state dùng `border-left: 2px solid var(--mint)`.

## Spacing Rhythm

- Sidebar panel padding: `14px 16px`
- Row gap: `6px`
- Section title margin-bottom: `10px`

Không dùng `margin: auto` để căn giữa; dùng `align-items` / `justify-content`.

## Responsive

Ở màn nhỏ:
- sidebar hẹp lại
- dải OHLCV có thể bị ẩn
- body chuyển sang bố cục cột
- animation bị tắt khi `prefers-reduced-motion: reduce`

## Toast Positioning

Toast dùng `position: absolute` thay vì `fixed`, vì plugin chạy trong Shadow DOM
và `fixed` sẽ bám theo viewport thay vì shadow root.

## Anti-patterns Đã Tránh

- Toolbar với nhiều chấm màu gây nhiễu.
- ML label lặp hai lần.
- Emoji trong panel title.
- Bảng màu TradingView mặc định.
- Corner radii lẫn lộn.
- Drop shadow nặng tay.
- Dùng `useState` cho các giá trị cập nhật liên tục theo tick.

# Motion UI Cho Predict Club

Nguồn đã xem ngày 2026-06-10:

- Transitions.dev: <https://transitions.dev/>
- GitHub: <https://github.com/Jakubantalik/transitions.dev>

## Mục Đích

Dùng Transitions.dev làm thư viện tham chiếu cho product motion nhỏ, rõ nghĩa
trong Predict Club. Mục tiêu là giúp người dùng theo dõi state change dễ hơn,
không phải thêm animation trang trí.

Transitions.dev cung cấp các CSS transition snippet có thể copy cho các pattern
web app phổ biến và có agent skill tùy chọn:

```bash
npx skills add Jakubantalik/transitions.dev
```

Không thêm skill hoặc snippet được generate một cách máy móc. Hãy dùng các
pattern bên dưới làm chuẩn project, rồi chỉnh CSS theo design token hiện có.

## Nên Dùng Ở Đâu

| Khu vực UI Predict Club | Pattern Transitions.dev | Lý do |
|-------------------------|--------------------------|-------|
| Decision Strip price cells | Number pop-in / text states swap | Giúp spot, forward, expiry và confidence update rõ hơn mà không gây layout shift. |
| Wallet profile popup | Modal open/close | Giữ cảm giác popup gắn với wallet button. |
| Active Oracles panel | Panel reveal | Hiện oracle list như panel phụ có chủ đích, không biến UI thành nhiều block luôn mở. |
| Risk Checks details | Panel reveal / text states swap | Chỉ mở chi tiết khi người dùng cần. |
| Trade execution status | Notification badge / success check / error shake | Truyền đạt pending, confirmed và failed transaction state. |
| Funding route status | Icon swap / text states swap | Làm rõ thay đổi Ready, Blocked, Review và External. |
| Skeleton data load | Skeleton loader and reveal | Tránh nhảy UI đột ngột khi oracle, portfolio hoặc vault data về. |
| Tabs và segmented controls | Tabs sliding | Làm rõ mode đang active mà vẫn giữ UI gọn. |

## Quy Tắc Product

- Chỉ animate state change có ý nghĩa: price update, selected oracle, wallet
  connection, quote availability, risk gate, transaction status.
- Tránh animation trang trí lặp vô hạn, bounce quá mức hoặc motion cạnh tranh
  với số liệu giao dịch.
- Ưu tiên animate `transform` và `opacity`. Chỉ animate layout khi component cần
  làm rõ resize.
- Mọi snippet copy phải tôn trọng `prefers-reduced-motion: reduce`.
- Duration nên ngắn: thường `120ms` đến `240ms`; chỉ dùng `300ms` cho modal hoặc
  panel open/close.
- Giữ kích thước ổn định cho numeric cells, button, tabs, side panels và cards
  để tránh layout shift.
- Dùng motion để làm rõ hierarchy: dữ liệu quyết định chính trước, chi tiết phụ
  chỉ hiện sau expand/click.

## Cách Triển Khai

Khi copy từ Transitions.dev:

1. Chỉ copy CSS cần cho transition đã chọn.
2. Đổi tên class theo style component hoặc utility hiện có.
3. Thay màu, spacing và radius demo bằng design token của repo.
4. Giữ guard `prefers-reduced-motion`.
5. Với thay đổi Predict Club nhìn thấy được, verify desktop/mobile bằng
   Playwright hoặc browser screenshot.

Ưu tiên tạo wrapper/class nhỏ cho pattern dùng lại, thay vì rải transition
constant một lần khắp component.

## Bộ Motion Khuyến Nghị Cho Predict Club

Bắt đầu với bộ tối thiểu này:

- `pc-number-update`: number pop-in cho spot, forward, pledged DUSDC và payout.
- `pc-panel-reveal`: Active Oracles, Risk Checks details và wallet profile.
- `pc-status-swap`: quote unavailable/available, Ready/Blocked/Review, pending/done.
- `pc-success-check`: transaction hoàn tất hoặc risk gate được chấp nhận.
- `pc-error-shake`: validation error cho invalid amount, missing wallet hoặc stale quote.
- `pc-skeleton-reveal`: trạng thái loading oracle/vault/portfolio data.

Bộ này giữ app nhất quán và tránh mỗi panel dùng một ngôn ngữ animation khác.

## Use Case Predict Club

### Decision Strip

Chỉ dùng number pop-in khi giá trị thật sự thay đổi. Spot và forward nên nằm
trong ô số fixed-width, tabular để Decision Strip không bị xê dịch.

```text
BTC Spot updates -> short pop/fade
Forward updates -> short pop/fade
Expiry countdown -> text state swap, no bounce
Oracle freshness -> subtle text swap
```

### Quote Và Execution

Dùng text state swap cho vòng đời quote:

```text
Preview unavailable -> Pricing preview -> Contract quote ready -> Executing -> Confirmed
```

Với quote fail hoặc Move abort, dùng error shake tiết chế trên status block bị
ảnh hưởng và giữ error message dễ đọc.

### Wallet Profile

Dùng modal open/close cho profile popup. Feedback copy address nên dùng success
check hoặc text state swap, không cần toast cho từng thao tác copy.

## Hướng Dẫn Cho Agent

Khi agent được yêu cầu cải thiện độ polish của UI Predict Club:

1. Đọc file này trước khi thêm custom motion.
2. Dùng pattern Transitions.dev làm tham chiếu đầu tiên cho transition nhỏ.
3. Không thêm dependency animation lớn chỉ để làm các effect này.
4. Giữ snippet trong component CSS hoặc Tailwind-compatible utilities.
5. Verify reduced-motion và không-overlap trước khi trả lời cuối.

## Câu Hỏi Mở

- Có nên cài Transitions.dev agent skill global cho Codex/Kiro hay chỉ giữ như
  docs reference.
- Các motion utility dùng lại nên nằm trong shared Predict Club CSS module hay
  đặt gần từng component.
- App có cần user-level motion preference ngoài OS-level reduced-motion không.

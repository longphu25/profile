# Yêu Cầu Giao Diện Predict Club

Tài liệu này là contract UI ổn định cho Predict Club. Nó liệt kê các bề mặt,
trạng thái và quy tắc tương tác cần giữ trong lúc plugin chuyển từ dữ liệu demo
sang thực thi DeepBook Predict do ví ký.

## Mục Tiêu Sản Phẩm

Predict Club là cockpit vận hành cho các round Predict cộng đồng. Màn hình đầu
tiên phải giúp member mới trả lời nhanh năm câu hỏi:

1. Round này dùng market và oracle nào?
2. Direction, strike, expiry và pledged amount hiện tại là gì?
3. Chi phí, xác suất, payout và rủi ro của tôi là bao nhiêu?
4. Ví của tôi có thể execute ngay không?
5. Nếu chưa, bước nào đang chặn?

UI cần gọn, rõ và dễ scan. Đây không phải landing page marketing và không nên
giấu trạng thái sẵn sàng thực thi sau nhiều panel.

## Top Bar

Cần có:

- Brand: `PREDICT CLUB`.
- Navigation: `Clubs`, `Market`, `History`, `Leaderboard`.
- Network indicator, hiện tại là `Testnet`.
- Tóm tắt số dư `SUI`, `USDC` và `DUSDC`.
- Wallet icon trigger.
- Wallet address trigger khi đã kết nối.

Quy tắc:

- Khi đã kết nối, wallet icon và address mở wallet profile popup.
- Khi chưa kết nối, wallet control mở wallet connect.
- Disconnect nằm trong wallet profile popup, không nằm trực tiếp trên address
  button.
- Mọi address hoặc object id trong top bar phải copy được hoặc mở SuiScan qua
  shared address control.

## Decision Strip

Decision strip là phần tóm tắt round chính và nên nằm gần đầu trang.

Các ô bắt buộc:

- Asset: `BTC` kèm live spot price.
- Forward: giá forward từ DeepBook Predict.
- Direction: `ABOVE`, `BELOW` hoặc `RANGE`.
- Strike: một strike cho binary, lower/upper strike cho range.
- Expiry: countdown và freshness, ví dụ `Exp 16h 7m · 0s ago`.
- Pledged: tổng DUSDC đã pledged.
- Price ticks: số lượng tick và mini chart 24 tick gần nhất.
- Active Oracles: button/list đặt phía phải.

Quy tắc:

- DeepBook Oracle thuộc Decision Strip, không ẩn trong Risk Panel.
- Spot và forward nên dùng màu/kiểu dữ liệu tiền để nổi bật.
- Mini chart phải có kích thước ổn định và không làm layout nhảy khi có tick mới.
- Strip chỉ nên có một primary action theo phase hiện tại.

## Center: Prediction Room

Cần có:

- Header: `Prediction Room`, round id, phase và confidence.
- Signal evidence mặc định đóng.
- Khi mở, signal evidence chia thành ba cột gọn:
  - bằng chứng market và price
  - bằng chứng indicator
  - bằng chứng oracle và risk
- Luận điểm của leader và timestamp.
- Indicator consensus:
  - bias: `Bullish`, `Bearish`, `Neutral` hoặc `No-trade`
  - confidence: `High`, `Medium` hoặc `Low`
  - chỉ báo chính như RSI, order flow, box flip, trend và volatility
- Tóm tắt round: direction, strike/range, amount và trạng thái preview.

Quy tắc:

- Không nhồi funding và wallet details vào panel này.
- Nếu comments/activity gây nhiễu, đưa xuống history hoặc một phần activity
  compact.

## Left Panel: Club Và Members

Cần có:

- Club name.
- Dòng leader kèm role.
- Dòng member gồm:
  - tên hoặc short wallet
  - trạng thái: `Watching`, `Pledged`, `Accepted`, `Executed`, `Claimed`
  - pledged amount nếu có
- Dòng ví đang kết nối, ghi `You` nếu không match member đã biết.
- Club stats compact như member count, win rate và total pledged.

Quy tắc:

- Panel không nên dài vượt workspace nếu không có scroll nội bộ.
- Dòng current user cần dễ thấy nhưng không lấn trạng thái execution.

## Right Panel: Risk Và Execution

Các block bắt buộc:

- Risk Checks.
- Your Exposure.
- Contract Quote.
- Portfolio summary.
- Vault summary.

Quy tắc:

- Giữ `Risk Checks` là checklist readiness duy nhất. Không lặp lại bằng block
  `Ready to execute` riêng.
- Mọi blocked state phải có lý do cụ thể.
- Không hiển thị raw Move abort dài cho người dùng. Map thành message ngắn có
  thể hành động, giữ raw error cho debug output.

## Risk Checks

Các check bắt buộc:

- Wallet connected.
- PredictManager available.
- DUSDC balance enough.
- Oracle active.
- Price fresh.
- SVI fresh.
- Quote available.
- Vault liquidity enough.
- Expiry valid.

Trạng thái tổng hợp:

- `Ready`
- `Review`
- `Blocked`

## Your Exposure

Metric bắt buộc:

- Stake hoặc estimated cost.
- Win Probability.
- Indicative payout hoặc gross if win.
- Potential profit.
- Risk/Reward.

Quy tắc format:

- Giá trị DUSDC dùng tối đa 2 đến 4 chữ số thập phân tùy scale.
- Probability luôn nằm trong `0%` đến `100%`.
- Xác suất rất nhỏ dùng display floor như `<0.1%`.
- Không render raw number quá dài.
- Nếu thiếu SVI, forward, expiry hoặc quote, hiện `Preview unavailable` kèm lý
  do ngắn.

## Funding Router

Routes bắt buộc:

- Direct DUSDC.
- Escrow USDC sang DUSDC.
- Swap SUI sang USDC.
- Bridge to Sui.
- P2P Escrow Offers.

Mỗi route cần hiển thị:

- available amount
- status: `Ready`, `Available`, `Review`, `Blocked` hoặc `External`
- action button nếu dùng được
- disabled reason nếu bị chặn

Quy tắc:

- Route không phải Direct DUSDC vẫn là preview-only cho tới khi có tích hợp
  wallet-signed.
- Giữ panel gọn. Giải thích dài nên nằm trong modal hoặc docs.

## Escrow Offers

Field bắt buộc:

- provider
- amount
- asset pair
- status: `Open`, `Reserved`, `Filled` hoặc `Cancelled`
- action: `Fill`, `Cancel` hoặc disabled reason

Flow bắt buộc:

- create offer
- fill offer
- reserve hoặc mark filled
- cancel nếu là owner

Nếu escrow vẫn local/demo, phải ghi nhãn rõ.

## Portfolio Và Positions

Cần có:

- Open position count.
- Binary positions.
- Range positions.
- Direction.
- Strike hoặc range.
- Amount.
- Entry price hoặc contract price.
- Potential payout.
- Expiry.
- Status.
- Claimable hoặc settled state nếu có.

Quy tắc:

- Range positions không được biến mất im lặng. Nếu parse chưa đủ, hiển thị
  trạng thái unsupported rõ ràng và vẫn giữ row.

## Vault Summary

Cần có:

- available liquidity
- total liquidity nếu có
- max payout
- utilization
- wallet PLP balance
- wallet LP share

Quy tắc:

- Dùng `Unavailable` khi thiếu dữ liệu thật.
- Không dùng demo liquidity nếu không ghi rõ là demo/local.

## Wallet Profile Popup

Cần có:

- Active wallet address với copy và link SuiScan testnet.
- Account list.
- Token balances.
- PredictManager id/status.
- Manager DUSDC balance.
- Open positions.
- Vault context.
- Disconnect action.

Quy tắc performance:

- Chỉ mount khi mở.
- Không dùng `backdrop-filter` nặng full-screen.
- Cache wallet profile reads và chia sẻ in-flight request.
- Dùng cache khi public RPC trả `429 Too Many Requests`.

## Tương Tác Address

Mọi Sui account hoặc object id trên UI nên dùng shared address control:

- short display
- copy full value
- link SuiScan testnet
- tooltip hoặc accessible label cho icon-only action

Account URL:

```text
https://suiscan.xyz/testnet/account/<address>
```

Object URL:

```text
https://suiscan.xyz/testnet/object/<object-id>
```

## Loading Và Error States

Trạng thái bắt buộc:

- wallet disconnected
- wallet connecting
- RPC rate limited
- oracle API unavailable
- missing SVI
- missing forward
- stale oracle
- quote failed
- PredictManager unavailable
- vault unavailable
- no open positions
- no escrow offers

Quy tắc:

- Ưu tiên inline skeleton hoặc loading nhỏ.
- Tránh spinner lớn toàn trang sau lần load đầu.
- Error message cho người dùng phải ngắn và có thể hành động.

## Developer Guardrails

- Giữ `PredictClubContext.tsx` chỉ export component để Vite Fast Refresh ổn định.
- Đưa context object và types vào `PredictClubContextCore.ts`.
- Đưa hooks vào `usePredictClub.ts`.
- Chia sẻ Sui RPC reads qua context/services, không để từng panel tự fetch.
- Re-index CodeGraph sau thay đổi source lớn.
- Update QMD sau thay đổi docs.

## Validation Tối Thiểu

Trước khi xem một thay đổi UI là xong:

- `bun run build`
- Playwright test tập trung cho `predict-club.html`
- kiểm tra số wallet trigger
- kiểm tra popup mở được khi có wallet fixture
- không có page error nghiêm trọng
- docs được cập nhật khi behavior hoặc contract thay đổi

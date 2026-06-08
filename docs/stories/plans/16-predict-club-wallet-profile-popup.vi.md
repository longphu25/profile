# Kế Hoạch Mount Plugin Wallet Profile Cho Predict Club

## Mục Tiêu

Mount `plugins/sui-wallet-profile` vào Predict Club để member có thể click icon
ví hoặc connected wallet address và xem đầy đủ wallet/Predict profile trong một
popup. Plugin wallet profile nên sở hữu UI wallet profile có thể tái sử dụng,
còn Predict Club chỉ đóng góp các phần riêng của Predict như PredictManager,
positions và vault context.

Hướng này thay thế cách làm cũ là xây `WalletProfilePopup` riêng bên trong
Predict Club. Boundary hợp lý hơn là nâng cấp `sui-wallet-profile` thành
profile plugin có chế độ embedded và để Predict Club consume lại.

## Phạm Vi

Trong phạm vi:

- Nâng cấp `plugins/sui-wallet-profile` với dữ liệu profile đầy đủ hơn và
  embedded popup component.
- Mount `sui-wallet-profile` song song với `predict-club` trong host của
  Predict Club.
- Icon ví trên topbar và nút connected wallet address mở embedded wallet profile
  popup.
- Full Sui address trong wallet popup có thể copy.
- Wallet/account address có link SuiScan testnet.
- Predict Club publish Predict-specific wallet context cho popup: PredictManager,
  balances, portfolio counts, positions và vault summary.

Ngoài phạm vi:

- Refactor address renderer trên toàn repo cho các plugin không liên quan.
- Thêm Predict/DeepBook API calls mới ngoài các data đã có trong Predict Club
  context.
- Phá vỡ cách mount standalone hiện có của `SuiWalletProfile`.
- Chuyển đổi explorer mainnet. Story này mặc định dùng SuiScan testnet.

## Kiến Trúc Mục Tiêu

`sui-wallet-profile` nên expose hai chế độ sử dụng:

- `SuiWalletProfile`: standalone component tương thích ngược. Component này có
  thể giữ `DAppKitProvider` wrapper riêng khi được mount ngoài Sui-aware host.
- `SuiWalletProfile.Popup` hoặc `SuiWalletProfile.Embedded`: component không tạo
  provider mới, dùng trong host đã có Sui context.

Plugin nên giữ các wallet primitive ở một nơi:

- active address
- SuiNS name
- wallet name/icon nếu có
- network
- account list
- token balances
- copy address behavior
- SuiScan account/object links
- disconnect action

Predict Club nên cung cấp extension data theo domain qua host shared data, ví dụ:

```ts
host.setSharedData('predictClubWalletProfile', {
  manager,
  balances,
  binaryPositions,
  rangePositions,
  vault,
})
```

Embedded wallet profile có thể render extension này như một Predict section tùy
chọn. Nếu không có shared data, wallet profile popup vẫn hoạt động như generic
wallet profile.

## Trải Nghiệm Người Dùng

Trạng thái đã kết nối ví:

- Click icon ví mở popup `SuiWalletProfile`.
- Click wallet address mở cùng popup đó.
- Address button không disconnect trực tiếp nữa.
- Disconnect được đưa vào popup để tránh disconnect ngoài ý muốn.
- Popup đóng khi click backdrop, nút close hoặc phím Escape.

Trạng thái chưa kết nối ví:

- Click icon ví hoặc wallet button mở panel connect wallet hiện có.
- Nếu không phát hiện wallet extension, giữ empty state hiện có.

Hành vi address:

- Full Sui address được render qua copyable address control do
  `sui-wallet-profile` sở hữu.
- Click copy control copy full address, không copy shortened demo string.
- Wallet/account address hiện external-link icon tới:

```text
https://suiscan.xyz/testnet/account/<address>
```

Object id như PredictManager có thể dùng:

```text
https://suiscan.xyz/testnet/object/<object-id>
```

## Nội Dung Popup

Wallet header:

- Wallet name/icon nếu có.
- Active address với copy và SuiScan actions.
- SuiNS name nếu có.
- Network badge, mặc định là `testnet`.

Accounts:

- Dùng `host.getSuiContext().accounts` khi có.
- Nếu không có account list, fallback về active address.
- Mỗi account row hiện wallet name/icon, short address, copy action và SuiScan
  action.

Balances:

- Token list từ wallet profile plugin khi có.
- Predict Club có thể override hoặc annotate SUI, USDC và DUSDC balances từ
  `PredictClubContext.balances`.
- Hiện `Unavailable` thay vì fake value khi thiếu data.

Predict extension:

- PredictManager id/status.
- Manager DUSDC balance.
- Số lượng binary position.
- Số lượng RANGE position.
- Compact position list khi có.

Vault extension:

- Available liquidity.
- Total max payout.
- Total MTM.
- Available withdrawal.
- Wallet PLP balance và wallet LP share khi có.

Actions:

- Copy address.
- View wallet on SuiScan.
- Disconnect wallet.

## Kế Hoạch Triển Khai

1. Refactor `plugins/sui-wallet-profile` thành các layer có thể tái sử dụng:
   - provider-free `WalletProfileContent`
   - standalone wrapper giữ hành vi hiện có
   - shared address/copy/explorer helpers

2. Register embedded components từ plugin:
   - giữ `SuiWalletProfile`
   - thêm `SuiWalletProfile.Popup` hoặc `SuiWalletProfile.Embedded`
   - giữ nguyên style URLs để không phá flow load plugin hiện có

3. Mở rộng wallet profile data types:
   - thêm optional wallet metadata, account list và explorer helpers
   - giữ backward compatibility cho shared data `walletProfile`
   - thêm optional Predict extension data mà không làm wallet plugin phụ thuộc
     vào Predict Club internals

4. Load wallet profile plugin trong Predict Club:
   - React route: load `sui-wallet-profile` trước khi render popup content
   - static/orchestrated route: include plugin bundle cạnh `predict-club`
   - fail gracefully nếu embedded component không sẵn sàng

5. Cập nhật hành vi topbar Predict Club:
   - connected wallet icon mở profile popup
   - connected address button mở profile popup
   - disconnected controls giữ connect wallet behavior hiện có
   - disconnect chỉ nằm trong popup

6. Publish Predict Club wallet context:
   - manager status/id
   - member balances
   - binary và range position summaries
   - vault summary
   - field thiếu data phải hiện unavailable rõ ràng thay vì demo numbers

7. Cập nhật UI styling:
   - popup max width khoảng `420px`
   - mobile width `calc(100vw - 24px)`
   - scroll nội bộ cho DeepBook/Predict details dài
   - section divider thay vì nested cards
   - address row dùng icon button cho copy/external link

## Kế Hoạch Test

Unit/light tests:

- SuiScan account URL đúng chính xác
  `https://suiscan.xyz/testnet/account/<address>`.
- Object/manager SuiScan URL dùng `/object/<id>`.
- Copy action chỉ copy full Sui address hợp lệ.
- Embedded popup render mà không tạo provider thứ hai.
- Standalone `SuiWalletProfile` vẫn render được.

Playwright:

- Trên `/predict-club.html`, icon ví khi disconnected mở wallet connect panel.
- Với connected wallet fixture, icon ví mở profile popup.
- Với connected wallet fixture, wallet address button mở cùng popup.
- Popup hiện active address, balances, PredictManager status và vault context khi
  có data.
- SuiScan link có testnet URL đúng.
- Disconnect button gọi wallet disconnect và đưa topbar về `Connect Wallet`.

Regression:

- `rtk bun run build`
- `rtk bun run test:unit`
- `rtk bun run test:e2e` khi local server binding được cho phép

## Tiêu Chí Chấp Nhận

- Predict Club dùng `plugins/sui-wallet-profile` cho wallet popup thay vì sở hữu
  một implementation wallet profile trùng lặp.
- Người dùng mới có thể click icon/address và hiểu wallet status,
  PredictManager status, open positions và vault context mà không phải tìm qua
  nhiều panel.
- Copy address không bao giờ copy shortened/demo address.
- SuiScan links dùng testnet nhất quán.
- Flow connect wallet hiện có được giữ cho disconnected users.
- Hành vi standalone wallet profile plugin hiện có được giữ.

## Trạng Thái Triển Khai

- Trạng thái: đã triển khai phase 1
- Ưu tiên: cao cho Predict Club usability sau wallet/Predict pricing work
- Rủi ro: trung bình vì chạm vào wallet plugin boundaries, shared context và E2E
  behavior

Đã triển khai trong phase 1:

- `sui-wallet-profile` hiện register cả standalone và embedded popup components.
- Predict Club React/static routes load wallet profile plugin song song với
  `predict-club`.
- Connected wallet icon/address mở wallet profile thay vì disconnect trực tiếp.
- Predict Club publish wallet profile extension data qua
  `predictClubWalletProfile`.
- Wallet profile render copy full-address controls và SuiScan testnet
  account/object links.

# Trang DeepBook Predict Standalone Với Chart Trading

## Tóm Tắt

Tạo `deepbook-predict.html` như một trang DeepBook Predict độc lập, theo cùng
cấu trúc page-host như `btc-chart.html`.

Trang mới phải:
- nạp plugin `SuiDeepBookPredict` hiện có trong `ShadowContainer`
- nối ví Sui / DAppKit
- giữ nguyên các tuyến điều hướng hiện có
- cho phép click một mức giá hoặc kéo range trên chart để mở popup giao dịch
- sau khi kết nối ví, nạp vị thế hiện có và render overlay trên chart

## Cấu Trúc Trang

- `deepbook-predict.html`
- `src/deepbook-predict/main.tsx`
- `src/deepbook-predict/DeepBookPredictPage.tsx`
- `src/deepbook-predict/deepbook-predict.css`

Không thay đổi:
- `sui-deepbook-predict.html`
- `deepbook.html`
- `btc-chart.html`

## Wallet và Host Wiring

- dùng `DAppKitProvider`, `createDAppKit`, `SuiGrpcClient`
- default network: `testnet`
- hỗ trợ `mainnet`, `testnet`, `devnet`
- đăng ký các host action:
  - connect
  - disconnect
  - network switch
  - sign and execute tx
  - sign personal message

## Chart Popup Flow

- binary mode: click chart price → suy ra `UP/DOWN` → mở popup
- range mode: kéo dọc trên chart → suy ra lower/upper strike → mở popup
- popup gồm:
  - selected mode
  - strike hoặc range
  - spot
  - oracle expiry
  - DUSDC amount
  - fair value/probability preview
- cảnh báo cần ký ví
  - cancel / confirm

Confirm phải mint vị thế thật, không chỉ điền form.

## Existing Position Loading

- load sau khi ví kết nối
- tìm managers theo owner
- fetch binary positions
- fetch range mints/redeems
- net open ranges trước khi render
- filter theo selected oracle
- refresh sau khi mint thành công

## Test Plan

- build
- test overlay logic
- local dev checks cho các page chính
- manual QA disconnected
- manual QA connected
- manual QA range mode
- production preview

## Thứ Tự Triển Khai

1. thêm `deepbook-predict.html`
2. thêm các file `src/deepbook-predict/*`
3. update `vite.config.ts`
4. định nghĩa `ChartTradeDraft`
5. update `PredictPositionChart`
6. thêm `ChartTradePopup`
7. tách shared mint actions
8. nối popup vào Trade tab
9. refresh overlays
10. thêm test

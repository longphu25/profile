# DeepBook Suite Modular Refactor + Interactive Predict Chart

## Tóm Tắt

Refactor `deepbook.html` thành DeepBook Suite shell có thể tái sử dụng, đồng
thời tách plugin Predict lớn hiện tại thành các domain module nhỏ hơn và các
sub-plugin có thể tái sử dụng.

Mục tiêu chính:
- giữ `deepbook.html` là suite entry chính
- giữ `sui-deepbook-predict.html` hoạt động như focused demo
- thu gọn `plugins/sui-deepbook-predict/plugin.tsx` thành thin entry
- tách domain/data/chart/transaction logic dùng chung
- thêm chart-based position selection và minted-position overlays

## Kiến Trúc Mục Tiêu

Tách clean architecture cho `plugins/sui-deepbook-predict/`:
- `app/`
- `domain/`
- `data/`
- `application/`
- `presentation/`

Và tách shell của DeepBook Suite:
- `config/plugins.ts`
- `config/nav.ts`
- `DeepBookWorkspace`
- `DeepBookNav`
- `WalletBar`
- `RightRail`

## Các Thay Đổi Chính

### Suite Shell

- tách registry và nav groups khỏi `DeepBookSuite.tsx`
- tạo workspace component dùng lại được
- giữ wallet connection và signing ở host level
- không bỏ các standalone page hiện có

### Predict Plugin

- biến `plugin.tsx` thành minimal entry
- dời helper, constants, fetch logic và PTB builder ra module riêng
- để React panel chỉ còn render và dispatch intent

### Interactive Position Chart

- thêm `PredictPositionChart`
- chart click điền binary strike + suy ra `UP/DOWN`
- range drag điền lower/upper strikes
- overlay vị thế binary/range
- chart action chỉ là state selection

### Range-Aware Data

- thêm service merge dữ liệu từ manager summary + range minted/redeemed
- không dựa vào endpoint binary-only cho range
- hiển thị degraded state nếu dữ liệu range lỗi hoặc chậm

## Trình Tự Triển Khai

### Step 1 — Low-Risk Suite Extraction

Tách config/nav/workspace ra trước, giữ behavior y nguyên.

### Step 2 — Predict Domain/Data Extraction

Tách constants, SVI math, strike snapping, fair value, range netting, fetches.

### Step 3 — Thin Predict Plugin Entry

Chuyển React root vào `PredictPluginRoot.tsx`, tab config vào `predictTabs.ts`.

### Step 4 — Interactive Predict Chart

Thêm chart, overlay và usePositionOverlays.

### Step 5 — Optional Sub-Plugin Split

Chỉ tách thành sub-plugin sau khi root plugin ổn định.

## Test Plan

- `deepbook.html` vẫn load được
- focused Predict page vẫn render
- build production vẫn resolve đúng plugin path
- chart click và range drag cập nhật state đúng
- overlay không double-count range đã redeem
- degraded state rõ ràng

## Backlog

P0:
- visual QA chart
- degraded/stale data state
- regression checklist

P1:
- tách thêm panel khỏi `PredictPluginRoot`
- nâng test coverage
- tách transaction builders khỏi UI handlers

P2:
- render-time polish
- read-only overlay trong Portfolio
- clean architecture cleanup
- docs về commit rhythm

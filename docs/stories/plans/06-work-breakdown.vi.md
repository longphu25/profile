# Phân Rã Công Việc

## Phase 0 - Documentation and Alignment

- giữ `docs/stories/plans/README.md` làm planning index
- giữ source-specific docs trong `docs/deepbook/` và `docs/deepbook/predict/`
- quyết định `deepbook.html` có trở thành entry chính hay không
- chốt build target đầu tiên

## Phase 1 - DeepBook Suite Shell

- tạo `deepbook.html`
- tạo `src/deepbook/main.tsx`
- tạo `src/deepbook/DeepBookSuite.tsx`
- tái sử dụng `SuiHostAPI`, wallet context, plugin loader và `ShadowContainer`
- thêm grouped navigation
- lazy-load plugin DeepBook hiện có

## Phase 2 - Mission Control and Recommended Actions

- thêm DeepBook Mission Control
- hiển thị wallet state, network, global status
- thêm recommended next action rules
- thêm status badges

## Phase 3 - Predict UX Upgrade

- thêm Action Hub cho Predict
- thêm guided trade flow
- thêm safety strip
- đơn giản hóa tab hierarchy

## Phase 4 - Gamification

- thêm Quest Board
- thêm local/session mission state
- thêm daily quest, achievement, leaderboard

## Phase 5 - Trend Predict

- thêm Trend Predict Lab
- thêm fetch/input candle path
- triển khai các rule MA/ROC
- map signal sang oracle/expiry/strike
- thêm ngôn ngữ rủi ro

## Phase 6 - Commander TaskOS

- thêm Commander profile
- thêm command input
- thêm mission/task model
- thêm task stepper và approval preview
- thêm capability registry

## Phase 7 - Verification

- chạy `rtk bun run build`
- manual test trên các entry page chính

## Acceptance

Mỗi phase đều có acceptance riêng trong file gốc; mục tiêu chung là không phá
trang cũ, giữ wallet flow đúng, và giữ plugin CSS cô lập trong Shadow DOM.

# Project Overview

## Mục tiêu repo

Repo này không phải một app đơn lẻ. Đây là một workspace React/Vite dùng để:

1. Chạy landing/portfolio cá nhân ở `index.html`
2. Thử nghiệm plugin architecture với `HostAPI` + `Shadow DOM`
3. Dựng một Sui dashboard nơi nhiều plugin cùng dùng chung wallet context
4. Gom các proof-of-concept về DeepBook, NAVI, Seal, Walrus và WASM vào cùng một codebase

Nói ngắn gọn: đây là một **plugin playground kiêm sản phẩm demo Web3 trên Sui**.

## Ba lớp chính của hệ thống

### 1. Portfolio shell

- Entry: [[runtime-entry-points#Index Portfolio]]
- Code chính: `src/main.tsx` -> `src/Portfolio.tsx`
- Vai trò: landing page cá nhân, không phụ thuộc plugin runtime

### 2. Generic plugin runtime

- Tài liệu chi tiết: [[plugin-architecture]]
- Code chính: `src/plugins/*`, `src/plugin-demo/*`
- Vai trò: chứng minh cơ chế load plugin động bằng `import()`, registry component, và style isolation bằng `Shadow DOM`
- Đây là lớp nền cho toàn bộ tư duy kiến trúc của repo

### 3. Sui-specific plugin runtime

- Tài liệu chi tiết: [[plugin-architecture-wasm]], [[plugin-sui-wallet]]
- Code chính: `src/sui-dashboard/*`, `src/sui-wasm/*`
- Vai trò: thêm shared wallet context, network state, sign transaction/message, và shared data store cho các plugin Sui
- Đây là nơi hầu hết plugin feature thật đang chạy

## Các domain feature lớn

- [[plugin-catalog]]: nhóm Wallet & Core
- [[plugin-catalog]]: nhóm DeepBook Trading
- [[plugin-catalog]]: nhóm NAVI Protocol
- [[plugin-catalog]]: nhóm Seal Encryption
- [[plugin-catalog]]: nhóm Walrus Storage

## Điều đáng chú ý khi đọc repo

- `src/App.tsx` và `src/App.css` vẫn còn từ scaffold Vite, nhưng không phải entry chính hiện tại
- `src/app/main.tsx` là một placeholder page rất mỏng, chủ yếu phục vụ entry `app.html`
- `plugins/` mới là nơi chứa business features; `src/plugins/` chỉ là framework/runtime
- `docs/` đã có rất nhiều deep-dive theo feature; vault mới này bổ sung lớp tổng quan cấp dự án

## Nên đọc theo thứ tự nào

1. [[repo-map]]
2. [[runtime-entry-points]]
3. [[plugin-architecture]]
4. [[plugin-catalog]]
5. [[development-workflow]]

Sau đó mới đi sâu vào từng cụm:

- DeepBook: [[deepbook/README]]
- NAVI: [[defi/navi/TECHNICAL]]
- Seal: [[seal/TECHNICAL]]
- Walrus: [[walrus/integration]]

## Quick facts

- Build tool: Vite multi-entry
- UI stack: React 19 + TypeScript + Tailwind v4 + custom CSS per plugin
- Blockchain stack: `@mysten/sui`, `@mysten/dapp-kit-react`, DeepBook, Seal, Walrus, Payment Kit
- Plugin style isolation: `ShadowContainer` + per-plugin `style.css`
- Runtime plugin loading: dynamic `import()` với cache-busting query
- Production build có bước copy plugin CSS và WASM package vào `dist/plugins/*`

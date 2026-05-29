# Repo Map

## Top-level structure

```text
.
├── src/                     # Host apps, runtime framework, entry-specific UIs
├── plugins/                 # Từng plugin độc lập, build thành entry riêng
├── docs/                    # Obsidian vault + tài liệu kỹ thuật theo feature
├── public/                  # Static assets public
├── scripts/                 # Scaffolding plugin
├── index.html               # Portfolio entry
├── plugin-demo.html         # Generic plugin demo entry
├── sui-plugin.html          # Shared Sui dashboard entry
├── sui-plugin-wasm.html     # WASM-focused dashboard entry
├── sui-deepbook-hedging-bot.html
└── vite.config.ts           # Multi-entry build + asset copy logic
```

## `src/` là gì

### `src/plugins/`

Framework lõi cho plugin runtime:

- `types.ts`: contract `HostAPI` và `Plugin`
- `host.ts`: component registry
- `loader.ts`: dynamic loader với cache-busting
- `ShadowContainer.tsx`: render plugin trong Shadow DOM
- `PluginRenderer.tsx`, `usePlugin.ts`: helper cho host UI

Đây là phần "kernel", không chứa feature business.

### `src/plugin-demo/`

Trang demo tối giản để load/unload plugin generic và Sui plugin ở chế độ standalone.

### `src/sui-dashboard/`

Lớp runtime quan trọng nhất cho plugin Sui:

- quản lý `DAppKitProvider`
- giữ shared wallet/network context
- expose action hooks như connect, disconnect, switch network, sign transaction
- cung cấp shared data store giữa các plugin

### `src/sui-wasm/`

Biến thể dashboard tập trung vào plugin dùng WASM hoặc WASM-grade libraries.

### `src/sui-deepbook-hedging-bot/`

Một page chuyên biệt cho hedging bot, tách khỏi dashboard tổng.

### `src/main.tsx` và `src/Portfolio.tsx`

Đây là landing page thật đang chạy ở `index.html`.

### `src/App.tsx`

Scaffold cũ của Vite. Hữu ích như tham chiếu hoặc sandbox nhỏ, nhưng không phải flow chính.

## `plugins/` là gì

Mỗi thư mục con trong `plugins/` là một module độc lập, thường có:

```text
plugins/<plugin-name>/
├── plugin.tsx
└── style.css
```

Một số plugin phức tạp có thêm:

- helper components
- hooks
- config
- analysis engine
- `pkg/` hoặc `wasm/` cho trường hợp liên quan WASM

Đây là nơi business logic thật sống.

## `docs/` là gì

`docs/` đã hoạt động như một Obsidian vault:

- note root-level cho kiến trúc chung
- note theo domain: `deepbook/`, `defi/navi/`, `seal/`, `walrus/`
- canvas file để vẽ sơ đồ kiến trúc

Bộ note mới này đóng vai trò "map of maps" để người mới không bị lạc.

## `scripts/` là gì

- `create-plugin.mjs`: scaffold plugin generic
- `create-sui-plugin.mjs`: scaffold Sui plugin chạy được ở cả demo standalone lẫn shared dashboard

## `public/` và binary assets

- `public/favicon.svg`, `public/icons.svg`: asset UI
- `public/wasm/navi-analysis.wasm`: binary asset public cho luồng WASM

## Thư mục nào đáng ưu tiên khi onboarding

1. `vite.config.ts`
2. `src/plugins/`
3. `src/sui-dashboard/`
4. `plugins/`
5. `docs/`

## Anti-confusion notes

- `plugins/sui-seal-shared/` là shared config/utilities, không phải plugin runtime độc lập
- không phải mọi plugin trong `plugins/` đều được đăng ký trên mọi dashboard
- registration xảy ra ở nhiều nơi: `PluginDemoApp`, `SuiDashboard`, `SuiWasmDashboard`, và `vite.config.ts`

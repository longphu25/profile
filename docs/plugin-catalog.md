# Plugin Catalog

## Tổng quan

Hiện có `36` thư mục trong `plugins/`:

- `35` plugin có thể chạy
- `1` thư mục shared utility: `sui-seal-shared`

Danh mục bên dưới ưu tiên góc nhìn onboarding: plugin nào thuộc domain nào, nên đọc tài liệu nào tiếp theo.

## Wallet & Core

| Plugin | Vai trò |
|---|---|
| `hello-plugin` | plugin mẫu generic, dùng để hiểu contract cơ bản |
| `hello-world-sui` | faucet demo cho Sui |
| `sui-wallet` | ví cơ bản: balances và transactions |
| `sui-wallet-profile` | wallet profile standalone/embedded, token list, network selector, SuiNS, shared wallet data cho host như Predict Club |
| `sui-link` | liên kết ví/cross-chain style flows |
| `sui-dual-wallet` | kết nối và so sánh 2 ví cùng lúc |
| `sui-create-wallet` | tạo ví Secp256k1, liên quan `@noble/*` |

## DeepBook Trading

Tài liệu nền: [[deepbook/README]], [[deepbook/plugins]], [[deepbook/api-reference]], [[deepbook-plugins]]

| Plugin | Vai trò |
|---|---|
| `sui-pool-explorer` | duyệt pool DeepBook v3 |
| `sui-price-feed` | giá realtime và mini-chart |
| `sui-deepbook-orderbook` | orderbook level 2 và depth |
| `sui-swap` | trade/swap qua DeepBook |
| `sui-deepbook-portfolio` | portfolio, margin, collateral |
| `sui-deepbook-history` | lịch sử trade |
| `sui-margin-manager` | theo dõi vị thế margin |
| `sui-hedging-monitor` | monitor hedging bot |
| `sui-deepbook-hedging-bot` | bot hedging client-side, plugin lớn nhất repo |
| `sui-deepbook-analysis` | phân tích market, indicator, trend |

## NAVI Protocol

Tài liệu nền: [[defi/navi/TECHNICAL]], [[defi/navi/ADVISOR]], [[defi/navi/MCP-REFERENCE]], [[defi/navi/EXPANSION]]

| Plugin | Vai trò |
|---|---|
| `sui-navi-dashboard` | dashboard tổng cho protocol, pools, portfolio |
| `sui-navi-advisor` | advisor chiến lược yield |
| `sui-navi-chatbot` | giao diện chat cho DeFi advisor qua MCP |
| `sui-navi-analysis` | analysis engine, có Rust/WASM source đi kèm |

## Seal Encryption

Tài liệu nền: [[seal/TECHNICAL]], [[seal/PLAN]], [[seal/VOTING]]

| Plugin | Vai trò |
|---|---|
| `sui-seal-encrypt` | encrypt generic |
| `sui-seal-decrypt` | decrypt generic |
| `sui-seal-vault` | secret manager/vault |
| `sui-seal-private` | private data flows |
| `sui-seal-timelock` | timelock release |
| `sui-seal-allowlist` | allowlist-based access |
| `sui-seal-walrus` | Seal kết hợp Walrus |
| `sui-seal-voting` | sealed voting, kèm Move file |
| `sui-seal-shared` | shared config/utilities, không phải plugin mount độc lập |

## Walrus Storage

Tài liệu nền: [[walrus/integration]], [[walrus/dev-notes]], [[walrus/viewer-roadmap]], [[walrus/bug-log]]

| Plugin | Vai trò |
|---|---|
| `sui-walrus-upload` | upload file lên Walrus |
| `sui-walrus-viewer` | xem nội dung lưu trên Walrus |
| `sui-walrus-earn` | trải nghiệm liên quan earning/yield trên Walrus |

## Payments & Other Sui Utilities

| Plugin | Vai trò |
|---|---|
| `sui-payment` | flow payment trên Sui |
| `sui-lending` | lending market qua Scallop |
| `sui-wal-swap` | swap flow có liên hệ WAL |

## Plugin nào nên đọc đầu tiên

Nếu muốn hiểu nhanh toàn repo:

1. `hello-plugin`
2. `hello-world-sui`
3. `sui-wallet`
4. `sui-wallet-profile`
5. `sui-deepbook-hedging-bot`

## Plugin có dấu hiệu complexity cao

- `sui-deepbook-hedging-bot`: có `components/`, `hooks/`, `services/`, `strategies/`, `ARCHITECTURE.md`
- `sui-wallet-profile`: tách nhiều component con, có hướng standalone/embedded popup và shared data integration cho host
- `sui-walrus-upload`: nhiều step UI và config riêng
- `sui-navi-analysis`: có Rust/WASM source tại `plugins/sui-navi-analysis/wasm/`
- `sui-seal-voting`: có Move file `voting_seal.move`

## Quy ước chung của plugin

Phần lớn plugin tuân theo mẫu:

```ts
const PluginObject = {
  name: 'PluginName',
  version: '1.0.0',
  styleUrls: ['/plugins/my-plugin/style.css'],
  init(host) {
    host.registerComponent('PluginName', Component)
  },
}
```

Ở shared Sui runtime, `host` thường là `SuiHostAPI` thay vì `HostAPI` thuần.

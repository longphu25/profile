# RPC, CORS, WebSocket & Wallet Connect — Predict Club

> Cách xử lý kết nối on-chain trong môi trường browser, và lý do các fix gần đây.

## Triệu chứng (console flood)

```
Access to fetch at 'https://fullnode.testnet.sui.io/' has been blocked by CORS policy
fullnode.testnet.sui.io/:1  Failed to load resource: net::ERR_FAILED   (lặp vô hạn)
WebSocket connection to 'wss://fullnode.testnet.sui.io/' failed     (reconnect mỗi 5s)
Skipping wallet initializer: "Error: Registration un-successful."
```

## Nguyên nhân gốc

1. **CORS** — `fullnode.testnet.sui.io` (public fullnode) KHÔNG gửi header
   `Access-Control-Allow-Origin`. Mọi `fetch` JSON-RPC trực tiếp từ browser bị chặn.
2. **WebSocket bị khai tử** — Sui đã bỏ `suix_subscribeEvent` trên public fullnode.
   WS luôn fail → reconnect vô hạn mỗi 5s.
3. **Không có circuit breaker** — mỗi render/poll lại gọi endpoint chết → flood.
4. **Slush web wallet** — initializer cố đăng ký Slush, fail khi API không reachable.

## Cách các app production xử lý (crash.suize.io, predict.magicdima.xyz)

- Dùng **RPC endpoint CORS-friendly** hoặc **proxy backend riêng** (không gọi thẳng
  public fullnode từ browser).
- **Bỏ WebSocket subscription**, thay bằng polling (interval) hoặc indexer API riêng.
- **Wallet connect**: dùng wallet extension qua Wallet Standard (Suiet, Sui Wallet,
  Slush extension), KHÔNG bật Slush web wallet initializer trừ khi có cấu hình hợp lệ.

## Fix đã áp dụng

### 1. Circuit breaker (`infrastructure/rpcCache.ts`)
- TTL cache + request coalescing (dedupe in-flight).
- Sau 3 lần fail liên tiếp → breaker OPEN 30s, chặn mọi call tới endpoint đó.
- Half-open sau 30s: cho 1 probe. Thành công → reset.
- `isEndpointDown(url)` để caller kiểm tra trước.

### 2. WebSocket (`infrastructure/deepbookOracleService.ts`)
- WS chỉ bật khi có `TESTNET_WS_URL` (opt-in qua env). Mặc định `null` → KHÔNG kết nối.
- Nếu bật: exponential backoff (5s → 10s → 20s → 30s cap), tối đa 5 lần rồi dừng.
- REST polling (60s, hoặc 3s khi quick round) vẫn cập nhật dữ liệu.

### 3. Endpoint tập trung (`src/constants/predict-club.ts`)
```ts
export const TESTNET_RPC_URL =
  import.meta.env.VITE_TESTNET_RPC_URL ?? 'https://fullnode.testnet.sui.io:443'
export const TESTNET_WS_URL =
  import.meta.env.VITE_TESTNET_WS_URL ?? null
```
- Override bằng env khi có proxy/endpoint CORS-friendly.

### 4. Wallet (`plugins/sui-wallet-profile/plugin.tsx`)
- `slushWalletConfig: null` → tắt Slush web initializer, hết warning.
- Wallet connect dùng extension qua dApp-kit (Wallet Standard).

## Khuyến nghị tiếp theo (cần hạ tầng)

Để dữ liệu on-chain thật sự hoạt động trong browser, cần MỘT trong các phương án:

| Phương án | Mô tả | Effort |
|-----------|-------|--------|
| **A. Vite dev proxy** | Proxy `/rpc` → fullnode trong `vite.config.ts` (chỉ dev) | Thấp |
| **B. RPC CORS-friendly** | Dùng provider hỗ trợ CORS (Blockvision, Shinami, Ankr...) | Thấp |
| **C. Backend proxy** | API riêng forward RPC + cache server-side | Trung bình |
| **D. Indexer riêng** | Backend index event thay cho WS subscription | Cao |

Khuyến nghị: **B cho production** (set `VITE_TESTNET_RPC_URL`), **A cho dev**.

**Đã wire sẵn phương án A**: `vite.config.ts` có proxy `/api/sui-testnet` →
`fullnode.testnet.sui.io`, và `TESTNET_RPC_URL` mặc định dùng proxy này trong dev
(`import.meta.env.DEV`). Không cần cấu hình thêm để hết CORS khi chạy `npm run dev`.

### Ví dụ Vite dev proxy (phương án A)
```ts
// vite.config.ts
server: {
  proxy: {
    '/sui-rpc': {
      target: 'https://fullnode.testnet.sui.io',
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/sui-rpc/, ''),
    },
  },
}
// rồi set VITE_TESTNET_RPC_URL=/sui-rpc
```

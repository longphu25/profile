# BTC Chart — Tầng Tính Toán WASM

## Tóm tắt — WASM đã hỗ trợ đa khung thời gian chưa?

**Chưa, và cũng không cần.** Module WASM **không phụ thuộc khung thời gian**
(timeframe-agnostic). Nó nhận vào một mảng nến và tính toán trên đó — hoàn toàn
không biết mảng nến đó thuộc khung nào. Toàn bộ logic đa khung (fetch khung cao
hơn, map `1h → 4h`, dựng trading range) nằm ở tầng **TypeScript**
(`lib/liquidity.ts`), không nằm trong Rust.

Vì vậy "cập nhật WASM cho đa khung" không phải việc cần làm: truyền nến 1h hay
nến 4h vào `compute_smc` / `compute_nwe` đều chạy sẵn — bên gọi chỉ việc đưa vào
mảng nến của khung mình muốn phân tích.

## WASM thực sự làm gì

Module Rust (`plugins/btc-chart/wasm/src/lib.rs`) export đúng hai phép tính nặng
ở hot-path, vốn là O(n²) hoặc nhiều vòng pivot khi viết bằng JS:

| Export | Mục đích | Vì sao dùng WASM |
|--------|----------|------------------|
| `compute_smc(candles, cfg)` | Smart Money Concepts: đường cấu trúc BOS/CHoCH, Order Block, Fair Value Gap | Dò pivot + quét cấu trúc trên toàn chuỗi |
| `compute_nwe(candles, cfg)` | Nadaraya-Watson Envelope (LuxAlgo) — đường giữa + dải trên/dưới | Trọng số kernel Gaussian O(n²) |

Mọi thứ còn lại (RSI, MACD, ADX, VWAP, Boucher, Lien, ICT sessions, Liquidity)
là TypeScript thuần — chúng O(n) một lượt, không đáng để round-trip qua WASM.

## Struct cấu hình (Rust ↔ TS, đổi tên qua serde)

```rust
struct SmcConfig {
    structure: bool,
    order_blocks: bool,   // serde: "orderBlocks"
    fvg: bool,
    swing_len: usize,     // serde: "swingLen"
    internal_len: usize,  // serde: "internalLen" (parse nhưng chưa dùng)
}

struct NweConfig {
    bandwidth: f64,
    multiplier: f64,
    repaint: bool,
    max_bars_back: usize, // serde: "maxBarsBack", mặc định 500
}
```

Struct kết quả (`SmcResult { structures, orderBlocks, fvgs }`,
`NweResult { ... }`) được serialize về JS qua `serde-wasm-bindgen`. Bản TS tương
ứng nằm ở `smc.ts` và `lib/nadaraya-watson.ts`.

## Không phụ thuộc khung — ví dụ thực tế

Chữ ký `compute_smc` chỉ là `(candles, cfg)`. Interval không bao giờ là tham số.
Feature Liquidity dựa đúng vào điều này: nó gọi `computeSMC` **một lần** trên nến
khung hiện tại để lấy FVG/BOS, rồi `computeLiquidity` (TS thuần) neo trading
range trên nến **khung cao hơn** được fetch riêng:

```
ChartHeader interval = 1h
   │
   ├─ useKlines(symbol, '1h')   → nến khung hiện tại → compute_smc(...)  [WASM]
   └─ useKlines(symbol, '4h')   → nến HTF (HTF_MAP['1h'] = '4h')
                                        │
                                        ▼
             computeLiquidity(current, htf, smc, '1h')   [TS thuần, không WASM]
```

Vì hai lệnh `useKlines` key theo interval khác nhau, React Query tự cache riêng
— không cần thêm hạ tầng fetch mới. `HTF_MAP` (trong `lib/liquidity.ts`):
`1m→15m, 5m→1h, 15m→1h, 1h→4h, 4h→1d, 1d→null`.

## Nạp module + fallback an toàn

`smc-wasm.ts` là cầu nối. `initSmcWasm()` được gọi một lần lúc mount plugin và
**không chặn** (non-blocking):

1. `import()` động file glue của wasm-pack tại
   `/plugins/btc-chart/pkg/btc_chart_wasm.js`.
2. Instantiate `btc_chart_wasm_bg.wasm`.
3. Thành công → `computeSMC` / `computeNadarayaWatson` chạy qua WASM.
4. Lỗi bất kỳ → tự động fallback về JS thuần `computeSMC` (`smc.ts`) và
   `calcNadarayaWatson` (`lib/nadaraya-watson.ts`). Cùng chữ ký nên bên gọi không
   phải rẽ nhánh.

Nghĩa là plugin vẫn chạy kể cả khi thiếu artifact `pkg/` — chỉ chậm hơn ở SMC/NWE.

## Build

```bash
cd plugins/btc-chart/wasm
./build.sh        # cargo test --release, rồi wasm-pack build --target web
```

Cần `cargo`, `wasm-pack`, và target `wasm32-unknown-unknown`. Output ra
`plugins/btc-chart/pkg/` (Vite phục vụ tại `/plugins/btc-chart/pkg/`). Build chạy
unit test Rust trước (`cargo test`), nên kernel hỏng sẽ fail build trước khi ship.

## Khi nào nên thêm vào WASM

Chỉ thêm export Rust khi phép tính **vừa** ở hot-path (chạy mỗi lần render / mỗi
nến đóng) **vừa** siêu tuyến tính (O(n²) hoặc nhiều vòng pivot) khi viết JS. NWE
đủ điều kiện (kernel Gaussian). ICT sessions, Liquidity và dò sweep đều O(n) một
lượt — giữ ở TS.

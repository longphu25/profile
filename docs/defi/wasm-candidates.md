# WASM Candidates — Plugin Functions for Rust/WASM Acceleration

> Phân tích tất cả plugins, liệt kê hàm có thể chuyển sang Rust WASM
> để tăng performance. Chỉ liệt kê hàm CPU-bound, pure computation, không I/O.

## Tiêu chí đánh giá

| Tiêu chí | Giải thích |
|----------|------------|
| ✅ Pure function | Không side effects, không DOM, không fetch |
| ✅ CPU-bound | Loop qua data lớn, toán nhiều |
| ✅ Gọi thường xuyên | Hot path — gọi mỗi keystroke hoặc mỗi tick |
| ❌ I/O bound | fetch, WebSocket, localStorage → giữ JS |
| ❌ Quá nhẹ | Format string đơn giản → overhead bridge > benefit |

---

## 1. `sui-swap` ✅ (ĐÃ TRIỂN KHAI)

| Hàm | Mô tả | Data size | Priority |
|-----|--------|-----------|----------|
| `simulateMarketOrder()` | Loop orderbook levels, tính fill/impact | 100-500 levels | HIGH ✅ |
| `rankQuotes()` | Weighted scoring + sort quotes | 5+ quotes | MEDIUM ✅ |

**Status:** Đã có Rust crate tại `plugins/sui-swap/wasm/`

---

## 2. `btc-chart` — Smart Money Concepts

| Hàm | File | Mô tả | Data size | Priority |
|-----|------|--------|-----------|----------|
| `detectPivots()` | `smc.ts` | O(n × swingLen) nested loop qua candles | 500-2000 candles | **HIGH** |
| `computeSMC()` | `smc.ts` | Full SMC: structures + order blocks + FVGs | 500-2000 candles | **HIGH** |

**Lý do:** 224 dòng thuần toán trên arrays. Với 2000 candles × swingLen=5, đây là O(10000) operations mỗi lần render chart. WASM sẽ nhanh 5-10x.

---

## 3. `predict-club` — Indicator Signals

| Hàm | File | Mô tả | Data size | Priority |
|-----|------|--------|-----------|----------|
| `computeMA()` | `indicatorSignalGateway.ts` | Moving average (short + long) | 20+ prices | MEDIUM |
| `computeRSI()` | `indicatorSignalGateway.ts` | RSI calculation (gains/losses) | 14+ prices | MEDIUM |
| `computeOrderFlowDelta()` | `indicatorSignalGateway.ts` | Momentum delta over ticks | 10 ticks | LOW |
| `computeBasis()` | `indicatorSignalGateway.ts` | Basis = forward - spot | 1 price | LOW |
| `computeConsensus()` | `domain/indicatorConsensus.ts` | Count + rank indicators | 5-10 indicators | LOW |
| `deriveSignalsFromPrices()` | `indicatorSignalGateway.ts` | Orchestrator: MA + RSI + flow + basis | 50+ prices | **HIGH** (batches all above) |

**Lý do:** `deriveSignalsFromPrices` gọi liên tục mỗi oracle tick (WebSocket). Batch tất cả indicator computations vào 1 WASM call sẽ giảm GC pressure và tăng throughput.

---

## 4. `sui-deepbook-orderbook` — Orderbook Parsing

| Hàm | File | Mô tả | Data size | Priority |
|-----|------|--------|-----------|----------|
| `parseLevels()` | `plugin.tsx` | Parse raw [string, string][] → Level[] | 50-200 levels | MEDIUM |

**Lý do:** Gọi mỗi orderbook refresh (1-5s). Parsing + number conversion trên 200 levels.

---

## 5. `sui-wal-swap` — WAL Swap

| Hàm | File | Mô tả | Data size | Priority |
|-----|------|--------|-----------|----------|
| `estimateOutput()` | `plugin.tsx` | Giống simulateMarketOrder | 50-200 levels | HIGH |

**Lý do:** Cùng logic với sui-swap. Có thể share WASM module.

---

## 6. `sui-zk-merkle` ✅ (ĐÃ CÓ WASM)

| Hàm | File | Mô tả | Priority |
|-----|------|--------|----------|
| `verify_proof()` | WASM module | ZK proof verification | HIGH ✅ |

**Status:** Đã dùng WASM.

---

## 7. `polymarket` ✅ (ĐÃ CÓ WASM)

**Status:** Đã có `initWasm()` — WASM module loaded.

---

## 8. `sui-navi-analysis` ✅ (ĐÃ CÓ WASM)

**Status:** Đã có `initWasm()`.

---

## Tổng hợp: Ưu tiên triển khai

| Priority | Plugin | Hàm | Impact estimate |
|----------|--------|-----|-----------------|
| 🔴 HIGH | `btc-chart` | `computeSMC()` + `detectPivots()` | 5-10x faster chart render |
| 🔴 HIGH | `predict-club` | `deriveSignalsFromPrices()` (batch) | Giảm jank trên live oracle |
| 🟡 MEDIUM | `sui-wal-swap` | `estimateOutput()` | Share module với sui-swap |
| 🟡 MEDIUM | `sui-deepbook-orderbook` | `parseLevels()` | Faster OB refresh |
| 🟢 LOW | `predict-club` | `computeConsensus()` | Trivial computation |

---

## Kiến trúc WASM đề xuất: Shared Crate

Thay vì mỗi plugin 1 WASM module, tạo **1 shared crate** cho tất cả:

```
wasm/
├── Cargo.toml
├── build.sh
└── src/
    ├── lib.rs              # Entry + wasm_bindgen exports
    ├── orderbook.rs        # simulateMarketOrder, parseLevels
    ├── indicators.rs       # MA, RSI, orderFlow, basis, consensus
    ├── smc.rs              # detectPivots, computeSMC
    └── ranking.rs          # rankQuotes, weighted scoring
```

**Ưu điểm:**
- 1 file `.wasm` load 1 lần, tất cả plugins dùng chung
- Giảm total WASM size (shared std lib)
- Dễ maintain hơn multiple crates

**Build output:**
```
public/wasm/
├── sui_compute.wasm        # ~50-100KB gzip
└── sui_compute.js          # JS bindings
```

---

## Thứ tự triển khai đề xuất

1. ✅ `sui-swap` — DONE (simulateMarketOrder + rankQuotes)
2. ✅ `btc-chart` — computeSMC (DONE — wasm crate + JS fallback)
3. 🔜 `predict-club` — deriveSignalsFromPrices (batch indicator compute)
4. 📋 Merge vào shared crate
5. 📋 `sui-wal-swap` + `sui-deepbook-orderbook` (share existing functions)

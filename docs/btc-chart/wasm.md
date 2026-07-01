# BTC Chart — WASM Compute Layer

## TL;DR — Does WASM handle multiple timeframes?

**No, and it does not need to.** The WASM module is **timeframe-agnostic**. It
receives a plain array of candles and computes on it — it never knows or cares
what interval those candles represent. All multi-timeframe logic (fetching a
higher timeframe, mapping `1h → 4h`, building the trading range) lives in the
**TypeScript layer** (`lib/liquidity.ts`), not in Rust.

So "updating WASM for multi-timeframe" is a non-goal: passing 1h candles vs 4h
candles to `compute_smc` / `compute_nwe` already works — the caller just hands
it whichever candle array it wants analyzed.

## What WASM actually does

The Rust module (`plugins/btc-chart/wasm/src/lib.rs`) exports exactly two
heavy, hot-path computations that were O(n²) or pivot-heavy in JS:

| Export | Purpose | Why WASM |
|--------|---------|----------|
| `compute_smc(candles, cfg)` | Smart Money Concepts: BOS/CHoCH structure lines, Order Blocks, Fair Value Gaps | Pivot detection + structure passes over the full series |
| `compute_nwe(candles, cfg)` | Nadaraya-Watson Envelope (LuxAlgo) — mid line + upper/lower bands | O(n²) Gaussian kernel weighting |

Everything else (RSI, MACD, ADX, VWAP, Boucher, Lien, ICT sessions, Liquidity)
is pure TypeScript — those are O(n) single-pass and not worth the WASM round-trip.

## Config structs (Rust ↔ TS, serde-renamed)

```rust
struct SmcConfig {
    structure: bool,
    order_blocks: bool,   // serde: "orderBlocks"
    fvg: bool,
    swing_len: usize,     // serde: "swingLen"
    internal_len: usize,  // serde: "internalLen" (parsed, currently unused)
}

struct NweConfig {
    bandwidth: f64,
    multiplier: f64,
    repaint: bool,
    max_bars_back: usize, // serde: "maxBarsBack", default 500
}
```

Result structs (`SmcResult { structures, orderBlocks, fvgs }`,
`NweResult { ... }`) are serialized back to JS via `serde-wasm-bindgen`. The TS
mirrors live in `smc.ts` and `lib/nadaraya-watson.ts`.

## Timeframe-agnostic by design — worked example

`compute_smc` signature is just `(candles, cfg)`. The interval is never a
parameter. The Liquidity feature relies on this: it calls `computeSMC` **once**
on the current-frame candles to get FVGs/BOS, then `computeLiquidity` (pure TS)
anchors the trading range on **higher-timeframe** candles fetched separately:

```
ChartHeader interval = 1h
   │
   ├─ useKlines(symbol, '1h')   → current-frame candles → compute_smc(...)  [WASM]
   └─ useKlines(symbol, '4h')   → HTF candles (HTF_MAP['1h'] = '4h')
                                        │
                                        ▼
             computeLiquidity(current, htf, smc, '1h')   [pure TS, no WASM]
```

Because the two `useKlines` calls key on different intervals, React Query
caches them independently — no new fetch infrastructure was needed. `HTF_MAP`
(in `lib/liquidity.ts`): `1m→15m, 5m→1h, 15m→1h, 1h→4h, 4h→1d, 1d→null`.

## Loading + graceful fallback

`smc-wasm.ts` is the bridge. `initSmcWasm()` is called once on plugin mount and
is **non-blocking**:

1. Dynamically `import()` the wasm-pack glue at
   `/plugins/btc-chart/pkg/btc_chart_wasm.js`.
2. Instantiate `btc_chart_wasm_bg.wasm`.
3. On success → `computeSMC` / `computeNadarayaWatson` route to WASM.
4. On any failure → transparent fallback to the pure-JS `computeSMC` (`smc.ts`)
   and `calcNadarayaWatson` (`lib/nadaraya-watson.ts`). Same signatures, so
   callers never branch.

This means the plugin works even if the `pkg/` artifacts are missing — just
slower on SMC/NWE.

## Building

```bash
cd plugins/btc-chart/wasm
./build.sh        # cargo test --release, then wasm-pack build --target web
```

Requires `cargo`, `wasm-pack`, and the `wasm32-unknown-unknown` target. Output
lands in `plugins/btc-chart/pkg/` (served by Vite at
`/plugins/btc-chart/pkg/`). The build runs the Rust unit tests first
(`cargo test`), so a broken kernel fails the build before shipping.

## When to add something to WASM

Add a Rust export only when a computation is **both** hot-path (runs on every
render / candle close) **and** super-linear (O(n²) or heavy pivot passes) in
JS. NWE qualified (Gaussian kernel). ICT sessions, Liquidity, and the sweep
detection are all O(n) single-pass — they stay in TS.

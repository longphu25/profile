use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

/// OHLCV candle
#[derive(Debug, Clone, Deserialize)]
pub struct Candle {
    pub time: f64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    #[serde(default)]
    pub volume: f64,
}

/// SMC computation config
#[derive(Debug, Clone, Deserialize)]
pub struct SmcConfig {
    pub structure: bool,
    #[serde(rename = "orderBlocks")]
    pub order_blocks: bool,
    pub fvg: bool,
    #[serde(rename = "swingLen")]
    pub swing_len: usize,
    #[serde(rename = "internalLen", default)]
    pub internal_len: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct StructureLine {
    pub time: f64,
    pub price: f64,
    #[serde(rename = "endTime")]
    pub end_time: f64,
    #[serde(rename = "type")]
    pub line_type: String,
    pub bias: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrderBlock {
    #[serde(rename = "startTime")]
    pub start_time: f64,
    pub high: f64,
    pub low: f64,
    pub bias: String,
    pub broken: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct FvgBox {
    pub time: f64,
    pub top: f64,
    pub bottom: f64,
    pub bias: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SmcResult {
    pub structures: Vec<StructureLine>,
    #[serde(rename = "orderBlocks")]
    pub order_blocks: Vec<OrderBlock>,
    pub fvgs: Vec<FvgBox>,
}

/// Nadaraya-Watson Envelope config. Mirrors NadarayaWatsonConfig in nadaraya-watson.ts.
#[derive(Debug, Clone, Deserialize)]
pub struct NweConfig {
    pub bandwidth: f64,
    pub multiplier: f64,
    pub repaint: bool,
    #[serde(rename = "maxBarsBack", default = "default_max_bars_back")]
    pub max_bars_back: usize,
}

fn default_max_bars_back() -> usize {
    500
}

#[derive(Debug, Clone, Serialize)]
pub struct NweSignal {
    pub index: usize,
    #[serde(rename = "type")]
    pub sig_type: String,
    pub price: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct NweResult {
    pub mid: Vec<Option<f64>>,
    pub upper: Vec<Option<f64>>,
    pub lower: Vec<Option<f64>>,
    pub signals: Vec<NweSignal>,
}

#[derive(Debug, Clone)]
struct Pivot {
    price: f64,
    time: f64,
    idx: usize,
    crossed: bool,
}

/// Detect swing pivots (highs and lows) over a lookback window.
fn detect_pivots(candles: &[Candle], len: usize) -> (Vec<Pivot>, Vec<Pivot>) {
    let mut highs = Vec::new();
    let mut lows = Vec::new();
    if candles.len() < 2 * len + 1 {
        return (highs, lows);
    }

    for i in len..(candles.len() - len) {
        let mut is_high = true;
        let mut is_low = true;
        for j in 1..=len {
            if candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high {
                is_high = false;
            }
            if candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low {
                is_low = false;
            }
            if !is_high && !is_low {
                break;
            }
        }
        if is_high {
            highs.push(Pivot { price: candles[i].high, time: candles[i].time, idx: i, crossed: false });
        }
        if is_low {
            lows.push(Pivot { price: candles[i].low, time: candles[i].time, idx: i, crossed: false });
        }
    }
    (highs, lows)
}

/// WASM-exported entry: compute SMC overlay from candles + config.
#[wasm_bindgen]
pub fn compute_smc(candles_js: JsValue, cfg_js: JsValue) -> JsValue {
    let candles: Vec<Candle> = match serde_wasm_bindgen::from_value(candles_js) {
        Ok(c) => c,
        Err(_) => return empty_result(),
    };
    let cfg: SmcConfig = match serde_wasm_bindgen::from_value(cfg_js) {
        Ok(c) => c,
        Err(_) => return empty_result(),
    };

    let result = compute_smc_inner(&candles, &cfg);
    serde_wasm_bindgen::to_value(&result).unwrap_or_else(|_| empty_result())
}

fn empty_result() -> JsValue {
    let empty = SmcResult { structures: vec![], order_blocks: vec![], fvgs: vec![] };
    serde_wasm_bindgen::to_value(&empty).unwrap_or(JsValue::NULL)
}

/// Gaussian window: exp(-(x^2 / (h^2 * 2))). Mirrors gauss() in nadaraya-watson.ts.
fn gauss(x: f64, h: f64) -> f64 {
    (-(x.powi(2) / (h * h * 2.0))).exp()
}

/// WASM-exported entry: compute Nadaraya-Watson Envelope from candles + config.
#[wasm_bindgen]
pub fn compute_nwe(candles_js: JsValue, cfg_js: JsValue) -> JsValue {
    let candles: Vec<Candle> = match serde_wasm_bindgen::from_value(candles_js) {
        Ok(c) => c,
        Err(_) => return empty_nwe_result(),
    };
    let cfg: NweConfig = match serde_wasm_bindgen::from_value(cfg_js) {
        Ok(c) => c,
        Err(_) => return empty_nwe_result(),
    };

    let result = compute_nwe_inner(&candles, &cfg);
    serde_wasm_bindgen::to_value(&result).unwrap_or_else(|_| empty_nwe_result())
}

fn empty_nwe_result() -> JsValue {
    let empty = NweResult { mid: vec![], upper: vec![], lower: vec![], signals: vec![] };
    serde_wasm_bindgen::to_value(&empty).unwrap_or(JsValue::NULL)
}

/// Pure NWE computation — mirrors calcNadarayaWatson in nadaraya-watson.ts exactly.
pub fn compute_nwe_inner(candles: &[Candle], cfg: &NweConfig) -> NweResult {
    let n = candles.len();
    let src: Vec<f64> = candles.iter().map(|c| c.close).collect();

    let mut mid: Vec<Option<f64>> = vec![None; n];
    let mut upper: Vec<Option<f64>> = vec![None; n];
    let mut lower: Vec<Option<f64>> = vec![None; n];
    let mut signals: Vec<NweSignal> = Vec::new();

    if n == 0 {
        return NweResult { mid, upper, lower, signals };
    }

    if cfg.repaint {
        // Repainting mode: compute all points in window on the last bar.
        let max_bars = cfg.max_bars_back.min(n);
        let mut nwe: Vec<f64> = Vec::with_capacity(max_bars);

        for i in 0..max_bars {
            let mut sum = 0.0;
            let mut sumw = 0.0;
            for j in 0..max_bars {
                let w = gauss(i as f64 - j as f64, cfg.bandwidth);
                sum += src[n - max_bars + j] * w;
                sumw += w;
            }
            nwe.push(sum / sumw);
        }

        // SAE (Smoothed Absolute Error)
        let mut sae_sum = 0.0;
        for i in 0..max_bars {
            sae_sum += (src[n - max_bars + i] - nwe[i]).abs();
        }
        let sae = (sae_sum / max_bars as f64) * cfg.multiplier;

        for i in 0..max_bars {
            let idx = n - max_bars + i;
            mid[idx] = Some(nwe[i]);
            upper[idx] = Some(nwe[i] + sae);
            lower[idx] = Some(nwe[i] - sae);

            if i > 0 {
                let prev_src = src[idx - 1];
                let curr_src = src[idx];
                let prev_upper = nwe[i - 1] + sae;
                let curr_upper = nwe[i] + sae;
                let prev_lower = nwe[i - 1] - sae;
                let curr_lower = nwe[i] - sae;

                if prev_src < prev_upper && curr_src > curr_upper {
                    signals.push(NweSignal { index: idx, sig_type: "sell".to_string(), price: curr_src });
                } else if prev_src > prev_lower && curr_src < curr_lower {
                    signals.push(NweSignal { index: idx, sig_type: "buy".to_string(), price: curr_src });
                }
            }
        }
    } else {
        // Non-repainting mode: compute endpoint only.
        let mut coefs: Vec<f64> = Vec::with_capacity(cfg.max_bars_back);
        let mut den = 0.0;
        for i in 0..cfg.max_bars_back {
            let w = gauss(i as f64, cfg.bandwidth);
            coefs.push(w);
            den += w;
        }

        let mut mae_values: Vec<f64> = Vec::with_capacity(n);
        for i in 0..n {
            let mut out = 0.0;
            let bars_to_use = cfg.max_bars_back.min(i + 1);
            for j in 0..bars_to_use {
                out += src[i - j] * coefs[j];
            }
            out /= den;
            mid[i] = Some(out);
            mae_values.push((src[i] - out).abs());
        }

        let mae_period = 499usize.min(n);
        let mut mae_sum = 0.0;
        for i in 0..mae_period {
            mae_sum += mae_values[i];
        }
        let mae = (mae_sum / mae_period as f64) * cfg.multiplier;

        for i in 0..n {
            if let Some(m) = mid[i] {
                upper[i] = Some(m + mae);
                lower[i] = Some(m - mae);
            }
        }

        if n >= 2 {
            let prev_src = src[n - 2];
            let curr_src = src[n - 1];
            let prev_upper = upper[n - 2].unwrap();
            let curr_upper = upper[n - 1].unwrap();
            let prev_lower = lower[n - 2].unwrap();
            let curr_lower = lower[n - 1].unwrap();

            if prev_src < prev_upper && curr_src > curr_upper {
                signals.push(NweSignal { index: n - 1, sig_type: "sell".to_string(), price: curr_src });
            } else if prev_src > prev_lower && curr_src < curr_lower {
                signals.push(NweSignal { index: n - 1, sig_type: "buy".to_string(), price: curr_src });
            }
        }
    }

    NweResult { mid, upper, lower, signals }
}

/// Pure computation — testable without WASM. Mirrors smc.ts exactly.
pub fn compute_smc_inner(candles: &[Candle], cfg: &SmcConfig) -> SmcResult {
    let mut structures: Vec<StructureLine> = Vec::new();
    let mut order_blocks: Vec<OrderBlock> = Vec::new();
    let mut fvgs: Vec<FvgBox> = Vec::new();

    if candles.len() < cfg.swing_len * 2 + 1 {
        return SmcResult { structures, order_blocks, fvgs };
    }

    // ── Structure + Order Blocks ──
    if cfg.structure || cfg.order_blocks {
        let (highs, lows) = detect_pivots(candles, cfg.swing_len);

        let mut pivot_high_map: std::collections::HashMap<usize, Pivot> = std::collections::HashMap::new();
        let mut pivot_low_map: std::collections::HashMap<usize, Pivot> = std::collections::HashMap::new();
        for h in &highs {
            pivot_high_map.insert(h.idx, h.clone());
        }
        for l in &lows {
            pivot_low_map.insert(l.idx, l.clone());
        }

        let mut sw_high: Option<Pivot> = None;
        let mut sw_low: Option<Pivot> = None;
        let mut current_bias = "bull".to_string();

        for i in cfg.swing_len..candles.len() {
            if let Some(ph) = pivot_high_map.get(&i) {
                sw_high = Some(Pivot { crossed: false, ..ph.clone() });
            }
            if let Some(pl) = pivot_low_map.get(&i) {
                sw_low = Some(Pivot { crossed: false, ..pl.clone() });
            }

            // Bullish break: close > swHigh
            if let Some(ref mut sh) = sw_high {
                if !sh.crossed && candles[i].close > sh.price {
                    let line_type = if current_bias == "bear" { "CHoCH" } else { "BOS" };
                    structures.push(StructureLine {
                        time: sh.time,
                        price: sh.price,
                        end_time: candles[i].time,
                        line_type: line_type.to_string(),
                        bias: "bull".to_string(),
                    });
                    sh.crossed = true;
                    if cfg.order_blocks {
                        let start = if i >= 11 { i - 10 } else { 0 };
                        for j in (start..i).rev() {
                            if candles[j].close < candles[j].open {
                                order_blocks.push(OrderBlock {
                                    start_time: candles[j].time,
                                    high: candles[j].high,
                                    low: candles[j].low,
                                    bias: "bull".to_string(),
                                    broken: false,
                                });
                                break;
                            }
                        }
                    }
                    current_bias = "bull".to_string();
                }
            }

            // Bearish break: close < swLow
            if let Some(ref mut sl) = sw_low {
                if !sl.crossed && candles[i].close < sl.price {
                    let line_type = if current_bias == "bull" { "CHoCH" } else { "BOS" };
                    structures.push(StructureLine {
                        time: sl.time,
                        price: sl.price,
                        end_time: candles[i].time,
                        line_type: line_type.to_string(),
                        bias: "bear".to_string(),
                    });
                    sl.crossed = true;
                    if cfg.order_blocks {
                        let start = if i >= 11 { i - 10 } else { 0 };
                        for j in (start..i).rev() {
                            if candles[j].close > candles[j].open {
                                order_blocks.push(OrderBlock {
                                    start_time: candles[j].time,
                                    high: candles[j].high,
                                    low: candles[j].low,
                                    bias: "bear".to_string(),
                                    broken: false,
                                });
                                break;
                            }
                        }
                    }
                    current_bias = "bear".to_string();
                }
            }
        }

        // Mark broken OBs
        for ob in order_blocks.iter_mut() {
            for c in candles.iter() {
                if c.time <= ob.start_time {
                    continue;
                }
                if ob.bias == "bull" && c.low < ob.low {
                    ob.broken = true;
                    break;
                }
                if ob.bias == "bear" && c.high > ob.high {
                    ob.broken = true;
                    break;
                }
            }
        }
    }

    // ── FVG ──
    if cfg.fvg {
        for i in 2..candles.len() {
            // Bullish FVG: current low > 2-bars-ago high
            if candles[i].low > candles[i - 2].high {
                fvgs.push(FvgBox {
                    time: candles[i - 1].time,
                    top: candles[i].low,
                    bottom: candles[i - 2].high,
                    bias: "bull".to_string(),
                });
            }
            // Bearish FVG: current high < 2-bars-ago low
            if candles[i].high < candles[i - 2].low {
                fvgs.push(FvgBox {
                    time: candles[i - 1].time,
                    top: candles[i - 2].low,
                    bottom: candles[i].high,
                    bias: "bear".to_string(),
                });
            }
        }
        // Remove filled FVGs (mark by collapsing top==bottom)
        for fvg in fvgs.iter_mut() {
            for c in candles.iter() {
                if c.time <= fvg.time {
                    continue;
                }
                if fvg.bias == "bull" && c.low <= fvg.bottom {
                    fvg.bottom = fvg.top;
                    break;
                }
                if fvg.bias == "bear" && c.high >= fvg.top {
                    fvg.top = fvg.bottom;
                    break;
                }
            }
        }
    }

    // Filter + slice to match smc.ts output
    let filtered_obs: Vec<OrderBlock> = order_blocks.into_iter().filter(|ob| !ob.broken).collect();
    let obs_tail: Vec<OrderBlock> = filtered_obs
        .iter()
        .skip(filtered_obs.len().saturating_sub(10))
        .cloned()
        .collect();

    let filtered_fvgs: Vec<FvgBox> = fvgs.into_iter().filter(|f| f.top != f.bottom).collect();
    let fvgs_tail: Vec<FvgBox> = filtered_fvgs
        .iter()
        .skip(filtered_fvgs.len().saturating_sub(15))
        .cloned()
        .collect();

    SmcResult {
        structures,
        order_blocks: obs_tail,
        fvgs: fvgs_tail,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_candle(time: f64, o: f64, h: f64, l: f64, c: f64) -> Candle {
        Candle { time, open: o, high: h, low: l, close: c, volume: 0.0 }
    }

    fn gen_candles(n: usize) -> Vec<Candle> {
        let mut v = Vec::new();
        for i in 0..n {
            let base = 100.0 + (i as f64 * 0.5).sin() * 10.0;
            v.push(make_candle(i as f64, base, base + 2.0, base - 2.0, base + 1.0));
        }
        v
    }

    #[test]
    fn test_too_few_candles() {
        let cfg = SmcConfig { structure: true, order_blocks: true, fvg: true, swing_len: 10, internal_len: 5 };
        let result = compute_smc_inner(&gen_candles(5), &cfg);
        assert!(result.structures.is_empty());
        assert!(result.order_blocks.is_empty());
        assert!(result.fvgs.is_empty());
    }

    #[test]
    fn test_computes_without_panic() {
        let cfg = SmcConfig { structure: true, order_blocks: true, fvg: true, swing_len: 10, internal_len: 5 };
        let result = compute_smc_inner(&gen_candles(200), &cfg);
        assert!(result.order_blocks.len() <= 10);
        assert!(result.fvgs.len() <= 15);
    }

    #[test]
    fn test_bullish_fvg_detection() {
        let mut candles = gen_candles(50);
        // Force a bullish FVG at index 10: candle[10].low > candle[8].high
        candles[8] = make_candle(8.0, 100.0, 101.0, 99.0, 100.5);
        candles[10] = make_candle(10.0, 105.0, 107.0, 104.0, 106.0);
        let cfg = SmcConfig { structure: false, order_blocks: false, fvg: true, swing_len: 10, internal_len: 5 };
        let result = compute_smc_inner(&candles, &cfg);
        assert!(!result.fvgs.is_empty());
    }

    #[test]
    fn test_nwe_repaint_shape() {
        let candles = gen_candles(120);
        let cfg = NweConfig { bandwidth: 8.0, multiplier: 3.0, repaint: true, max_bars_back: 500 };
        let r = compute_nwe_inner(&candles, &cfg);
        assert_eq!(r.mid.len(), 120);
        assert_eq!(r.upper.len(), 120);
        assert_eq!(r.lower.len(), 120);
        // All bars in-window should be filled (window = min(500,120) = 120).
        assert!(r.mid.iter().all(|v| v.is_some()));
        // Bands straddle the mid line.
        for i in 0..120 {
            let m = r.mid[i].unwrap();
            assert!(r.upper[i].unwrap() >= m);
            assert!(r.lower[i].unwrap() <= m);
        }
    }

    #[test]
    fn test_nwe_non_repaint_shape() {
        let candles = gen_candles(120);
        let cfg = NweConfig { bandwidth: 8.0, multiplier: 3.0, repaint: false, max_bars_back: 500 };
        let r = compute_nwe_inner(&candles, &cfg);
        assert_eq!(r.mid.len(), 120);
        assert!(r.mid.iter().all(|v| v.is_some()));
        // Non-repaint only emits at most one signal (last bar).
        assert!(r.signals.len() <= 1);
    }

    #[test]
    fn test_nwe_empty() {
        let cfg = NweConfig { bandwidth: 8.0, multiplier: 3.0, repaint: true, max_bars_back: 500 };
        let r = compute_nwe_inner(&[], &cfg);
        assert!(r.mid.is_empty());
        assert!(r.signals.is_empty());
    }
}

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
}

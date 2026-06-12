use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

/// Oracle price tick (spot + forward).
#[derive(Debug, Clone, Deserialize)]
pub struct OraclePrice {
    pub spot: f64,
    pub forward: f64,
    #[serde(default)]
    pub timestamp: f64,
}

/// Indicator signal output (mirrors IndicatorSignal in domain/types.ts).
#[derive(Debug, Clone, Serialize)]
pub struct IndicatorSignal {
    pub id: String,
    pub name: String,
    pub state: String,
    pub value: String,
    pub confidence: u32,
}

fn avg(arr: &[f64]) -> f64 {
    if arr.is_empty() {
        return 0.0;
    }
    arr.iter().sum::<f64>() / arr.len() as f64
}

fn tail(arr: &[f64], n: usize) -> &[f64] {
    if arr.len() <= n {
        arr
    } else {
        &arr[arr.len() - n..]
    }
}

struct Ma {
    ma_short: f64,
    ma_long: f64,
}

fn compute_ma(prices: &[f64], short: usize, long: usize) -> Option<Ma> {
    if prices.len() < 2 {
        return None;
    }
    Some(Ma {
        ma_short: avg(tail(prices, short)),
        ma_long: avg(tail(prices, long)),
    })
}

fn compute_rsi(prices: &[f64], period: usize) -> Option<f64> {
    if prices.len() < period + 1 {
        return None;
    }
    let window = tail(prices, period + 1);
    let mut gains: Vec<f64> = Vec::new();
    let mut losses: Vec<f64> = Vec::new();
    for i in 1..window.len() {
        let change = window[i] - window[i - 1];
        if change > 0.0 {
            gains.push(change);
        } else if change < 0.0 {
            losses.push(change.abs());
        }
    }
    let avg_gain = avg(&gains);
    let avg_loss = avg(&losses);
    if avg_loss == 0.0 {
        return Some(100.0);
    }
    let rs = avg_gain / avg_loss;
    Some(100.0 - 100.0 / (1.0 + rs))
}

fn compute_order_flow_delta(prices: &[OraclePrice]) -> (f64, String) {
    if prices.len() < 2 {
        return (0.0, "0".to_string());
    }
    let ticks = if prices.len() <= 10 {
        prices
    } else {
        &prices[prices.len() - 10..]
    };
    let mut delta = 0.0;
    for i in 1..ticks.len() {
        delta += ticks[i].spot - ticks[i - 1].spot;
    }
    let sign = if delta >= 0.0 { "+" } else { "" };
    (delta, format!("{}{:.0}", sign, delta))
}

struct Basis {
    label: String,
    state: String,
}

fn compute_basis(prices: &[OraclePrice]) -> Basis {
    if prices.is_empty() {
        return Basis { label: "—".to_string(), state: "neutral".to_string() };
    }
    let last = &prices[prices.len() - 1];
    let basis = last.forward - last.spot;
    let basis_pct = if last.spot > 0.0 { (basis / last.spot) * 100.0 } else { 0.0 };
    let state = if basis_pct > 0.005 {
        "bullish"
    } else if basis_pct < -0.005 {
        "bearish"
    } else {
        "neutral"
    };
    let sign = if basis >= 0.0 { "+" } else { "" };
    let label = format!("{}{:.0} ({}{:.3}%)", sign, basis, sign, basis_pct);
    Basis { label, state: state.to_string() }
}

fn price_to_state(value: f64, bull: f64, bear: f64) -> &'static str {
    if value > bull {
        "bullish"
    } else if value < bear {
        "bearish"
    } else {
        "neutral"
    }
}

fn min_f(a: f64, b: f64) -> f64 {
    if a < b { a } else { b }
}

/// Pure computation mirroring deriveSignalsFromPrices in indicatorSignalGateway.ts.
pub fn derive_signals_inner(prices: &[OraclePrice]) -> Vec<IndicatorSignal> {
    let spot: Vec<f64> = prices.iter().map(|p| p.spot).collect();

    // MA
    let ma = compute_ma(&spot, 5, 20);
    let (ma_state, ma_value, ma_conf) = match &ma {
        Some(m) => {
            let state = price_to_state(m.ma_short - m.ma_long, 10.0, -10.0).to_string();
            let value = format!("{:.0} / {:.0}", m.ma_short, m.ma_long);
            let denom = if m.ma_long != 0.0 { m.ma_long } else { 1.0 };
            let conf = min_f(95.0, 50.0 + (((m.ma_short - m.ma_long) / denom) * 2000.0).abs());
            (state, value, conf)
        }
        None => ("neutral".to_string(), "Insufficient data".to_string(), 50.0),
    };

    // RSI
    let rsi = compute_rsi(&spot, 14);
    let (rsi_state, rsi_value, rsi_conf) = match rsi {
        Some(r) => {
            let state = if r > 60.0 { "bullish" } else if r < 40.0 { "bearish" } else { "neutral" };
            let value = format!("{:.1}", r);
            let conf = min_f(90.0, 40.0 + (r - 50.0).abs());
            (state.to_string(), value, conf)
        }
        None => ("neutral".to_string(), "Insufficient data".to_string(), 50.0),
    };

    // Order flow
    let (delta, flow_label) = compute_order_flow_delta(prices);
    let flow_state = price_to_state(delta, 5.0, -5.0).to_string();
    let flow_value = format!("{} momentum", flow_label);
    let flow_conf = min_f(90.0, 50.0 + min_f(delta.abs(), 50.0));

    // Box Flip
    let mut box_state = "neutral".to_string();
    let mut box_value = "No signal".to_string();
    if prices.len() >= 10 {
        let recent = tail(&spot, 10);
        let range = &recent[..recent.len() - 1];
        let range_high = range.iter().cloned().fold(f64::MIN, f64::max);
        let range_low = range.iter().cloned().fold(f64::MAX, f64::min);
        let last = spot[spot.len() - 1];
        if last > range_high {
            box_state = "bullish".to_string();
            box_value = "Breakout".to_string();
        } else if last < range_low {
            box_state = "bearish".to_string();
            box_value = "Breakdown".to_string();
        } else {
            box_value = "Range".to_string();
        }
    }

    // SMC: higher highs / lower lows
    let mut smc_state = "neutral".to_string();
    let mut smc_value = "No signal".to_string();
    if prices.len() >= 6 {
        let n = spot.len();
        let last3 = &spot[n - 3..];
        let prev3 = &spot[n - 6..n - 3];
        if last3[2] > prev3[2] && last3[0] > prev3[0] {
            smc_state = "bullish".to_string();
            smc_value = "HH structure".to_string();
        } else if last3[2] < prev3[2] && last3[0] < prev3[0] {
            smc_state = "bearish".to_string();
            smc_value = "LL structure".to_string();
        } else {
            smc_value = "Mixed".to_string();
        }
    }

    // Basis
    let basis = compute_basis(prices);

    vec![
        IndicatorSignal { id: "box".into(), name: "Box Flip".into(), state: box_state, value: box_value, confidence: 76 },
        IndicatorSignal { id: "smc".into(), name: "Smart Money".into(), state: smc_state, value: smc_value, confidence: 72 },
        IndicatorSignal { id: "ma".into(), name: "MA Trend".into(), state: ma_state, value: ma_value, confidence: ma_conf.round() as u32 },
        IndicatorSignal { id: "rsi".into(), name: "RSI".into(), state: rsi_state, value: rsi_value, confidence: rsi_conf.round() as u32 },
        IndicatorSignal { id: "flow".into(), name: "Momentum".into(), state: flow_state, value: flow_value, confidence: flow_conf.round() as u32 },
        IndicatorSignal { id: "basis".into(), name: "Basis (Fwd-Spot)".into(), state: basis.state, value: basis.label, confidence: 80 },
    ]
}

/// WASM entry: derive indicator signals from an array of oracle prices.
#[wasm_bindgen]
pub fn derive_signals(prices_js: JsValue) -> JsValue {
    let prices: Vec<OraclePrice> = match serde_wasm_bindgen::from_value(prices_js) {
        Ok(p) => p,
        Err(_) => return serde_wasm_bindgen::to_value::<Vec<IndicatorSignal>>(&vec![]).unwrap_or(JsValue::NULL),
    };
    let signals = derive_signals_inner(&prices);
    serde_wasm_bindgen::to_value(&signals).unwrap_or(JsValue::NULL)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk(spot: f64, forward: f64) -> OraclePrice {
        OraclePrice { spot, forward, timestamp: 0.0 }
    }

    #[test]
    fn test_returns_six_signals() {
        let prices: Vec<OraclePrice> = (0..30).map(|i| mk(100.0 + i as f64, 100.0 + i as f64 + 1.0)).collect();
        let signals = derive_signals_inner(&prices);
        assert_eq!(signals.len(), 6);
        let ids: Vec<&str> = signals.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids, vec!["box", "smc", "ma", "rsi", "flow", "basis"]);
    }

    #[test]
    fn test_rising_prices_bullish_ma() {
        let prices: Vec<OraclePrice> = (0..30).map(|i| mk(100.0 + i as f64 * 5.0, 100.0 + i as f64 * 5.0)).collect();
        let signals = derive_signals_inner(&prices);
        let ma = signals.iter().find(|s| s.id == "ma").unwrap();
        assert_eq!(ma.state, "bullish");
    }

    #[test]
    fn test_rsi_all_gains_is_100() {
        let prices: Vec<OraclePrice> = (0..20).map(|i| mk(100.0 + i as f64, 100.0 + i as f64)).collect();
        let rsi = compute_rsi(&prices.iter().map(|p| p.spot).collect::<Vec<_>>(), 14).unwrap();
        assert_eq!(rsi, 100.0);
    }

    #[test]
    fn test_insufficient_data() {
        let prices = vec![mk(100.0, 101.0), mk(101.0, 102.0)];
        let signals = derive_signals_inner(&prices);
        assert_eq!(signals.len(), 6);
        let ma = signals.iter().find(|s| s.id == "ma").unwrap();
        assert_eq!(ma.value, "100 / 100");
    }

    #[test]
    fn test_basis_contango_bullish() {
        let prices = vec![mk(1000.0, 1010.0)];
        let basis = compute_basis(&prices);
        assert_eq!(basis.state, "bullish");
    }
}

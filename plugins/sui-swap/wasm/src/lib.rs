use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

/// A single orderbook level (price + size)
#[derive(Debug, Clone, Deserialize)]
pub struct OrderBookLevel {
    pub price: f64,
    pub size: f64,
}

/// Result of a market order simulation
#[derive(Debug, Clone, Serialize)]
pub struct SimResult {
    pub output: f64,
    pub price_impact: f64,
    pub avg_price: f64,
    pub filled_percent: f64,
}

/// Simulate a market order against orderbook levels.
///
/// - `amount`: quantity to trade (in quote for buy, in base for sell)
/// - `is_buy`: true = buying base with quote (consume asks), false = selling base for quote (consume bids)
/// - `levels`: orderbook levels sorted by price (asks ascending, bids descending)
///
/// Returns SimResult with output amount, average price, price impact, and fill percentage.
#[wasm_bindgen]
pub fn simulate_market_order(amount: f64, is_buy: bool, levels_js: JsValue) -> JsValue {
    let levels: Vec<OrderBookLevel> = match serde_wasm_bindgen::from_value(levels_js) {
        Ok(l) => l,
        Err(_) => {
            let empty = SimResult {
                output: 0.0,
                price_impact: 0.0,
                avg_price: 0.0,
                filled_percent: 0.0,
            };
            return serde_wasm_bindgen::to_value(&empty).unwrap_or(JsValue::NULL);
        }
    };

    let result = simulate_market_order_inner(amount, is_buy, &levels);
    serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
}

/// Pure computation — no WASM dependencies, testable standalone.
pub fn simulate_market_order_inner(amount: f64, is_buy: bool, levels: &[OrderBookLevel]) -> SimResult {
    if amount <= 0.0 || levels.is_empty() {
        return SimResult {
            output: 0.0,
            price_impact: 0.0,
            avg_price: 0.0,
            filled_percent: 0.0,
        };
    }

    let best_price = levels[0].price;
    let mut remaining = amount;
    let mut filled = 0.0;

    for level in levels {
        if remaining <= 0.0 {
            break;
        }
        if is_buy {
            let level_cost = level.price * level.size;
            if remaining >= level_cost {
                remaining -= level_cost;
                filled += level.size;
            } else {
                filled += remaining / level.price;
                remaining = 0.0;
            }
        } else {
            if remaining >= level.size {
                remaining -= level.size;
                filled += level.size * level.price;
            } else {
                filled += remaining * level.price;
                remaining = 0.0;
            }
        }
    }

    let spent = amount - remaining;
    let avg_price = if is_buy {
        if filled > 0.0 { spent / filled } else { 0.0 }
    } else {
        if spent > 0.0 { filled / spent } else { 0.0 }
    };

    let price_impact = if best_price > 0.0 {
        ((avg_price - best_price) / best_price).abs() * 100.0
    } else {
        0.0
    };

    let filled_percent = if amount > 0.0 {
        (spent / amount) * 100.0
    } else {
        0.0
    };

    SimResult {
        output: filled,
        price_impact,
        avg_price,
        filled_percent,
    }
}

/// A single route quote for ranking
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct QuoteEntry {
    pub dex: String,
    pub output_amount: f64,
    pub price_impact: f64,
    pub fee: f64,
    pub estimated_gas: f64,
}

/// Ranked quote result
#[derive(Debug, Clone, Serialize)]
pub struct RankedQuote {
    pub dex: String,
    pub output_amount: f64,
    pub price_impact: f64,
    pub fee: f64,
    pub estimated_gas: f64,
    pub score: f64,
    pub rank: u32,
}

/// Rank and sort quotes using weighted scoring.
///
/// Scoring formula:
/// score = output_amount - (price_impact_weight * price_impact) - fee - estimated_gas
///
/// Higher score = better route.
#[wasm_bindgen]
pub fn rank_quotes(quotes_js: JsValue, price_impact_weight: f64) -> JsValue {
    let quotes: Vec<QuoteEntry> = match serde_wasm_bindgen::from_value(quotes_js) {
        Ok(q) => q,
        Err(_) => return serde_wasm_bindgen::to_value::<Vec<RankedQuote>>(&vec![]).unwrap_or(JsValue::NULL),
    };

    let result = rank_quotes_inner(&quotes, price_impact_weight);
    serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
}

/// Pure computation — testable without WASM.
pub fn rank_quotes_inner(quotes: &[QuoteEntry], price_impact_weight: f64) -> Vec<RankedQuote> {
    if quotes.is_empty() {
        return vec![];
    }

    // Normalize output amounts relative to max for fair scoring
    let max_output = quotes.iter().map(|q| q.output_amount).fold(0.0_f64, f64::max);
    let normalizer = if max_output > 0.0 { max_output } else { 1.0 };

    let mut ranked: Vec<RankedQuote> = quotes
        .iter()
        .map(|q| {
            let normalized_output = q.output_amount / normalizer;
            let score = normalized_output
                - (price_impact_weight * q.price_impact / 100.0)
                - (q.fee / normalizer)
                - (q.estimated_gas / normalizer);

            RankedQuote {
                dex: q.dex.clone(),
                output_amount: q.output_amount,
                price_impact: q.price_impact,
                fee: q.fee,
                estimated_gas: q.estimated_gas,
                score,
                rank: 0,
            }
        })
        .collect();

    // Sort descending by score
    ranked.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

    // Assign ranks
    for (i, entry) in ranked.iter_mut().enumerate() {
        entry.rank = (i + 1) as u32;
    }

    ranked
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simulate_buy() {
        let levels = vec![
            OrderBookLevel { price: 100.0, size: 1.0 },
            OrderBookLevel { price: 101.0, size: 2.0 },
            OrderBookLevel { price: 102.0, size: 3.0 },
        ];
        let result = simulate_market_order_inner(200.0, true, &levels);
        assert!(result.output > 0.0);
        assert!(result.price_impact >= 0.0);
        assert!(result.filled_percent > 0.0);
    }

    #[test]
    fn test_simulate_sell() {
        let levels = vec![
            OrderBookLevel { price: 100.0, size: 1.0 },
            OrderBookLevel { price: 99.0, size: 2.0 },
            OrderBookLevel { price: 98.0, size: 3.0 },
        ];
        let result = simulate_market_order_inner(2.0, false, &levels);
        assert!(result.output > 0.0);
        assert_eq!(result.filled_percent, 100.0);
    }

    #[test]
    fn test_empty_levels() {
        let result = simulate_market_order_inner(100.0, true, &[]);
        assert_eq!(result.output, 0.0);
        assert_eq!(result.price_impact, 0.0);
    }

    #[test]
    fn test_rank_quotes() {
        let quotes = vec![
            QuoteEntry { dex: "a".into(), output_amount: 100.0, price_impact: 0.5, fee: 0.3, estimated_gas: 0.003 },
            QuoteEntry { dex: "b".into(), output_amount: 99.0, price_impact: 0.1, fee: 0.1, estimated_gas: 0.005 },
            QuoteEntry { dex: "c".into(), output_amount: 98.0, price_impact: 3.0, fee: 0.2, estimated_gas: 0.004 },
        ];
        let ranked = rank_quotes_inner(&quotes, 1.0);
        assert_eq!(ranked.len(), 3);
        assert_eq!(ranked[0].rank, 1);
        // High price impact should rank lower even with decent output
        assert_eq!(ranked[2].dex, "c");
    }
}

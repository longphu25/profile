use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// ── Types (mirror TS types) ──

#[derive(Serialize, Deserialize, Clone)]
pub struct Pool {
    pub symbol: String,
    pub price: f64,
    pub supply: f64,
    pub borrow: f64,
    #[serde(rename = "supplyApy")]
    pub supply_apy: f64,
    #[serde(rename = "borrowApy")]
    pub borrow_apy: f64,
    pub ltv: f64,
    pub tvl: f64,
    pub utilization: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Vault {
    pub id: String,
    pub name: String,
    #[serde(rename = "riskLevel")]
    pub risk_level: String,
    pub apy7d: f64,
    pub apy30d: f64,
    #[serde(rename = "totalStakedUsd")]
    pub total_staked_usd: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct WalletCoin {
    pub symbol: String,
    pub balance: f64,
    #[serde(rename = "usdValue")]
    pub usd_value: f64,
}

#[derive(Serialize, Deserialize)]
pub struct Opportunity {
    pub rank: u32,
    #[serde(rename = "type")]
    pub opp_type: String,
    pub name: String,
    pub apy: f64,
    pub risk: String,
    pub tvl: f64,
    pub detail: String,
    #[serde(rename = "estYearlyPer1k")]
    pub est_yearly_per_1k: f64,
}

#[derive(Serialize, Deserialize)]
pub struct PoolDelta {
    pub symbol: String,
    pub field: String,
    pub prev: f64,
    pub curr: f64,
    #[serde(rename = "changePct")]
    pub change_pct: f64,
}

#[derive(Serialize, Deserialize)]
pub struct AnalysisResult {
    pub opportunities: Vec<Opportunity>,
    pub deltas: Vec<PoolDelta>,
    #[serde(rename = "topSupply")]
    pub top_supply: Vec<Pool>,
    #[serde(rename = "topBorrow")]
    pub top_borrow: Vec<Pool>,
    #[serde(rename = "topTvl")]
    pub top_tvl: Vec<Pool>,
    #[serde(rename = "walletOpportunities")]
    pub wallet_opportunities: Vec<Opportunity>,
}

// ── Analysis Functions ──

fn rank_supply(pools: &[Pool]) -> Vec<Opportunity> {
    let mut filtered: Vec<&Pool> = pools.iter().filter(|p| p.supply_apy > 0.1).collect();
    filtered.sort_by(|a, b| b.supply_apy.partial_cmp(&a.supply_apy).unwrap());
    filtered
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let risk = if p.supply_apy > 20.0 {
                "high"
            } else if p.supply_apy > 8.0 {
                "medium"
            } else {
                "low"
            };
            Opportunity {
                rank: (i + 1) as u32,
                opp_type: "supply".into(),
                name: format!("Supply {}", p.symbol),
                apy: p.supply_apy,
                risk: risk.into(),
                tvl: p.tvl,
                detail: format!(
                    "{} pool | TVL ${:.1}M | Util {:.0}%",
                    p.symbol,
                    p.tvl / 1e6,
                    p.utilization * 100.0
                ),
                est_yearly_per_1k: 1000.0 * (p.supply_apy / 100.0),
            }
        })
        .collect()
}

fn rank_vaults(vaults: &[Vault]) -> Vec<Opportunity> {
    let mut filtered: Vec<&Vault> = vaults.iter().filter(|v| v.apy7d > 0.1).collect();
    filtered.sort_by(|a, b| b.apy7d.partial_cmp(&a.apy7d).unwrap());
    filtered
        .iter()
        .enumerate()
        .map(|(i, v)| Opportunity {
            rank: (i + 1) as u32,
            opp_type: "vault".into(),
            name: format!("Vault: {}", v.name),
            apy: v.apy7d,
            risk: v.risk_level.to_lowercase(),
            tvl: v.total_staked_usd,
            detail: format!(
                "7d: {:.2}% | 30d: {:.2}% | TVL ${:.1}M",
                v.apy7d,
                v.apy30d,
                v.total_staked_usd / 1e6
            ),
            est_yearly_per_1k: 1000.0 * (v.apy7d / 100.0),
        })
        .collect()
}

fn find_loops(pools: &[Pool]) -> Vec<Opportunity> {
    let mut loops = Vec::new();
    for sp in pools {
        if sp.supply_apy < 1.0 {
            continue;
        }
        for bp in pools {
            if bp.borrow_apy <= 0.0 || bp.symbol == sp.symbol {
                continue;
            }
            let safe_ltv = (sp.ltv * 0.6).min(0.5);
            if safe_ltv <= 0.0 {
                continue;
            }
            let net_apy = sp.supply_apy - bp.borrow_apy * safe_ltv;
            if net_apy < 1.0 {
                continue;
            }
            loops.push(Opportunity {
                rank: 0,
                opp_type: "loop".into(),
                name: format!("Supply {} → Borrow {}", sp.symbol, bp.symbol),
                apy: net_apy,
                risk: if net_apy > 10.0 { "high" } else { "medium" }.into(),
                tvl: sp.tvl.min(bp.tvl),
                detail: format!(
                    "Supply {:.2}% - Borrow {:.2}% × {:.0}% LTV = Net {:.2}%",
                    sp.supply_apy,
                    bp.borrow_apy,
                    safe_ltv * 100.0,
                    net_apy
                ),
                est_yearly_per_1k: 1000.0 * (net_apy / 100.0),
            });
        }
    }
    loops.sort_by(|a, b| b.apy.partial_cmp(&a.apy).unwrap());
    loops.truncate(10);
    for (i, l) in loops.iter_mut().enumerate() {
        l.rank = (i + 1) as u32;
    }
    loops
}

fn detect_deltas(prev: &[Pool], curr: &[Pool]) -> Vec<PoolDelta> {
    let mut deltas = Vec::new();
    for c in curr {
        if let Some(p) = prev.iter().find(|p| p.symbol == c.symbol) {
            let checks = [
                ("supplyApy", p.supply_apy, c.supply_apy),
                ("borrowApy", p.borrow_apy, c.borrow_apy),
                ("price", p.price, c.price),
                ("tvl", p.tvl, c.tvl),
            ];
            for (field, pv, cv) in &checks {
                if *pv == 0.0 {
                    continue;
                }
                let change_pct = ((cv - pv) / pv) * 100.0;
                if change_pct.abs() > 0.5 {
                    deltas.push(PoolDelta {
                        symbol: c.symbol.clone(),
                        field: field.to_string(),
                        prev: *pv,
                        curr: *cv,
                        change_pct,
                    });
                }
            }
        }
    }
    deltas.sort_by(|a, b| b.change_pct.abs().partial_cmp(&a.change_pct.abs()).unwrap());
    deltas
}

fn wallet_opps(coins: &[WalletCoin], pools: &[Pool]) -> Vec<Opportunity> {
    let mut opps = Vec::new();
    for coin in coins {
        if coin.usd_value < 1.0 {
            continue;
        }
        if let Some(pool) = pools.iter().find(|p| p.symbol == coin.symbol) {
            if pool.supply_apy > 0.5 {
                let earn = coin.usd_value * (pool.supply_apy / 100.0);
                opps.push(Opportunity {
                    rank: 0,
                    opp_type: "supply".into(),
                    name: format!("Supply {} (${:.0})", coin.symbol, coin.usd_value),
                    apy: pool.supply_apy,
                    risk: "low".into(),
                    tvl: pool.tvl,
                    detail: format!(
                        "Idle ${:.0} → ${:.2}/yr at {:.2}%",
                        coin.usd_value, earn, pool.supply_apy
                    ),
                    est_yearly_per_1k: earn,
                });
            }
        }
    }
    opps.sort_by(|a, b| b.est_yearly_per_1k.partial_cmp(&a.est_yearly_per_1k).unwrap());
    for (i, o) in opps.iter_mut().enumerate() {
        o.rank = (i + 1) as u32;
    }
    opps
}

// ── Exported WASM entry point ──

#[wasm_bindgen]
pub fn analyze(
    pools_js: JsValue,
    vaults_js: JsValue,
    prev_pools_js: JsValue,
    wallet_coins_js: JsValue,
) -> JsValue {
    let pools: Vec<Pool> = serde_wasm_bindgen::from_value(pools_js).unwrap_or_default();
    let vaults: Vec<Vault> = serde_wasm_bindgen::from_value(vaults_js).unwrap_or_default();
    let prev_pools: Vec<Pool> = serde_wasm_bindgen::from_value(prev_pools_js).unwrap_or_default();
    let wallet_coins: Vec<WalletCoin> =
        serde_wasm_bindgen::from_value(wallet_coins_js).unwrap_or_default();

    let supply_opps = rank_supply(&pools);
    let vault_opps = rank_vaults(&vaults);
    let loop_opps = find_loops(&pools);

    let mut all: Vec<Opportunity> = supply_opps
        .into_iter()
        .chain(vault_opps)
        .chain(loop_opps)
        .collect();
    all.sort_by(|a, b| b.apy.partial_cmp(&a.apy).unwrap());
    all.truncate(15);
    for (i, o) in all.iter_mut().enumerate() {
        o.rank = (i + 1) as u32;
    }

    let mut top_supply = pools.clone();
    top_supply.sort_by(|a, b| b.supply_apy.partial_cmp(&a.supply_apy).unwrap());
    top_supply.truncate(5);

    let mut top_borrow: Vec<Pool> = pools.iter().filter(|p| p.borrow_apy > 0.0).cloned().collect();
    top_borrow.sort_by(|a, b| a.borrow_apy.partial_cmp(&b.borrow_apy).unwrap());
    top_borrow.truncate(5);

    let mut top_tvl = pools.clone();
    top_tvl.sort_by(|a, b| b.tvl.partial_cmp(&a.tvl).unwrap());
    top_tvl.truncate(5);

    let result = AnalysisResult {
        opportunities: all,
        deltas: detect_deltas(&prev_pools, &pools),
        top_supply,
        top_borrow,
        top_tvl,
        wallet_opportunities: wallet_opps(&wallet_coins, &pools),
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}

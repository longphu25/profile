// NAVI Pool Analysis Engine — Pure functions, no DOM/React
// Designed for WASM port: all computation is synchronous after data fetch
// Analyzes pools, vaults, wallet positions → ranks best opportunities

// ── Types ──

export interface Pool {
  symbol: string
  coinType: string
  price: number
  supply: number
  borrow: number
  supplyApy: number
  borrowApy: number
  ltv: number
  market: string
  tvl: number
  utilization: number
}

export interface Vault {
  id: string
  name: string
  riskLevel: string
  instantAPR: number
  apy7d: number
  apy30d: number
  totalStakedUsd: number
}

export interface WalletCoin {
  symbol: string
  balance: number
  usdValue: number
  coinType: string
}

export interface ProtocolStats {
  tvl: number
  totalBorrowUsd: number
  averageUtilization: number
  maxApy: number
  userAmount: number
}

export type RiskLevel = 'low' | 'medium' | 'high'

export interface Opportunity {
  rank: number
  type: 'supply' | 'vault' | 'loop' | 'arb'
  name: string
  apy: number
  risk: RiskLevel
  tvl: number
  detail: string
  /** For supply: which pool */
  pool?: Pool
  /** For vault: which vault */
  vault?: Vault
  /** For loop: supply pool + borrow pool */
  supplyPool?: Pool
  borrowPool?: Pool
  /** Net APY after borrow cost */
  netApy?: number
  /** Estimated yearly USD for $1000 */
  estYearlyPer1k: number
}

export interface PoolDelta {
  symbol: string
  field: 'supplyApy' | 'borrowApy' | 'price' | 'tvl'
  prev: number
  curr: number
  changePct: number
}

export interface AnalysisSnapshot {
  timestamp: number
  pools: Pool[]
  vaults: Vault[]
  stats: ProtocolStats | null
  opportunities: Opportunity[]
  deltas: PoolDelta[]
  topSupply: Pool[]
  topBorrow: Pool[]
  topTvl: Pool[]
  walletOpportunities: Opportunity[]
  /** Scallop pools for cross-protocol comparison */
  scallopPools: Pool[]
  _computeMs?: number
  _engine?: string
}

// ── MCP Fetch ──

const MCP_URL = 'https://open-api.naviprotocol.io/api/mcp'

async function mcpCall(tool: string, args: Record<string, unknown> = {}) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: tool, arguments: args },
    }),
  })
  const json = await res.json()
  const text = json.result?.content?.[0]?.text
  if (!text) throw new Error('MCP call failed')
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function fetchPools(): Promise<Pool[]> {
  const data = await mcpCall('navi_get_pools')
  if (!Array.isArray(data)) return []
  return data.map((p: Record<string, unknown>) => {
    const supply = Number(p.supply) || 0
    const borrow = Number(p.borrow) || 0
    const price = Number(p.price) || 0
    return {
      symbol: String(p.symbol ?? ''),
      coinType: String(p.coinType ?? ''),
      price,
      supply,
      borrow,
      supplyApy: Number(p.supplyApy) || 0,
      borrowApy: Number(p.borrowApy) || 0,
      ltv: Number(p.ltv) || 0,
      market: String(p.market ?? ''),
      tvl: supply * price,
      utilization: supply > 0 ? borrow / supply : 0,
    }
  })
}

export async function fetchVaults(): Promise<Vault[]> {
  const csv = await mcpCall('volo_get_vaults')
  if (typeof csv !== 'string') return []
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',')
  return lines
    .slice(1)
    .map((line) => {
      const vals = line.split(',')
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        row[h] = vals[i] ?? ''
      })
      return {
        id: row.id ?? '',
        name: row.name ?? '',
        riskLevel: row.riskLevel ?? 'Low',
        instantAPR: Number(row.instantAPR) || 0,
        apy7d: Number(row.apy7d) || 0,
        apy30d: Number(row.apy30d) || 0,
        totalStakedUsd: Number(row.totalStakedUsd) || 0,
      }
    })
    .filter((v) => (v as Record<string, unknown>).status !== 'closed')
}

export async function fetchStats(): Promise<ProtocolStats | null> {
  try {
    const s = await mcpCall('navi_get_protocol_stats')
    return s as ProtocolStats
  } catch {
    return null
  }
}

// ── Scallop Fetch ──
const SCALLOP_API = 'https://sdk.api.scallop.io/api'

export async function fetchScallopPools(): Promise<Pool[]> {
  try {
    const res = await fetch(`${SCALLOP_API}/market/pools`)
    const data = await res.json()
    const poolsList = (data?.pools ?? data) as Record<string, unknown>[]
    if (!Array.isArray(poolsList)) return []
    return poolsList
      .map((p) => {
        const price = Number(p.coinPrice ?? 0)
        const supplyApyRaw = Number(p.supplyApy ?? 0)
        const borrowApyRaw = Number(p.borrowApy ?? 0)
        // Scallop returns decimal (0.05 = 5%), convert to percentage
        const supplyApy = supplyApyRaw < 1 ? supplyApyRaw * 100 : supplyApyRaw
        const borrowApy = borrowApyRaw < 1 ? borrowApyRaw * 100 : borrowApyRaw
        const supply = Number(p.totalSupply ?? 0)
        const borrow = Number(p.totalBorrow ?? 0)
        return {
          symbol: String(p.symbol ?? ''),
          coinType: String(p.coinType ?? ''),
          price,
          supply,
          borrow,
          supplyApy,
          borrowApy,
          ltv: Number(p.collateralFactor ?? 0),
          market: 'scallop',
          tvl: supply * price || Number(p.totalSupplyUsd ?? 0),
          utilization: supply > 0 ? borrow / supply : 0,
        }
      })
      .filter((p) => p.supplyApy > 0.01)
  } catch {
    return []
  }
}

const KNOWN_DECIMALS: Record<string, number> = {
  SUI: 9,
  vSUI: 9,
  haSUI: 9,
  stSUI: 9,
  NAVX: 9,
  CETUS: 9,
  WAL: 9,
  HAEDAL: 9,
  IKA: 9,
  wUSDC: 6,
  USDT: 6,
  USDC: 6,
  nUSDC: 6,
  suiUSDT: 6,
  NS: 6,
  DEEP: 6,
  WETH: 8,
  LBTC: 8,
  BTC: 8,
}

function normalizeCoinType(ct: string): string {
  return ct.replace(/^0x0+/, '0x')
}

export async function fetchWalletCoins(address: string, pools: Pool[]): Promise<WalletCoin[]> {
  const raw = await mcpCall('navi_get_coins', { address })
  if (!Array.isArray(raw)) return []
  const poolMap = new Map(pools.map((p) => [normalizeCoinType(p.coinType), p]))
  return raw.map((rc: Record<string, unknown>) => {
    const ct = normalizeCoinType(String(rc.coinType ?? ''))
    const pool = poolMap.get(ct)
    const symbol = pool?.symbol ?? ct.split('::').pop() ?? '?'
    const decimals = KNOWN_DECIMALS[symbol] ?? 9
    const balance = Number(rc.totalBalance ?? 0) / 10 ** decimals
    const price = pool?.price ?? 0
    return { symbol, balance, usdValue: balance * price, coinType: ct }
  })
}

// ── Pure Analysis Functions (WASM-portable) ──

/** Rank supply opportunities */
export function rankSupplyOpportunities(pools: Pool[]): Opportunity[] {
  return pools
    .filter((p) => p.supplyApy > 0.1)
    .sort((a, b) => b.supplyApy - a.supplyApy)
    .map((p, i) => ({
      rank: i + 1,
      type: 'supply' as const,
      name: `Supply ${p.symbol}`,
      apy: p.supplyApy,
      risk:
        p.supplyApy > 20
          ? ('high' as const)
          : p.supplyApy > 8
            ? ('medium' as const)
            : ('low' as const),
      tvl: p.tvl,
      detail: `${p.symbol} pool | TVL $${(p.tvl / 1e6).toFixed(1)}M | Util ${(p.utilization * 100).toFixed(0)}%`,
      pool: p,
      estYearlyPer1k: 1000 * (p.supplyApy / 100),
    }))
}

/** Rank vault opportunities */
export function rankVaultOpportunities(vaults: Vault[]): Opportunity[] {
  return vaults
    .filter((v) => v.apy7d > 0.1)
    .sort((a, b) => b.apy7d - a.apy7d)
    .map((v, i) => ({
      rank: i + 1,
      type: 'vault' as const,
      name: `Vault: ${v.name}`,
      apy: v.apy7d,
      risk: v.riskLevel.toLowerCase() as RiskLevel,
      tvl: v.totalStakedUsd,
      detail: `7d: ${v.apy7d.toFixed(2)}% | 30d: ${v.apy30d.toFixed(2)}% | TVL $${(v.totalStakedUsd / 1e6).toFixed(1)}M`,
      vault: v,
      estYearlyPer1k: 1000 * (v.apy7d / 100),
    }))
}

/** Find profitable supply+borrow loops */
export function findLoopOpportunities(pools: Pool[]): Opportunity[] {
  const loops: Opportunity[] = []
  // For each pair: supply asset A, borrow asset B where supplyApy(A) > borrowApy(B) * LTV
  for (const supplyPool of pools) {
    if (supplyPool.supplyApy < 1) continue
    for (const borrowPool of pools) {
      if (borrowPool.borrowApy <= 0 || borrowPool.symbol === supplyPool.symbol) continue
      const safeLtv = Math.min(supplyPool.ltv * 0.6, 0.5) // conservative
      if (safeLtv <= 0) continue
      const netApy = supplyPool.supplyApy - borrowPool.borrowApy * safeLtv
      if (netApy < 1) continue // not worth it
      loops.push({
        rank: 0,
        type: 'loop',
        name: `Supply ${supplyPool.symbol} → Borrow ${borrowPool.symbol}`,
        apy: netApy,
        netApy,
        risk: netApy > 10 ? 'high' : 'medium',
        tvl: Math.min(supplyPool.tvl, borrowPool.tvl),
        detail: `Supply ${supplyPool.supplyApy.toFixed(2)}% - Borrow ${borrowPool.borrowApy.toFixed(2)}% × ${(safeLtv * 100).toFixed(0)}% LTV = Net ${netApy.toFixed(2)}%`,
        supplyPool,
        borrowPool,
        estYearlyPer1k: 1000 * (netApy / 100),
      })
    }
  }
  return loops
    .sort((a, b) => b.apy - a.apy)
    .slice(0, 10)
    .map((l, i) => ({ ...l, rank: i + 1 }))
}

/** Detect changes between two snapshots */
export function detectDeltas(prev: Pool[], curr: Pool[]): PoolDelta[] {
  const deltas: PoolDelta[] = []
  const prevMap = new Map(prev.map((p) => [p.symbol, p]))
  for (const c of curr) {
    const p = prevMap.get(c.symbol)
    if (!p) continue
    const checks: { field: PoolDelta['field']; prev: number; curr: number }[] = [
      { field: 'supplyApy', prev: p.supplyApy, curr: c.supplyApy },
      { field: 'borrowApy', prev: p.borrowApy, curr: c.borrowApy },
      { field: 'price', prev: p.price, curr: c.price },
      { field: 'tvl', prev: p.tvl, curr: c.tvl },
    ]
    for (const ch of checks) {
      if (ch.prev === 0) continue
      const changePct = ((ch.curr - ch.prev) / ch.prev) * 100
      if (Math.abs(changePct) > 0.5) {
        // >0.5% change threshold
        deltas.push({ symbol: c.symbol, field: ch.field, prev: ch.prev, curr: ch.curr, changePct })
      }
    }
  }
  return deltas.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
}

/** Wallet-specific: find best actions for coins user holds */
export function walletOpportunities(
  coins: WalletCoin[],
  pools: Pool[],
  _vaults: Vault[],
): Opportunity[] {
  const opps: Opportunity[] = []
  for (const coin of coins) {
    if (coin.usdValue < 1) continue
    const pool = pools.find((p) => p.symbol === coin.symbol)
    if (pool && pool.supplyApy > 0.5) {
      const earn = coin.usdValue * (pool.supplyApy / 100)
      opps.push({
        rank: 0,
        type: 'supply',
        name: `Supply ${coin.symbol} ($${coin.usdValue.toFixed(0)})`,
        apy: pool.supplyApy,
        risk: 'low',
        tvl: pool.tvl,
        detail: `Idle $${coin.usdValue.toFixed(0)} → $${earn.toFixed(2)}/yr at ${pool.supplyApy.toFixed(2)}%`,
        pool,
        estYearlyPer1k: coin.usdValue * (pool.supplyApy / 100),
      })
    }
  }
  return opps
    .sort((a, b) => b.estYearlyPer1k - a.estYearlyPer1k)
    .map((o, i) => ({ ...o, rank: i + 1 }))
}

/** Full analysis: combine all data into a ranked snapshot */
export function buildSnapshot(
  pools: Pool[],
  vaults: Vault[],
  stats: ProtocolStats | null,
  prevPools: Pool[],
  walletCoins: WalletCoin[],
  scallopPools: Pool[] = [],
): AnalysisSnapshot {
  const supplyOpps = rankSupplyOpportunities(pools)
  const vaultOpps = rankVaultOpportunities(vaults)
  const loopOpps = findLoopOpportunities(pools)

  // Cross-protocol: Scallop supply opportunities
  const scallopOpps: Opportunity[] = scallopPools
    .filter((p) => p.supplyApy > 0.1)
    .sort((a, b) => b.supplyApy - a.supplyApy)
    .slice(0, 5)
    .map((p, i) => ({
      rank: i + 1,
      type: 'supply' as const,
      name: `[Scallop] Supply ${p.symbol}`,
      apy: p.supplyApy,
      risk:
        p.supplyApy > 20
          ? ('high' as const)
          : p.supplyApy > 8
            ? ('medium' as const)
            : ('low' as const),
      tvl: p.tvl,
      detail: `Scallop ${p.symbol} | TVL $${(p.tvl / 1e6).toFixed(1)}M | Util ${(p.utilization * 100).toFixed(0)}%`,
      pool: p,
      estYearlyPer1k: 1000 * (p.supplyApy / 100),
    }))

  // Merge and rank all opportunities
  const all = [...supplyOpps, ...vaultOpps, ...loopOpps, ...scallopOpps]
    .sort((a, b) => b.apy - a.apy)
    .map((o, i) => ({ ...o, rank: i + 1 }))

  return {
    timestamp: Date.now(),
    pools,
    vaults,
    stats,
    opportunities: all.slice(0, 20),
    deltas: detectDeltas(prevPools, pools),
    topSupply: [...pools].sort((a, b) => b.supplyApy - a.supplyApy).slice(0, 5),
    topBorrow: [...pools]
      .filter((p) => p.borrowApy > 0)
      .sort((a, b) => a.borrowApy - b.borrowApy)
      .slice(0, 5),
    topTvl: [...pools].sort((a, b) => b.tvl - a.tvl).slice(0, 5),
    walletOpportunities: walletOpportunities(walletCoins, pools, vaults),
    scallopPools,
  }
}

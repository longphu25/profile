// NAVI MCP API client — calls NAVI Protocol MCP endpoint

const MCP_URL = 'https://open-api.naviprotocol.io/api/mcp'

let reqId = 0

async function mcpCall(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++reqId,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  })
  const json = await res.json()
  const content = json.result?.content
  if (!content?.[0]?.text) throw new Error(json.error?.message ?? 'MCP call failed')
  const text = content[0].text as string
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// ─── Protocol ───
export async function getProtocolStats() {
  return mcpCall('navi_get_protocol_stats') as Promise<{
    tvl: number
    totalBorrowUsd: number
    averageUtilization: number
    maxApy: number
    userAmount: number
  }>
}

// ─── Pools ───
export interface Pool {
  symbol: string
  coinType: string
  id: number
  supplyApy: number
  borrowApy: number
  tvl: number
  supply: number
  borrow: number
  price: number
  ltv: number
  market: string
}

export async function getPools(): Promise<Pool[]> {
  const data = await mcpCall('navi_get_pools')
  if (!Array.isArray(data)) return []
  return data.map((p: Record<string, unknown>) => {
    const supply = Number(p.supply) || 0
    const borrow = Number(p.borrow) || 0
    const price = Number(p.price) || 0
    return {
      symbol: String(p.symbol ?? ''),
      coinType: String(p.coinType ?? ''),
      id: Number(p.id) || 0,
      supplyApy: Number(p.supplyApy) || 0,
      borrowApy: Number(p.borrowApy) || 0,
      supply,
      borrow,
      price,
      tvl: supply * price,
      ltv: Number(p.ltv) || 0,
      market: String(p.market ?? ''),
    }
  })
}

// ─── Health Factor ───
export async function getHealthFactor(address: string) {
  return mcpCall('navi_get_health_factor', { address }) as Promise<{
    healthFactor: number
    totalSupplyUsd: number
    totalBorrowUsd: number
  }>
}

// ─── Wallet ───
export interface CoinBalance {
  coinType: string
  symbol: string
  balance: number
  usdValue: number
}

export async function getCoins(address: string): Promise<CoinBalance[]> {
  const data = await mcpCall('navi_get_coins', { address })
  return Array.isArray(data) ? data : []
}

// ─── Positions ───
export async function getPositions(address: string) {
  return mcpCall('get_positions', { address })
}

// ─── Rewards ───
export async function getAvailableRewards(address: string) {
  return mcpCall('navi_get_available_rewards', { address })
}

// ─── Swap Quote ───
export interface SwapQuote {
  fromToken: string
  toToken: string
  fromAmount: number
  toAmount: number
  priceImpact: number
  route: string
}

export async function getSwapQuote(fromCoin: string, toCoin: string, amount: number) {
  return mcpCall('navi_get_swap_quote', { fromCoin, toCoin, amount })
}

// ─── Token Search ───
export async function searchTokens(keyword: string) {
  return mcpCall('navi_search_tokens', { keyword })
}

// ─── Volo Vaults ───
export async function getVaults() {
  return mcpCall('volo_get_vaults')
}

// ─── Tx Explain ───
export async function explainTransaction(digest: string) {
  return mcpCall('sui_explain_transaction', { digest })
}

// ─── Portfolio PnL ───
export async function getPortfolioPnl(address: string, period: '1W' | '15D' | '1M' = '1W') {
  return mcpCall('navi_get_portfolio_pnl', { address, period })
}

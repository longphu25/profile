// NAVI MCP Chatbot — Conversational DeFi advisor
// Uses MCP tools to analyze wallet, suggest strategies, and interact with NAVI ecosystem

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useRef, useCallback } from 'react'
import './style.css'

let sharedHost: SuiHostAPI | null = null
const WALLET_KEY = 'walletProfile'
const MCP_URL = 'https://open-api.naviprotocol.io/api/mcp'

// ─── MCP Call ───
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

// ─── Token resolver ───
// navi_get_coins returns { coinType, totalBalance } — no symbol/decimals/price
// Strategy: use navi_get_pools for price + known decimals, fallback to navi_search_tokens

interface TokenMeta {
  symbol: string
  decimals: number
  price: number
}

// Known decimals for common SUI tokens (from NAVI pool configs)
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

let poolPriceCache: Record<string, { symbol: string; price: number; coinType: string }> | null =
  null

// Normalize coinType: "0x0000...0002::sui::SUI" → "0x2::sui::SUI"
function normalizeCoinType(ct: string): string {
  return ct.replace(/^0x0+/, '0x')
}

async function getPoolPrices(): Promise<
  Record<string, { symbol: string; price: number; coinType: string }>
> {
  if (poolPriceCache) return poolPriceCache
  const pools = await mcpCall('navi_get_pools')
  const map: Record<string, { symbol: string; price: number; coinType: string }> = {}
  if (Array.isArray(pools)) {
    for (const p of pools) {
      const ct = normalizeCoinType(String(p.coinType ?? ''))
      map[ct] = { symbol: String(p.symbol ?? ''), price: Number(p.price) || 0, coinType: ct }
    }
  }
  poolPriceCache = map
  return map
}

// Extract symbol from coinType: "0x...::module::SYMBOL" → "SYMBOL"
function symbolFromCoinType(ct: string): string {
  const parts = ct.split('::')
  return parts.length >= 3 ? parts[parts.length - 1] : ct.slice(0, 8)
}

// Search token price via MCP for tokens not in pools
const searchCache: Record<string, TokenMeta> = {}
async function searchTokenMeta(symbol: string, coinType: string): Promise<TokenMeta> {
  if (searchCache[coinType]) return searchCache[coinType]
  try {
    const csv = await mcpCall('navi_search_tokens', { keyword: symbol })
    if (typeof csv === 'string') {
      const lines = csv.trim().split('\n')
      for (const line of lines.slice(1)) {
        const parts = line.split(',')
        if (parts.length >= 4 && coinType.includes(parts[0])) {
          const meta = {
            symbol: parts[1],
            decimals: Number(parts[2]) || 9,
            price: Number(parts[3]) || 0,
          }
          searchCache[coinType] = meta
          return meta
        }
      }
      // Partial match by symbol
      for (const line of lines.slice(1)) {
        const parts = line.split(',')
        if (parts.length >= 4 && parts[1] === symbol) {
          const meta = {
            symbol: parts[1],
            decimals: Number(parts[2]) || 9,
            price: Number(parts[3]) || 0,
          }
          searchCache[coinType] = meta
          return meta
        }
      }
    }
  } catch {
    /* ignore */
  }
  return { symbol, decimals: KNOWN_DECIMALS[symbol] ?? 9, price: 0 }
}

// ─── Types ───
interface ChatMessage {
  role: 'user' | 'bot'
  text: string
  actions?: ChatAction[]
}

interface ChatAction {
  label: string
  query: string
}

interface CoinInfo {
  symbol: string
  balance: number
  usdValue: number
  coinType: string
}

interface RawCoin {
  coinType: string
  totalBalance: string
  objectCount: number
}

interface PoolInfo {
  symbol: string
  coinType: string
  supplyApy: number
  borrowApy: number
  supply: string
  tvl: number
  price: number
  ltv: number
}

async function resolveCoins(address: string): Promise<CoinInfo[]> {
  const [rawCoins, poolPrices] = await Promise.all([
    mcpCall('navi_get_coins', { address }) as Promise<RawCoin[]>,
    getPoolPrices(),
  ])
  if (!Array.isArray(rawCoins)) return []

  const results: CoinInfo[] = []
  // Resolve tokens not found in pools via search (parallel, max 5)
  const unknowns: { idx: number; symbol: string; coinType: string }[] = []

  for (const rc of rawCoins) {
    const ct = normalizeCoinType(rc.coinType)
    const poolMatch = poolPrices[ct]
    const symbol = poolMatch?.symbol ?? symbolFromCoinType(ct)

    if (poolMatch) {
      const decimals = KNOWN_DECIMALS[symbol] ?? 9
      const balance = Number(rc.totalBalance) / 10 ** decimals
      results.push({ symbol, balance, usdValue: balance * poolMatch.price, coinType: ct })
    } else {
      // Placeholder — will resolve below
      results.push({ symbol, balance: 0, usdValue: 0, coinType: ct })
      unknowns.push({ idx: results.length - 1, symbol, coinType: ct })
    }
  }

  // Resolve unknown tokens (limit to 5 to avoid too many MCP calls)
  const searches = unknowns.slice(0, 5).map(async (u) => {
    const meta = await searchTokenMeta(u.symbol, u.coinType)
    const raw = rawCoins.find((r) => normalizeCoinType(r.coinType) === u.coinType)
    if (raw) {
      const balance = Number(raw.totalBalance) / 10 ** meta.decimals
      results[u.idx] = {
        symbol: meta.symbol,
        balance,
        usdValue: balance * meta.price,
        coinType: u.coinType,
      }
    }
  })
  await Promise.all(searches)

  return results
}

// ─── Intent Detection ───
type Intent =
  | 'wallet_summary'
  | 'best_yield'
  | 'health_check'
  | 'rewards'
  | 'swap_quote'
  | 'pool_info'
  | 'bridge'
  | 'positions'
  | 'help'
  | 'unknown'

function detectIntent(msg: string): { intent: Intent; params: Record<string, string> } {
  const m = msg.toLowerCase().trim()
  const params: Record<string, string> = {}

  if (/wallet|balance|token|ví|số dư|tài sản/.test(m)) return { intent: 'wallet_summary', params }
  if (/yield|apy|lãi|earn|farm|supply|gửi|deposit|chiến lược|strategy/.test(m))
    return { intent: 'best_yield', params }
  if (/health|risk|liquidat|rủi ro|thanh lý|sức khỏe/.test(m))
    return { intent: 'health_check', params }
  if (/reward|claim|thưởng|phần thưởng/.test(m)) return { intent: 'rewards', params }
  if (/swap|đổi|exchange|convert/.test(m)) {
    const swapMatch = m.match(/(\w+)\s*(?:to|→|->|sang|thành)\s*(\w+)/)
    if (swapMatch) {
      params.from = swapMatch[1].toUpperCase()
      params.to = swapMatch[2].toUpperCase()
    }
    return { intent: 'swap_quote', params }
  }
  if (/pool|thị trường|market/.test(m)) return { intent: 'pool_info', params }
  if (/bridge|cross.?chain|chuyển chuỗi/.test(m)) return { intent: 'bridge', params }
  if (/position|vị thế|danh mục/.test(m)) return { intent: 'positions', params }
  if (/help|hướng dẫn|giúp|menu|command/.test(m)) return { intent: 'help', params }

  return { intent: 'unknown', params }
}

// ─── Response Generators ───
async function handleWalletSummary(address: string): Promise<ChatMessage> {
  const coins = await resolveCoins(address)
  if (coins.length === 0) {
    return {
      role: 'bot',
      text: '💼 Ví trống hoặc không tìm thấy token nào.',
      actions: [{ label: '🔍 Xem pool NAVI', query: 'pool info' }],
    }
  }

  const totalUsd = coins.reduce((s, c) => s + c.usdValue, 0)
  const lines = coins
    .filter((c) => c.usdValue > 0.01 || c.balance > 0)
    .sort((a, b) => b.usdValue - a.usdValue)
    .slice(0, 10)
    .map((c) => {
      const usdStr = c.usdValue > 0.01 ? ` (~$${c.usdValue.toFixed(2)})` : ''
      return `• **${c.symbol}**: ${c.balance < 0.0001 ? c.balance.toExponential(2) : c.balance.toFixed(4)}${usdStr}`
    })

  const actions: ChatAction[] = [
    { label: '📈 Gợi ý yield tốt nhất', query: 'best yield' },
    { label: '❤️ Kiểm tra health factor', query: 'health check' },
    { label: '🎁 Kiểm tra rewards', query: 'check rewards' },
  ]

  // Check for idle assets that could earn yield
  const idleHint =
    totalUsd > 10
      ? `\n\n💡 Bạn có ~$${totalUsd.toFixed(0)} trong ví. Hỏi "best yield" để xem cách tối ưu lợi nhuận!`
      : ''

  return {
    role: 'bot',
    text: `💼 **Tổng quan ví** — $${totalUsd.toFixed(2)}\n\n${lines.join('\n')}${idleHint}`,
    actions,
  }
}

async function handleBestYield(address: string | null): Promise<ChatMessage> {
  const [pools, coins] = await Promise.all([
    mcpCall('navi_get_pools') as Promise<PoolInfo[]>,
    address ? resolveCoins(address) : Promise.resolve([]),
  ])

  if (!Array.isArray(pools)) {
    return { role: 'bot', text: '❌ Không lấy được dữ liệu pool.' }
  }

  const topPools = [...pools]
    .map((p) => ({ ...p, supplyApy: Number(p.supplyApy) || 0 }))
    .filter((p) => p.supplyApy > 0)
    .sort((a, b) => b.supplyApy - a.supplyApy)
    .slice(0, 5)

  let text = '📈 **Top Supply APY trên NAVI:**\n\n'
  text += topPools
    .map((p, i) => `${i + 1}. **${p.symbol}** — ${p.supplyApy.toFixed(2)}% APY`)
    .join('\n')

  // Personalized suggestions if wallet connected
  if (coins.length > 0) {
    const matchedCoins = coins.filter((c) => {
      const pool = pools.find((p) => p.symbol === c.symbol)
      return pool && c.usdValue > 1
    })

    if (matchedCoins.length > 0) {
      text += '\n\n💡 **Token trong ví có thể supply:**\n'
      for (const c of matchedCoins.slice(0, 3)) {
        const pool = pools.find((p) => p.symbol === c.symbol)
        if (pool) {
          const earn = c.usdValue * (Number(pool.supplyApy) / 100)
          text += `\n• **${c.symbol}**: $${c.usdValue.toFixed(0)} → ~$${earn.toFixed(2)}/năm (${Number(pool.supplyApy).toFixed(2)}% APY)`
        }
      }
    }
  }

  const actions: ChatAction[] = [
    { label: '💼 Xem ví', query: 'wallet summary' },
    { label: '🔄 Swap quote', query: 'swap SUI to USDC' },
  ]

  return { role: 'bot', text, actions }
}

async function handleHealthCheck(address: string): Promise<ChatMessage> {
  const health = await mcpCall('navi_get_health_factor', { address })

  if (!health || health.healthFactor == null) {
    return {
      role: 'bot',
      text: '✅ Bạn chưa có vị thế vay/mượn trên NAVI. Health factor không áp dụng.',
      actions: [{ label: '📈 Xem yield', query: 'best yield' }],
    }
  }

  const hf = Number(health.healthFactor)
  const supplyUsd = Number(health.totalSupplyUsd) || 0
  const borrowUsd = Number(health.totalBorrowUsd) || 0
  const utilization = supplyUsd > 0 ? ((borrowUsd / supplyUsd) * 100).toFixed(1) : '0'

  let status: string
  let emoji: string
  if (hf > 2) {
    status = 'An toàn'
    emoji = '🟢'
  } else if (hf > 1.5) {
    status = 'Cần theo dõi'
    emoji = '🟡'
  } else {
    status = 'NGUY HIỂM — Có thể bị thanh lý!'
    emoji = '🔴'
  }

  const text = `${emoji} **Health Factor: ${hf.toFixed(2)}** — ${status}

• Supply: $${supplyUsd.toFixed(0)}
• Borrow: $${borrowUsd.toFixed(0)}
• Utilization: ${utilization}%${hf < 1.5 ? '\n\n⚠️ Khuyến nghị: Repay bớt hoặc thêm collateral ngay!' : ''}`

  return {
    role: 'bot',
    text,
    actions: [
      { label: '💼 Xem ví', query: 'wallet' },
      { label: '🎁 Check rewards', query: 'rewards' },
    ],
  }
}

async function handleRewards(address: string): Promise<ChatMessage> {
  const rewards = await mcpCall('navi_get_available_rewards', { address })

  if (!rewards || (Array.isArray(rewards) && rewards.length === 0)) {
    return {
      role: 'bot',
      text: '🎁 Không có rewards chưa claim. Hãy supply token để bắt đầu nhận rewards!',
      actions: [{ label: '📈 Xem yield', query: 'best yield' }],
    }
  }

  const entries = Array.isArray(rewards) ? rewards : Object.values(rewards)
  const totalUsd = entries.reduce(
    (s: number, r: Record<string, unknown>) => s + Number(r?.usdValue ?? r?.value ?? 0),
    0,
  )

  let text = `🎁 **Rewards chưa claim:** ~$${totalUsd.toFixed(2)}\n\n`
  for (const r of entries) {
    const rv = r as Record<string, unknown>
    text += `• ${rv.symbol ?? rv.asset ?? 'Token'}: $${Number(rv.usdValue ?? rv.value ?? 0).toFixed(2)}\n`
  }
  text += '\n→ Claim tại [NAVI Portfolio](https://app.naviprotocol.io/portfolio)'

  return {
    role: 'bot',
    text,
    actions: [{ label: '💼 Xem ví', query: 'wallet' }],
  }
}

async function handleSwapQuote(params: Record<string, string>): Promise<ChatMessage> {
  const from = params.from || 'SUI'
  const to = params.to || 'USDC'

  const quote = await mcpCall('navi_get_swap_quote', {
    fromCoin: from,
    toCoin: to,
    amount: 1,
  })

  if (!quote || typeof quote === 'string') {
    return { role: 'bot', text: `❌ Không lấy được quote cho ${from} → ${to}. Thử lại sau.` }
  }

  const q = quote as Record<string, unknown>
  const text = `🔄 **Swap Quote: ${from} → ${to}**

• 1 ${from} ≈ ${Number(q.toAmount ?? q.outputAmount ?? 0).toFixed(6)} ${to}
• Price Impact: ${Number(q.priceImpact ?? 0).toFixed(4)}%
• Route: ${q.route ?? 'Best route'}

💡 Gõ "swap X to Y" để xem quote khác.`

  return {
    role: 'bot',
    text,
    actions: [
      { label: '🔄 SUI → USDT', query: 'swap SUI to USDT' },
      { label: '🔄 USDC → SUI', query: 'swap USDC to SUI' },
    ],
  }
}

async function handlePoolInfo(): Promise<ChatMessage> {
  const pools = (await mcpCall('navi_get_pools')) as PoolInfo[]
  if (!Array.isArray(pools)) {
    return { role: 'bot', text: '❌ Không lấy được dữ liệu pool.' }
  }

  const sorted = [...pools]
    .map((p) => ({
      ...p,
      tvl: Number(p.supply) * Number(p.price) || 0,
      supplyApy: Number(p.supplyApy) || 0,
      borrowApy: Number(p.borrowApy) || 0,
    }))
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, 8)

  let text = '🏦 **NAVI Markets (Top TVL):**\n\n'
  text += sorted
    .map(
      (p) =>
        `• **${p.symbol}** — Supply: ${p.supplyApy.toFixed(2)}% | Borrow: ${p.borrowApy.toFixed(2)}% | TVL: $${(p.tvl / 1e6).toFixed(1)}M`,
    )
    .join('\n')

  return {
    role: 'bot',
    text,
    actions: [
      { label: '📈 Best yield', query: 'best yield' },
      { label: '🔄 Swap', query: 'swap SUI to USDC' },
    ],
  }
}

async function handleBridge(): Promise<ChatMessage> {
  const chains = await mcpCall('navi_get_bridge_chains')
  const chainList = Array.isArray(chains)
    ? chains.map((c: Record<string, unknown>) => c.name ?? c.chain ?? c).join(', ')
    : 'Ethereum, Solana, Arbitrum, BSC...'

  return {
    role: 'bot',
    text: `🌉 **NAVI Bridge (Astros)**

Hỗ trợ bridge cross-chain:
${chainList}

→ Bridge tại [NAVI Bridge](https://app.naviprotocol.io/bridge)`,
    actions: [
      { label: '💼 Xem ví', query: 'wallet' },
      { label: '🔄 Swap', query: 'swap SUI to USDC' },
    ],
  }
}

async function handlePositions(address: string): Promise<ChatMessage> {
  const positions = await mcpCall('get_positions', { address })

  if (!positions || (Array.isArray(positions) && positions.length === 0)) {
    return {
      role: 'bot',
      text: '📊 Không tìm thấy vị thế DeFi nào. Hãy supply token trên NAVI để bắt đầu!',
      actions: [{ label: '📈 Xem yield', query: 'best yield' }],
    }
  }

  let text = '📊 **Vị thế DeFi (multi-protocol):**\n\n'
  if (Array.isArray(positions)) {
    for (const pos of positions.slice(0, 10)) {
      const p = pos as Record<string, unknown>
      text += `• ${p.protocol ?? 'Unknown'}: ${p.symbol ?? p.asset ?? ''} — $${Number(p.usdValue ?? p.value ?? 0).toFixed(2)}\n`
    }
  } else {
    text += JSON.stringify(positions, null, 2).slice(0, 500)
  }

  return {
    role: 'bot',
    text,
    actions: [
      { label: '❤️ Health check', query: 'health' },
      { label: '🎁 Rewards', query: 'rewards' },
    ],
  }
}

function getHelpMessage(): ChatMessage {
  return {
    role: 'bot',
    text: `🤖 **NAVI Chatbot — Hướng dẫn**

Tôi có thể giúp bạn:

• **"wallet"** — Xem token trong ví
• **"best yield"** — Gợi ý APY tốt nhất
• **"health"** — Kiểm tra health factor
• **"rewards"** — Xem rewards chưa claim
• **"swap SUI to USDC"** — Xem swap quote
• **"pool"** — Xem thị trường NAVI
• **"bridge"** — Thông tin bridge cross-chain
• **"positions"** — Xem vị thế DeFi

💡 Hỗ trợ cả tiếng Việt và tiếng Anh!`,
    actions: [
      { label: '💼 Xem ví', query: 'wallet' },
      { label: '📈 Best yield', query: 'best yield' },
      { label: '🏦 Markets', query: 'pool info' },
    ],
  }
}

// ─── Main Component ───
function NaviChatbotContent() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [walletAddr, setWalletAddr] = useState<string | null>(() => {
    const d = sharedHost?.getSharedData(WALLET_KEY) as { address: string } | null
    return d?.address ?? null
  })
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSharedDataChange(WALLET_KEY, (v) => {
      const addr = (v as { address: string } | null)?.address ?? null
      setWalletAddr(addr)
      if (addr && messages.length === 0) {
        // Auto-greet when wallet connects
        processQuery('wallet summary', addr)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Show welcome on first load
  useEffect(() => {
    if (messages.length === 0) {
      const welcome: ChatMessage = walletAddr
        ? {
            role: 'bot',
            text: `👋 Xin chào! Ví đã kết nối: \`${walletAddr.slice(0, 6)}…${walletAddr.slice(-4)}\`\n\nTôi sẽ phân tích ví của bạn...`,
            actions: [],
          }
        : {
            role: 'bot',
            text: '👋 Xin chào! Tôi là **NAVI Chatbot** — trợ lý DeFi trên SUI.\n\nKết nối ví để nhận gợi ý cá nhân hóa, hoặc hỏi tôi về thị trường NAVI!',
            actions: [
              { label: '🏦 Xem markets', query: 'pool info' },
              { label: '📈 Top yield', query: 'best yield' },
              { label: '❓ Hướng dẫn', query: 'help' },
            ],
          }
      setMessages([welcome])

      if (walletAddr) {
        processQuery('wallet summary', walletAddr)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const processQuery = useCallback(
    async (query: string, addr?: string | null) => {
      const address = addr ?? walletAddr
      setLoading(true)
      try {
        const { intent, params } = detectIntent(query)
        let response: ChatMessage

        switch (intent) {
          case 'wallet_summary':
            if (!address) {
              response = {
                role: 'bot',
                text: '⚠️ Vui lòng kết nối ví trước để xem token.',
                actions: [{ label: '🏦 Xem markets', query: 'pool info' }],
              }
            } else {
              response = await handleWalletSummary(address)
            }
            break
          case 'best_yield':
            response = await handleBestYield(address ?? null)
            break
          case 'health_check':
            if (!address) {
              response = {
                role: 'bot',
                text: '⚠️ Cần kết nối ví để kiểm tra health factor.',
              }
            } else {
              response = await handleHealthCheck(address)
            }
            break
          case 'rewards':
            if (!address) {
              response = { role: 'bot', text: '⚠️ Cần kết nối ví để xem rewards.' }
            } else {
              response = await handleRewards(address)
            }
            break
          case 'swap_quote':
            response = await handleSwapQuote(params)
            break
          case 'pool_info':
            response = await handlePoolInfo()
            break
          case 'bridge':
            response = await handleBridge()
            break
          case 'positions':
            if (!address) {
              response = { role: 'bot', text: '⚠️ Cần kết nối ví để xem vị thế.' }
            } else {
              response = await handlePositions(address)
            }
            break
          case 'help':
            response = getHelpMessage()
            break
          default:
            response = {
              role: 'bot',
              text: `🤔 Tôi chưa hiểu "${query}". Thử hỏi về wallet, yield, health, swap, pool, hoặc gõ "help"!`,
              actions: [
                { label: '❓ Hướng dẫn', query: 'help' },
                { label: '📈 Best yield', query: 'best yield' },
              ],
            }
        }

        setMessages((prev) => [...prev, response])
      } catch (e: unknown) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'bot',
            text: `❌ Lỗi: ${e instanceof Error ? e.message : String(e)}`,
            actions: [{ label: '🔄 Thử lại', query: input }],
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [walletAddr, input],
  )

  function handleSend() {
    const q = input.trim()
    if (!q || loading) return
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setInput('')
    processQuery(q)
  }

  function handleAction(query: string) {
    if (loading) return
    setMessages((prev) => [...prev, { role: 'user', text: query }])
    processQuery(query)
  }

  // Simple markdown-like rendering
  function renderText(text: string) {
    return text.split('\n').map((line, i) => {
      const formatted = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(
          /`(0x[a-fA-F0-9]{10,})`/g,
          '<code class="navi-cb__addr" data-addr="$1" title="Click to copy">$1</code>',
        )
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(
          /\[(.+?)\]\((.+?)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
        )
      return (
        <div
          key={i}
          className="navi-cb__line"
          dangerouslySetInnerHTML={{ __html: formatted }}
          onClick={(e) => {
            const target = e.target as HTMLElement
            if (target.classList.contains('navi-cb__addr')) {
              const addr = target.getAttribute('data-addr')
              if (addr) {
                navigator.clipboard.writeText(addr)
                target.classList.add('navi-cb__addr--copied')
                setTimeout(() => target.classList.remove('navi-cb__addr--copied'), 1500)
              }
            }
          }}
        />
      )
    })
  }

  return (
    <div className="navi-cb">
      <div className="navi-cb__header">
        <div className="navi-cb__header-left">
          <svg
            className="navi-cb__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="navi-cb__title">NAVI Chatbot</span>
        </div>
        {walletAddr && (
          <span
            className="navi-cb__wallet"
            title="Click to copy full address"
            onClick={() => {
              navigator.clipboard.writeText(walletAddr)
              // Brief visual feedback
              const el = document.querySelector('.navi-cb__wallet') as HTMLElement
              if (el) {
                el.classList.add('navi-cb__wallet--copied')
                setTimeout(() => el.classList.remove('navi-cb__wallet--copied'), 1500)
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            {walletAddr.slice(0, 6)}…{walletAddr.slice(-4)}
          </span>
        )}
      </div>

      <div className="navi-cb__messages">
        {messages.map((msg, i) => (
          <div key={i} className={`navi-cb__msg navi-cb__msg--${msg.role}`}>
            <div className="navi-cb__bubble">{renderText(msg.text)}</div>
            {msg.actions && msg.actions.length > 0 && (
              <div className="navi-cb__actions">
                {msg.actions.map((a, j) => (
                  <button
                    type="button"
                    key={j}
                    className="navi-cb__action-btn"
                    onClick={() => handleAction(a.query)}
                    disabled={loading}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="navi-cb__msg navi-cb__msg--bot">
            <div className="navi-cb__bubble navi-cb__bubble--loading">
              <span className="navi-cb__dot" />
              <span className="navi-cb__dot" />
              <span className="navi-cb__dot" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="navi-cb__input-row">
        <input
          className="navi-cb__input"
          type="text"
          placeholder={walletAddr ? 'Hỏi về ví, yield, swap...' : 'Hỏi về NAVI, pool, yield...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={loading}
        />
        <button
          type="button"
          className="navi-cb__send"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="18"
            height="18"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const SuiNaviChatbotPlugin: Plugin = {
  name: 'SuiNaviChatbot',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-navi-chatbot/style.css'],
  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiNaviChatbot', NaviChatbotContent)
    host.log('SuiNaviChatbot initialized')
  },
  mount() {
    console.log('[SuiNaviChatbot] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiNaviChatbot] unmounted')
  },
}

export default SuiNaviChatbotPlugin

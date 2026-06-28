// BTC Chart — symbol catalog, custom-symbol persistence, exchange interval maps.

export type Exchange = 'binance' | 'bybit' | 'mexc' | 'okx'

export type SymbolId = string

export interface SymbolEntry {
  symbol: string
  base: string
  quote: string
  exchange: Exchange
  mexcSymbol?: string
  okxInstId?: string
  bybitCategory?: string
  /** CoinGecko coin id for supply lookup (e.g. "bitcoin"). */
  geckoId?: string
}

export const SYMBOLS = [
  {
    symbol: 'BTCUSDT',
    base: 'BTC',
    quote: 'USDT',
    exchange: 'binance' as Exchange,
    geckoId: 'bitcoin',
  },
  {
    symbol: 'ETHUSDT',
    base: 'ETH',
    quote: 'USDT',
    exchange: 'binance' as Exchange,
    geckoId: 'ethereum',
  },
  {
    symbol: 'SOLUSDT',
    base: 'SOL',
    quote: 'USDT',
    exchange: 'binance' as Exchange,
    geckoId: 'solana',
  },
  {
    symbol: 'SUIUSDT',
    base: 'SUI',
    quote: 'USDT',
    exchange: 'binance' as Exchange,
    geckoId: 'sui',
  },
  {
    symbol: 'HYPEUSDT',
    base: 'HYPE',
    quote: 'USDT',
    exchange: 'binance' as Exchange,
    geckoId: 'hyperliquid',
  },
  { symbol: 'CHIPUSDT', base: 'CHIP', quote: 'USDT', exchange: 'binance' as Exchange },
  {
    symbol: 'LABUSDT',
    base: 'LAB',
    quote: 'USDT',
    exchange: 'binance' as Exchange,
    mexcSymbol: 'LAB_USDT',
  },
  {
    symbol: 'OKBUSDT',
    base: 'OKB',
    quote: 'USDT',
    exchange: 'okx' as Exchange,
    okxInstId: 'OKB-USDT-SWAP',
  },
  { symbol: 'REUSDT', base: 'RE', quote: 'USDT', exchange: 'binance' as Exchange },
  { symbol: 'BICOUSDT', base: 'BICO', quote: 'USDT', exchange: 'binance' as Exchange },
  {
    symbol: 'RESOLVUSDT',
    base: 'RESOLV',
    quote: 'USDT',
    exchange: 'binance' as Exchange,
    geckoId: 'resolv',
  },
  {
    symbol: 'ACTUSDT',
    base: 'ACT',
    quote: 'USDT',
    exchange: 'binance' as Exchange,
    geckoId: 'act-i-the-ai-prophecy',
  },
] as const

export function loadCustomSymbols(): SymbolEntry[] {
  try {
    return JSON.parse(localStorage.getItem('btc-chart:custom-symbols') || '[]')
  } catch {
    return []
  }
}

export function saveCustomSymbols(list: SymbolEntry[]) {
  localStorage.setItem('btc-chart:custom-symbols', JSON.stringify(list))
}

// Bybit interval mapping from Binance format
export const BYBIT_INTERVAL: Record<string, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': 'D',
}
// MEXC futures interval mapping
export const MEXC_INTERVAL: Record<string, string> = {
  '1m': 'Min1',
  '5m': 'Min5',
  '15m': 'Min15',
  '1h': 'Hour1',
  '4h': 'Hour4',
  '1d': 'Day1',
}
// OKX interval mapping
export const OKX_INTERVAL: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
}

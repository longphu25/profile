import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'

// ── Constants ──────────────────────────────────────────────────────────────────

export const INDEXER: Record<string, string> = {
  mainnet: 'https://deepbook-indexer.mainnet.mystenlabs.com',
  testnet: 'https://deepbook-indexer.testnet.mystenlabs.com',
}

export const RPC: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type BotStage = 'idle' | 'opening' | 'holding' | 'closing' | 'error'

export type BotStrategy = 'taker' | 'maker' | 'volume' | 'directional' | 'margin'

export interface PoolMarketData {
  pool: string
  price: number
  change24h: number
  volume: number
  spread: number
}

export interface LogEntry {
  ts: number
  level: 'info' | 'warn' | 'error' | 'success'
  msg: string
}

export interface CycleRecord {
  num: number
  openPrice: number
  closePrice: number
  pnl: number
  duration: number
}

export interface BotConfig {
  pool: string
  notionalUsd: number
  holdMinSec: number
  holdMaxSec: number
  maxCycles: number | null
  intervalMs: number
  strategy: BotStrategy
}

export interface OBLevel {
  price: number
  size: number
  total: number
}

export interface WalletBalance {
  sui: number
  coins: { symbol: string; balance: string }[]
  loading: boolean
}

export interface MmBalances {
  base: number
  quote: number
  baseDebt: number
  quoteDebt: number
}

export const DEFAULT_CONFIG: BotConfig = {
  pool: 'SUI_USDC',
  notionalUsd: 4,
  holdMinSec: 150,
  holdMaxSec: 210,
  maxCycles: 3,
  intervalMs: 5000,
  strategy: 'margin',
}

/** Deps passed to strategy functions (avoids coupling to React hooks) */
export interface StrategyDeps {
  network: 'mainnet' | 'testnet'
  config: BotConfig
  addLog: (level: LogEntry['level'], msg: string) => void
  signAndExec: (kp: Ed25519Keypair, tx: unknown, net: string) => Promise<unknown>
  setStage: (s: BotStage) => void
  setCurrentPrice: (p: number) => void
  setOrderPrices: (p: { bid: number | null; ask: number | null }) => void
  setTotalVolume: (fn: (v: number) => number) => void
  setTotalPnl: (fn: (v: number) => number) => void
  setHistory: (fn: (h: CycleRecord[]) => CycleRecord[]) => void
  setHoldStart: (v: number | null) => void
  setHoldEnd: (v: number | null) => void
  stageRef: { current: BotStage }
  cycleRef: { current: number }
  setCycleNum: (n: number) => void
}

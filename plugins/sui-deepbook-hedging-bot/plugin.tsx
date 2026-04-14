// SUI DeepBook Hedging Bot Plugin — Client-Side Browser Bot
// Runs hedging cycles entirely in the browser using imported keypairs.
// No server needed — signs transactions directly via Ed25519Keypair.
//
// Architecture: Import 2 keys (Account A = Long, Account B = Short)
// → bot loop via setInterval → open/hold/close cycles → live dashboard

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography'
import {
  DeepBookClient,
  mainnetCoins,
  mainnetPools,
  mainnetPackageIds,
  testnetCoins,
  testnetPools,
  testnetPackageIds,
} from '@mysten/deepbook-v3'
import './style.css'

// ── Constants ──────────────────────────────────────────────────────────────────

const INDEXER: Record<string, string> = {
  mainnet: 'https://deepbook-indexer.mainnet.mystenlabs.com',
  testnet: 'https://deepbook-indexer.testnet.mystenlabs.com',
}
const RPC: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
}

type BotStage = 'idle' | 'opening' | 'holding' | 'closing' | 'error'

interface PoolMarketData {
  pool: string
  price: number
  change24h: number
  volume: number
  spread: number
}

interface LogEntry {
  ts: number
  level: 'info' | 'warn' | 'error' | 'success'
  msg: string
}

interface CycleRecord {
  num: number
  openPrice: number
  closePrice: number
  pnl: number
  duration: number
}

interface BotConfig {
  pool: string
  notionalUsd: number
  holdMinSec: number
  holdMaxSec: number
  maxCycles: number | null
  intervalMs: number
}

interface OBLevel {
  price: number
  size: number
  total: number
}

interface WalletBalance {
  sui: number
  coins: { symbol: string; balance: string }[]
  loading: boolean
}

const DEFAULT_CONFIG: BotConfig = {
  pool: 'DEEP_SUI',
  notionalUsd: 10,
  holdMinSec: 60,
  holdMaxSec: 180,
  maxCycles: null,
  intervalMs: 5000,
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatUsd(v: number): string {
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(2)}K`
  return `$${v.toFixed(2)}`
}

function formatOBPrice(v: number): string {
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (v >= 1) return v.toFixed(4)
  if (v >= 0.001) return v.toFixed(5)
  return v.toFixed(8)
}

function formatQty(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toFixed(2)
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

function randRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function keypairFromSecret(secret: string): Ed25519Keypair | null {
  try {
    const trimmed = secret.trim()
    if (!trimmed) return null
    // suiprivkey1... bech32 format
    if (trimmed.startsWith('suiprivkey')) {
      const { secretKey } = decodeSuiPrivateKey(trimmed)
      return Ed25519Keypair.fromSecretKey(secretKey)
    }
    // base64 (keystore format: flag byte + 32 bytes, or raw 32 bytes)
    const bytes = Uint8Array.from(
      atob(trimmed)
        .split('')
        .map((c) => c.charCodeAt(0)),
    )
    const secret32 = bytes.length > 32 ? bytes.slice(1, 33) : bytes.slice(0, 32)
    return Ed25519Keypair.fromSecretKey(secret32)
  } catch {
    return null
  }
}

// ── Shared host ────────────────────────────────────────────────────────────────

let sharedHost: SuiHostAPI | null = null

// ── Component ──────────────────────────────────────────────────────────────────

function HedgingBotContent() {
  const [network, setNetwork] = useState<string>('mainnet')
  const [tab, setTab] = useState<'setup' | 'dashboard' | 'history' | 'logs' | 'accounts'>('setup')

  // Keys
  const [keyA, setKeyA] = useState('')
  const [keyB, setKeyB] = useState('')
  const [addrA, setAddrA] = useState<string | null>(null)
  const [addrB, setAddrB] = useState<string | null>(null)
  const [keystoreKeys, setKeystoreKeys] = useState<
    { key: string; addr: string; coins: { symbol: string; balance: string }[] }[]
  >([])
  const fileRef = useRef<HTMLInputElement | null>(null)

  // Password dialog
  const [pwDialog, setPwDialog] = useState<{
    mode: 'encrypt' | 'decrypt'
    file?: File
    resolve: (pw: string | null) => void
  } | null>(null)
  const [pwInput, setPwInput] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwError, setPwError] = useState('')

  const askPassword = useCallback(
    (mode: 'encrypt' | 'decrypt', file?: File): Promise<string | null> => {
      return new Promise((resolve) => {
        setPwInput('')
        setPwConfirm('')
        setPwError('')
        setPwDialog({ mode, file, resolve })
      })
    },
    [],
  )

  // Config
  const [config, setConfig] = useState<BotConfig>({ ...DEFAULT_CONFIG })

  // Bot state
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState<BotStage>('idle')
  const [cycleNum, setCycleNum] = useState(0)
  const [holdEnd, setHoldEnd] = useState<number | null>(null)
  const [holdStart, setHoldStart] = useState<number | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [history, setHistory] = useState<CycleRecord[]>([])
  const [error, setError] = useState<string | null>(null)

  // Stats
  const [totalPnl, setTotalPnl] = useState(0)
  const [totalVolume, setTotalVolume] = useState(0)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [orderPrices, setOrderPrices] = useState<{ open: number | null; side: 'A' | 'B' | null }>({
    open: null,
    side: null,
  })
  const [markets, setMarkets] = useState<PoolMarketData[]>([])
  const [marketsLoading, setMarketsLoading] = useState(false)

  // Orderbook
  const [obBids, setObBids] = useState<OBLevel[]>([])
  const [obAsks, setObAsks] = useState<OBLevel[]>([])

  // Wallet balances
  const [balA, setBalA] = useState<WalletBalance>({ sui: 0, coins: [], loading: false })
  const [balB, setBalB] = useState<WalletBalance>({ sui: 0, coins: [], loading: false })

  // Refs for interval
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stageRef = useRef<BotStage>('idle')
  const cycleRef = useRef(0)
  const keypairARef = useRef<Ed25519Keypair | null>(null)
  const keypairBRef = useRef<Ed25519Keypair | null>(null)

  // Sync network from host
  useEffect(() => {
    if (!sharedHost) return
    const ctx = sharedHost.getSuiContext()
    if (ctx.network === 'mainnet' || ctx.network === 'testnet') setNetwork(ctx.network)
    return sharedHost.onSuiContextChange((c) => {
      if (c.network === 'mainnet' || c.network === 'testnet') setNetwork(c.network)
    })
  }, [])

  // Derive addresses from keys
  useEffect(() => {
    const kp = keypairFromSecret(keyA)
    keypairARef.current = kp
    setAddrA(kp ? kp.getPublicKey().toSuiAddress() : null)
  }, [keyA])

  useEffect(() => {
    const kp = keypairFromSecret(keyB)
    keypairBRef.current = kp
    setAddrB(kp ? kp.getPublicKey().toSuiAddress() : null)
  }, [keyB])

  const addLog = useCallback((level: LogEntry['level'], msg: string) => {
    setLogs((prev) => [...prev.slice(-200), { ts: Date.now(), level, msg }])
  }, [])

  // Handle keystore file import (sui.keystore JSON format)
  // Fetch all coin balances for an address via JSON-RPC
  const fetchAllCoins = useCallback(
    async (addr: string): Promise<{ symbol: string; balance: string }[]> => {
      try {
        const res = await fetch(RPC[network], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'suix_getAllBalances',
            params: [addr],
          }),
        })
        const data: {
          result: { coinType: string; totalBalance: string; coinObjectCount: number }[]
        } = await res.json()
        return (data.result || []).map((b) => {
          const parts = b.coinType.split('::')
          const symbol = parts[parts.length - 1]
          // Known decimals: SUI=9, USDC/USDT/AUSD=6, DEEP=6, WAL=9, NS=6, WUSDC=6, WUSDT=6
          const sym = symbol.toUpperCase()
          const dec = ['USDC', 'USDT', 'DEEP', 'NS', 'AUSD', 'WUSDC', 'WUSDT', 'COIN'].includes(sym)
            ? 6
            : ['SUI', 'WAL', 'SCA', 'CETUS'].includes(sym)
              ? 9
              : b.coinType.includes('usdc') || b.coinType.includes('usdt')
                ? 6
                : 9
          const val = (Number(b.totalBalance) / 10 ** dec).toFixed(4)
          return { symbol, balance: val }
        })
      } catch {
        return []
      }
    },
    [network],
  )

  const handleKeystoreFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const text = reader.result as string
          const keys: string[] = JSON.parse(text)
          if (!Array.isArray(keys) || keys.length === 0) throw new Error('Empty keystore')
          const parsed = keys.map((b64) => {
            const bytes = Uint8Array.from(
              atob(b64)
                .split('')
                .map((c) => c.charCodeAt(0)),
            )
            const secret = bytes.length > 32 ? bytes.slice(1, 33) : bytes.slice(0, 32)
            const kp = Ed25519Keypair.fromSecretKey(secret)
            return {
              key: b64,
              addr: kp.getPublicKey().toSuiAddress(),
              coins: [] as { symbol: string; balance: string }[],
            }
          })
          setKeystoreKeys(parsed)
          // Fetch balances in parallel
          const withCoins = await Promise.all(
            parsed.map(async (k) => ({ ...k, coins: await fetchAllCoins(k.addr) })),
          )
          setKeystoreKeys(withCoins)
        } catch (err) {
          setError(`Invalid keystore: ${err instanceof Error ? err.message : err}`)
        }
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    [fetchAllCoins],
  )

  // ── Encrypted keystore (PBKDF2 + AES-GCM via Web Crypto) ────────────────

  const deriveKey = useCallback(async (password: string, salt: Uint8Array) => {
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    )
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 600000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  }, [])

  const handleEncryptExport = useCallback(async () => {
    if (!keyA && !keyB) {
      setError('Import keys first before encrypting')
      return
    }
    const password = await askPassword('encrypt')
    if (!password) return
    try {
      const payload = JSON.stringify({ a: keyA, b: keyB })
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const key = await deriveKey(password, salt)
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(payload),
      )
      // Pack: salt(16) + iv(12) + ciphertext
      const packed = new Uint8Array(16 + 12 + encrypted.byteLength)
      packed.set(salt, 0)
      packed.set(iv, 16)
      packed.set(new Uint8Array(encrypted), 28)
      // Download as file
      const blob = new Blob([packed], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'hedging-bot.vault'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(`Encrypt failed: ${err instanceof Error ? err.message : err}`)
    }
  }, [keyA, keyB, deriveKey])

  const encFileRef = useRef<HTMLInputElement | null>(null)

  // Generate 2 fresh Ed25519 wallets
  const [generatedWallets, setGeneratedWallets] = useState<{ addr: string; b64: string }[] | null>(
    null,
  )

  const handleGenerate2Wallets = useCallback(() => {
    const kpA = Ed25519Keypair.generate()
    const kpB = Ed25519Keypair.generate()
    // getSecretKey() returns bech32 suiprivkey1... string
    const skA = kpA.getSecretKey()
    const skB = kpB.getSecretKey()
    setKeyA(skA)
    setKeyB(skB)
    setGeneratedWallets([
      { addr: kpA.getPublicKey().toSuiAddress(), b64: skA },
      { addr: kpB.getPublicKey().toSuiAddress(), b64: skB },
    ])
  }, [])

  const handleExportKeystore = useCallback(() => {
    if (!generatedWallets) return
    // Export as sui.keystore compatible format (base64 of flag+secret)
    const keys = generatedWallets.map((w) => {
      const { secretKey } = decodeSuiPrivateKey(w.b64)
      const flagged = new Uint8Array(33)
      flagged[0] = 0x00 // Ed25519 flag
      flagged.set(secretKey, 1)
      return btoa(String.fromCharCode(...flagged))
    })
    const json = JSON.stringify(keys, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hedging-bot.keystore'
    a.click()
    URL.revokeObjectURL(url)
  }, [generatedWallets])

  const handleDecryptImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''
      const password = await askPassword('decrypt', file)
      if (!password) return
      try {
        const buf = await file.arrayBuffer()
        const packed = new Uint8Array(buf)
        if (packed.length < 29) throw new Error('File too small')
        const salt = packed.slice(0, 16)
        const iv = packed.slice(16, 28)
        const ciphertext = packed.slice(28)
        const key = await deriveKey(password, salt)
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
        const payload: { a: string; b: string } = JSON.parse(new TextDecoder().decode(decrypted))
        if (payload.a) setKeyA(payload.a)
        if (payload.b) setKeyB(payload.b)
      } catch {
        setError('Decrypt failed — wrong password or corrupted file')
      }
    },
    [deriveKey],
  )

  // Fetch current price
  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(`${INDEXER[network]}/ticker`)
      if (!res.ok) return
      const data: Record<string, { last_price: number }> = await res.json()
      const entry = data[config.pool]
      if (entry) setCurrentPrice(entry.last_price)
    } catch {
      /* silent */
    }
  }, [network, config.pool])

  // Fetch market data for all pools (volatility ranking)
  const fetchMarkets = useCallback(async () => {
    setMarketsLoading(true)
    try {
      const res = await fetch(`${INDEXER[network]}/summary`)
      if (!res.ok) return
      const data: Array<{
        trading_pairs: string
        last_price: number
        price_change_percent_24h: number
        quote_volume: number
        highest_bid: number
        lowest_ask: number
      }> = await res.json()
      const rows: PoolMarketData[] = data
        .filter((d) => d.last_price > 0 && d.quote_volume > 0)
        .map((d) => {
          const spread =
            d.highest_bid > 0 && d.lowest_ask > 0
              ? ((d.lowest_ask - d.highest_bid) / d.last_price) * 100
              : 99
          return {
            pool: d.trading_pairs,
            price: d.last_price,
            change24h: Math.abs(d.price_change_percent_24h),
            volume: d.quote_volume,
            spread,
          }
        })
        .sort((a, b) => a.change24h - b.change24h)
      setMarkets(rows)
    } catch {
      /* silent */
    }
    setMarketsLoading(false)
  }, [network])

  // Fetch orderbook for selected pool
  const fetchOrderbook = useCallback(async () => {
    try {
      const res = await fetch(`${INDEXER[network]}/orderbook/${config.pool}?level=2&depth=20`)
      if (!res.ok) return
      const data: { bids: [string, string][]; asks: [string, string][] } = await res.json()
      const parse = (raw: [string, string][]): OBLevel[] => {
        let cum = 0
        return raw.slice(0, 10).map(([p, s]) => {
          const size = parseFloat(s)
          cum += size
          return { price: parseFloat(p), size, total: cum }
        })
      }
      setObBids(parse(data.bids))
      setObAsks(parse(data.asks))
    } catch {
      /* silent */
    }
  }, [network, config.pool])

  // Fetch SUI balance for an address
  const fetchBalance = useCallback(
    async (addr: string): Promise<WalletBalance> => {
      try {
        const coins = await fetchAllCoins(addr)
        const suiEntry = coins.find((c) => c.symbol === 'SUI')
        const sui = suiEntry ? parseFloat(suiEntry.balance) : 0
        return { sui, coins, loading: false }
      } catch {
        return { sui: 0, coins: [], loading: false }
      }
    },
    [fetchAllCoins],
  )

  // ── Bot cycle logic ──────────────────────────────────────────────────────────

  const executeCycle = useCallback(async () => {
    const kpA = keypairARef.current
    const kpB = keypairBRef.current
    if (!kpA || !kpB) return

    const net = network as 'mainnet' | 'testnet'
    const client = new SuiGrpcClient({ network: net, baseUrl: RPC[net] })
    const indexer = INDEXER[net]
    const aAddr = kpA.getPublicKey().toSuiAddress()
    const bAddr = kpB.getPublicKey().toSuiAddress()
    const poolKey = config.pool
    const sdkPools = net === 'mainnet' ? mainnetPools : testnetPools

    // OPEN phase
    stageRef.current = 'opening'
    setStage('opening')
    const num = cycleRef.current + 1
    cycleRef.current = num
    setCycleNum(num)
    addLog('info', `Cycle #${num} — Opening positions...`)

    const getSuiBal = async (addr: string) => {
      const r = await fetch(RPC[net], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getBalance',
          params: [addr, '0x2::sui::SUI'],
        }),
      })
      const d: { result: { totalBalance: string } } = await r.json()
      return Number(d.result.totalBalance) / 1e9
    }

    let openPrice = 0
    let quotePerLeg = 0
    try {
      const tickerRes = await fetch(`${indexer}/ticker`)
      const ticker: Record<string, { last_price: number }> = await tickerRes.json()
      openPrice = ticker[poolKey]?.last_price ?? 0
      setCurrentPrice(openPrice)
      if (!openPrice) throw new Error('Cannot fetch price')

      // Determine quote amount to spend per leg based on actual balance
      const [, quote] = poolKey.split('_')

      let quotePerLegCalc: number
      if (quote === 'SUI') {
        const aBal = await getSuiBal(aAddr)
        const suiUsd = ticker['SUI_USDC']?.last_price ?? 1
        const notionalInSui = config.notionalUsd / suiUsd
        quotePerLegCalc = Math.min(notionalInSui, aBal - 0.5) * 0.8
      } else {
        quotePerLegCalc = config.notionalUsd * 0.8
      }
      if (quotePerLegCalc <= 0) throw new Error(`Not enough ${quote} in wallet A`)
      quotePerLeg = quotePerLegCalc
      const qty = quotePerLeg / openPrice
      addLog(
        'info',
        `Mid price: ${formatOBPrice(openPrice)} — Quote/leg: ${quotePerLeg.toFixed(4)} ${quote} — Qty: ${qty.toFixed(4)}`,
      )

      if (!(poolKey in sdkPools)) throw new Error(`Pool ${poolKey} not in SDK`)

      // Account A: BUY base (spend quote → get base)
      const makeDb = (addr: string) =>
        new DeepBookClient({
          client,
          address: addr,
          network: net,
          coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
          pools: sdkPools,
          packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
        })
      const txA = new Transaction()
      buildSwapBuy(makeDb(aAddr), poolKey, quotePerLeg, aAddr, txA)
      addLog('info', 'Signing A (BUY)...')
      await signAndExec(kpA, txA, net)
      addLog('success', `A: BUY ${qty.toFixed(4)} filled`)

      // Account B: SELL base (spend base → get quote)
      const txB = new Transaction()
      buildSwapSell(makeDb(bAddr), poolKey, qty, bAddr, txB)
      addLog('info', 'Signing B (SELL)...')
      await signAndExec(kpB, txB, net)
      addLog('success', `B: SELL ${qty.toFixed(4)} filled`)

      setOrderPrices({ open: openPrice, side: 'A' })
      setTotalVolume((v) => v + config.notionalUsd * 2)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addLog('error', `Open failed: ${msg}`)
      stageRef.current = 'error'
      setStage('error')
      setError(msg)
      return
    }

    // HOLD phase
    stageRef.current = 'holding'
    setStage('holding')
    const holdSec = randRange(config.holdMinSec, config.holdMaxSec)
    const holdEndTs = Date.now() + holdSec * 1000
    setHoldStart(Date.now())
    setHoldEnd(holdEndTs)
    addLog('info', `Holding for ${holdSec}s...`)

    await new Promise((r) => setTimeout(r, holdSec * 1000))

    if (stageRef.current !== 'holding') {
      addLog('warn', 'Cycle interrupted during hold')
      return
    }

    // CLOSE phase
    stageRef.current = 'closing'
    setStage('closing')
    addLog('info', `Cycle #${num} — Closing positions...`)

    let closePrice = 0
    try {
      const tickerRes = await fetch(`${indexer}/ticker`)
      const ticker: Record<string, { last_price: number }> = await tickerRes.json()
      closePrice = ticker[poolKey]?.last_price ?? openPrice
      setCurrentPrice(closePrice)

      // Close: use actual balances
      const [, quote] = poolKey.split('_')
      const getBalClose = async (addr: string, coinType: string) => {
        const r = await fetch(RPC[net], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'suix_getBalance',
            params: [addr, coinType],
          }),
        })
        const d: { result: { totalBalance: string } } = await r.json()
        return Number(d.result.totalBalance)
      }

      // Close A: SELL all base back (get base balance of A)
      const pools = net === 'mainnet' ? mainnetPools : testnetPools
      const poolInfo = pools[poolKey as keyof typeof pools] as { baseCoin: string } | undefined
      const baseCoinKey = poolInfo?.baseCoin
      const baseCoinType = baseCoinKey
        ? (net === 'mainnet' ? mainnetCoins : testnetCoins)[
            baseCoinKey as keyof typeof mainnetCoins
          ]?.type
        : undefined

      let sellQty: number
      if (baseCoinType) {
        const baseBalRaw = await getBalClose(aAddr, baseCoinType)
        const baseDec = baseCoinType.includes('sui::SUI') ? 9 : 6
        sellQty = (baseBalRaw / 10 ** baseDec) * 0.95 // sell 95% of base
      } else {
        sellQty = quotePerLeg / openPrice // fallback
      }

      const makeDb2 = (addr: string) =>
        new DeepBookClient({
          client,
          address: addr,
          network: net,
          coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
          pools: sdkPools,
          packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
        })
      const txA = new Transaction()
      buildSwapSell(makeDb2(aAddr), poolKey, sellQty, aAddr, txA)
      addLog('info', `Closing A (SELL ${sellQty.toFixed(4)})...`)
      await signAndExec(kpA, txA, net)
      addLog('success', `A: SELL filled at ${formatOBPrice(closePrice)}`)

      // Close B: BUY base back — spend SUI (check B's SUI balance)
      let closeQuote: number
      if (quote === 'SUI') {
        const bSui = await getSuiBal(bAddr)
        closeQuote = (bSui - 0.5) * 0.8
      } else {
        closeQuote = config.notionalUsd * 0.8
      }
      if (closeQuote <= 0) throw new Error(`Not enough ${quote} in wallet B for close`)
      const txB = new Transaction()
      buildSwapBuy(makeDb2(bAddr), poolKey, closeQuote, bAddr, txB)
      addLog('info', `Closing B (BUY ${closeQuote.toFixed(4)} ${quote})...`)
      await signAndExec(kpB, txB, net)
      addLog('success', `B: BUY filled at ${formatOBPrice(closePrice)}`)

      // PnL from price difference (hedged = near zero, profit from maker rebates)
      const priceDiff = closePrice - openPrice
      const pnl = priceDiff * (config.notionalUsd / openPrice) // A gains, B loses (net ~0)
      setTotalPnl((p) => p + pnl)
      setTotalVolume((v) => v + config.notionalUsd * 2)
      setHistory((h) => [{ num, openPrice, closePrice, pnl, duration: holdSec }, ...h.slice(0, 49)])
      addLog(pnl >= 0 ? 'success' : 'warn', `Cycle #${num} done — PnL: ${formatUsd(pnl)}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addLog('error', `Close failed: ${msg}`)
      stageRef.current = 'error'
      setStage('error')
      setError(msg)
      return
    }

    setHoldEnd(null)
    setHoldStart(null)
    setOrderPrices({ open: null, side: null })

    // Check max cycles
    if (config.maxCycles && num >= config.maxCycles) {
      addLog('info', `Reached max cycles (${config.maxCycles}) — stopping`)
      stageRef.current = 'idle'
      setStage('idle')
      setRunning(false)
      return
    }

    stageRef.current = 'idle'
    setStage('idle')
  }, [network, config, addLog])

  // ── Auto-balance: split SUI + swap for pool tokens ────────────────────────

  const [balancing, setBalancing] = useState(false)

  const signAndExec = useCallback(async (kp: Ed25519Keypair, tx: Transaction, net: string) => {
    const client = new SuiGrpcClient({ network: net, baseUrl: RPC[net] })
    tx.setSender(kp.getPublicKey().toSuiAddress())
    const built = await tx.build({ client })
    const sig = await kp.signTransaction(built)
    return client.executeTransaction({
      transaction: built,
      signatures: [sig.signature],
    })
  }, [])

  /** Build a swap tx that transfers returned coins back to owner */
  const buildSwapBuy = (
    db: DeepBookClient,
    poolKey: string,
    quoteAmount: number,
    owner: string,
    tx: Transaction,
  ) => {
    const [baseCoin, quoteCoin, deepCoin] = db.deepBook.swapExactQuoteForBase({
      poolKey,
      amount: quoteAmount,
      deepAmount: 0,
      minOut: 0,
    })(tx)
    tx.transferObjects([baseCoin, quoteCoin, deepCoin], owner)
  }

  const buildSwapSell = (
    db: DeepBookClient,
    poolKey: string,
    baseAmount: number,
    owner: string,
    tx: Transaction,
  ) => {
    const [baseCoin, quoteCoin, deepCoin] = db.deepBook.swapExactBaseForQuote({
      poolKey,
      amount: baseAmount,
      deepAmount: 0,
      minOut: 0,
    })(tx)
    tx.transferObjects([baseCoin, quoteCoin, deepCoin], owner)
  }

  const autoBalance = useCallback(async () => {
    const kpA = keypairARef.current
    const kpB = keypairBRef.current
    if (!kpA || !kpB) {
      setError('Import both keys first')
      return
    }

    const net = network as 'mainnet' | 'testnet'
    const client = new SuiGrpcClient({ network: net, baseUrl: RPC[net] })
    const aAddr = kpA.getPublicKey().toSuiAddress()
    const bAddr = kpB.getPublicKey().toSuiAddress()
    const poolKey = config.pool
    const [base] = poolKey.split('_')

    // 1. Get prices
    addLog('info', 'Auto-balance: fetching prices...')
    const tickerRes = await fetch(`${INDEXER[net]}/ticker`)
    const ticker: Record<string, { last_price: number }> = await tickerRes.json()
    const suiUsd = ticker['SUI_USDC']?.last_price ?? 1

    // 2. Get all balances for both wallets (USD value)
    const getUsdValue = async (addr: string) => {
      const coins = await fetchAllCoins(addr)
      let total = 0
      for (const c of coins) {
        const amt = parseFloat(c.balance)
        if (c.symbol === 'SUI') total += amt * suiUsd
        else if (c.symbol === 'USDC' || c.symbol === 'USDT') total += amt
        else if (c.symbol === 'DEEP')
          total +=
            amt *
            (ticker['DEEP_USDC']?.last_price ?? (ticker['DEEP_SUI']?.last_price ?? 0) * suiUsd)
        else if (c.symbol === 'WAL')
          total +=
            amt * (ticker['WAL_USDC']?.last_price ?? (ticker['WAL_SUI']?.last_price ?? 0) * suiUsd)
        else if (c.symbol === 'NS')
          total +=
            amt * (ticker['NS_USDC']?.last_price ?? (ticker['NS_SUI']?.last_price ?? 0) * suiUsd)
        // other tokens: skip (small value)
      }
      return { coins, total }
    }

    const [valA, valB] = await Promise.all([getUsdValue(aAddr), getUsdValue(bAddr)])
    const totalUsd = valA.total + valB.total
    addLog(
      'info',
      `A: $${valA.total.toFixed(2)} | B: $${valB.total.toFixed(2)} | Total: $${totalUsd.toFixed(2)}`,
    )

    // 3. Check if B already has base token
    const bHasBase = valB.coins.some((c) => c.symbol === base && parseFloat(c.balance) > 0)

    // 4. Transfer SUI to equalize USD value (if diff > $1)
    const diffUsd = valA.total - valB.total
    const gasReserve = 0.3
    if (Math.abs(diffUsd) > 1) {
      const transferUsd = Math.abs(diffUsd) / 2
      const transferSui = transferUsd / suiUsd
      const fromKp = diffUsd > 0 ? kpA : kpB
      const toAddr = diffUsd > 0 ? bAddr : aAddr
      // Check sender has enough SUI
      const senderSui = parseFloat(
        (diffUsd > 0 ? valA : valB).coins.find((c) => c.symbol === 'SUI')?.balance ?? '0',
      )
      const actualTransferSui = Math.min(transferSui, senderSui - gasReserve)
      if (actualTransferSui > 0.1) {
        addLog(
          'info',
          `Transferring ${actualTransferSui.toFixed(4)} SUI ($${(actualTransferSui * suiUsd).toFixed(2)}) ${diffUsd > 0 ? 'A→B' : 'B→A'}...`,
        )
        const tx = new Transaction()
        const [coin] = tx.splitCoins(tx.gas, [Math.floor(actualTransferSui * 1e9)])
        tx.transferObjects([coin], toAddr)
        await signAndExec(fromKp, tx, net)
        addLog('success', 'Transfer done')
      } else {
        addLog('info', `Sender only has ${senderSui.toFixed(4)} SUI — skip transfer`)
      }
    } else {
      addLog('info', `Diff $${Math.abs(diffUsd).toFixed(2)} < $1 — balanced`)
    }

    // 5. Swap: B needs base token (only if B doesn't have it yet)
    const sdkPools = net === 'mainnet' ? mainnetPools : testnetPools
    if (!(poolKey in sdkPools)) {
      addLog('warn', `Pool ${poolKey} not in SDK — skip swap`)
    } else if (base !== 'SUI' && !bHasBase) {
      // B needs to swap SUI → base
      const bSui = parseFloat(valB.coins.find((c) => c.symbol === 'SUI')?.balance ?? '0')
      // After transfer, re-check
      const freshBSui = bHasBase
        ? bSui
        : await (async () => {
            const r = await fetch(RPC[net], {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'suix_getBalance',
                params: [bAddr, '0x2::sui::SUI'],
              }),
            })
            const d: { result: { totalBalance: string } } = await r.json()
            return Number(d.result.totalBalance) / 1e9
          })()
      const swapSui = (freshBSui - gasReserve) * 0.9
      if (swapSui <= 0) throw new Error('Not enough SUI in B for swap')
      addLog('info', `Swapping ${swapSui.toFixed(4)} SUI → ${base} for Account B...`)

      const dbClient = new DeepBookClient({
        client,
        address: bAddr,
        network: net,
        coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
        pools: sdkPools,
        packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
      })
      const tx2 = new Transaction()
      buildSwapBuy(dbClient, poolKey, swapSui, bAddr, tx2)
      await signAndExec(kpB, tx2, net)
      addLog('success', `Swapped ${swapSui.toFixed(4)} SUI → ${base}`)
    } else if (base === 'SUI') {
      addLog('info', 'Base is SUI — no swap needed')
    } else {
      addLog('info', `B already has ${base} — skip swap`)
    }

    // Refresh balances
    const [newBalA, newBalB] = await Promise.all([fetchBalance(aAddr), fetchBalance(bAddr)])
    setBalA(newBalA)
    setBalB(newBalB)
    addLog('success', 'Auto-balance complete!')
  }, [network, config.pool, addLog, signAndExec, fetchBalance])

  // ── Start / Stop ─────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (!keypairARef.current || !keypairBRef.current) {
      setError('Import both private keys first')
      return
    }
    setError(null)
    setRunning(true)
    setTab('dashboard')
    addLog(
      'info',
      `Bot starting — Pool: ${config.pool}, Notional: ${formatUsd(config.notionalUsd)}`,
    )

    // Auto-balance before first cycle
    addLog('info', 'Running auto-balance...')
    setBalancing(true)
    try {
      await autoBalance()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addLog('error', `Auto-balance failed: ${msg}`)
      setError(`Auto-balance: ${msg}`)
      setBalancing(false)
      setRunning(false)
      return
    }
    setBalancing(false)

    addLog('info', 'Starting cycle loop...')
    executeCycle()
    intervalRef.current = setInterval(() => {
      if (stageRef.current === 'idle') executeCycle()
    }, config.intervalMs)
  }, [config, executeCycle, addLog, autoBalance])

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    stageRef.current = 'idle'
    setStage('idle')
    setRunning(false)
    setHoldEnd(null)
    setHoldStart(null)
    addLog('warn', 'Bot stopped by user')
  }, [addLog])

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    },
    [],
  )

  // Price polling
  useEffect(() => {
    fetchPrice()
    const id = setInterval(fetchPrice, 15000)
    return () => clearInterval(id)
  }, [fetchPrice])

  // Fetch markets on mount / network change
  useEffect(() => {
    fetchMarkets()
  }, [fetchMarkets])

  // Orderbook polling
  useEffect(() => {
    fetchOrderbook()
    const id = setInterval(fetchOrderbook, 5000)
    return () => clearInterval(id)
  }, [fetchOrderbook])

  // Fetch balances when addresses change
  useEffect(() => {
    if (!addrA) {
      setBalA({ sui: 0, coins: [], loading: false })
      return
    }
    setBalA((b) => ({ ...b, loading: true }))
    fetchBalance(addrA).then(setBalA)
  }, [addrA, fetchBalance])

  useEffect(() => {
    if (!addrB) {
      setBalB({ sui: 0, coins: [], loading: false })
      return
    }
    setBalB((b) => ({ ...b, loading: true }))
    fetchBalance(addrB).then(setBalB)
  }, [addrB, fetchBalance])

  // Hold progress
  const holdPct =
    holdStart && holdEnd
      ? Math.min(100, ((Date.now() - holdStart) / (holdEnd - holdStart)) * 100)
      : 0

  // Force re-render for hold bar
  const [, setTick] = useState(0)
  useEffect(() => {
    if (stage !== 'holding') return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [stage])

  const keysReady = !!addrA && !!addrB

  // Funding analysis
  const midPrice =
    obBids[0] && obAsks[0] ? (obBids[0].price + obAsks[0].price) / 2 : (currentPrice ?? 0)
  const spreadPct =
    obBids[0] && obAsks[0] && midPrice > 0
      ? ((obAsks[0].price - obBids[0].price) / midPrice) * 100
      : 0
  const perWalletUsd = config.notionalUsd
  const gasReserve = 0.5
  const totalNeeded = perWalletUsd * 2
  const balAOk = balA.sui * (currentPrice ?? 0) >= perWalletUsd + gasReserve
  const balBOk = balB.sui * (currentPrice ?? 0) >= perWalletUsd + gasReserve

  return (
    <div className="sui-hb">
      <div className="sui-hb__header">
        <h3 className="sui-hb__title">DeepBook Hedging Bot</h3>
        <p className="sui-hb__desc">Client-side hedging bot — runs entirely in your browser</p>
      </div>

      {/* Tabs */}
      <div className="sui-hb__tabs">
        {(['setup', 'dashboard', 'history', 'logs', 'accounts'] as const).map((t) => (
          <button
            key={t}
            className={`sui-hb__tab ${tab === t ? 'sui-hb__tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {
              {
                setup: 'Setup',
                dashboard: 'Dashboard',
                history: 'History',
                logs: 'Logs',
                accounts: 'Accounts',
              }[t]
            }
          </button>
        ))}
      </div>

      {error && <div className="sui-hb__error">{error}</div>}

      {/* 2-column layout: orderbook left, content right */}
      <div className="sui-hb__layout">
        {/* ── LEFT: Mini Orderbook ── */}
        <div className="sui-hb__sidebar">
          <div className="sui-hb__card">
            <div className="sui-hb__card-title">{config.pool.replace('_', ' / ')} Orderbook</div>
            {/* Mid price + spread */}
            {midPrice > 0 && (
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#f8fafc',
                    fontFamily: "'Fira Code', monospace",
                  }}
                >
                  {formatOBPrice(midPrice)}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  Spread: {spreadPct.toFixed(3)}%
                </div>
              </div>
            )}
            {/* Asks (reversed, lowest at bottom) */}
            <div className="sui-hb__ob">
              {obAsks.length > 0 ? (
                <>
                  <div className="sui-hb__ob-hdr">
                    <span>Price</span>
                    <span>Size</span>
                    <span>Total</span>
                  </div>
                  {[...obAsks].reverse().map((l, i) => {
                    const isEntry =
                      orderPrices.open &&
                      Math.abs(l.price - orderPrices.open) / orderPrices.open < 0.002
                    return (
                      <div
                        key={i}
                        className={`sui-hb__ob-row sui-hb__ob-row--ask ${isEntry ? 'sui-hb__ob-row--mark' : ''}`}
                      >
                        <span>
                          {formatOBPrice(l.price)} {isEntry ? '◄B' : ''}
                        </span>
                        <span>{formatQty(l.size)}</span>
                        <span>{formatQty(l.total)}</span>
                      </div>
                    )
                  })}
                  <div className="sui-hb__ob-mid">
                    {formatOBPrice(midPrice)}
                    {orderPrices.open && (
                      <span style={{ fontSize: 9, color: '#a78bfa', marginLeft: 4 }}>
                        ⬤ {formatOBPrice(orderPrices.open)}
                      </span>
                    )}
                  </div>
                  {obBids.map((l, i) => {
                    const isEntry =
                      orderPrices.open &&
                      Math.abs(l.price - orderPrices.open) / orderPrices.open < 0.002
                    return (
                      <div
                        key={i}
                        className={`sui-hb__ob-row sui-hb__ob-row--bid ${isEntry ? 'sui-hb__ob-row--mark' : ''}`}
                      >
                        <span>
                          {formatOBPrice(l.price)} {isEntry ? '◄A' : ''}
                        </span>
                        <span>{formatQty(l.size)}</span>
                        <span>{formatQty(l.total)}</span>
                      </div>
                    )
                  })}
                </>
              ) : (
                <div className="sui-hb__empty">Loading orderbook…</div>
              )}
            </div>
          </div>

          {/* Funding Check + Points Estimator */}
          <div className="sui-hb__card">
            <div className="sui-hb__card-title">Funding Check</div>
            {(() => {
              const [base, quote] = config.pool.split('_')
              return (
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8 }}>
                  <div>
                    Pool:{' '}
                    <b style={{ color: '#f8fafc' }}>
                      {base} / {quote}
                    </b>
                  </div>
                  <div>
                    Notional: <b style={{ color: '#f8fafc' }}>{formatUsd(config.notionalUsd)}</b>
                  </div>
                  <div style={{ marginTop: 4, borderTop: '1px solid #1e293b', paddingTop: 4 }}>
                    <div>
                      A (Long/Buy {base}): needs <b style={{ color: '#eab308' }}>{quote}</b> ~
                      {formatUsd(perWalletUsd)} + gas
                    </div>
                    <div>
                      B (Short/Sell {base}): needs <b style={{ color: '#eab308' }}>{base}</b> ~
                      {formatUsd(perWalletUsd)} + gas
                    </div>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Total: <b style={{ color: '#ef4444' }}>{formatUsd(totalNeeded)}</b> across both
                    tokens
                  </div>
                </div>
              )
            })()}
            {(addrA || addrB) && (
              <div style={{ marginTop: 8, fontSize: 11 }}>
                {addrA && (
                  <div style={{ padding: '5px 0', borderBottom: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>A: {shortAddr(addrA)}</span>
                      <span style={{ color: balAOk ? '#22c55e' : '#ef4444' }}>
                        {balA.loading ? '…' : balAOk ? '✓' : '✗'}
                      </span>
                    </div>
                    {!balA.loading && balA.coins.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                        {balA.coins.map((c, j) => (
                          <span
                            key={j}
                            style={{
                              fontSize: 9,
                              color: '#94a3b8',
                              background: '#020617',
                              borderRadius: 4,
                              padding: '1px 5px',
                            }}
                          >
                            {c.balance} <span style={{ color: '#64748b' }}>{c.symbol}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {addrB && (
                  <div style={{ padding: '5px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>B: {shortAddr(addrB)}</span>
                      <span style={{ color: balBOk ? '#22c55e' : '#ef4444' }}>
                        {balB.loading ? '…' : balBOk ? '✓' : '✗'}
                      </span>
                    </div>
                    {!balB.loading && balB.coins.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                        {balB.coins.map((c, j) => (
                          <span
                            key={j}
                            style={{
                              fontSize: 9,
                              color: '#94a3b8',
                              background: '#020617',
                              borderRadius: 4,
                              padding: '1px 5px',
                            }}
                          >
                            {c.balance} <span style={{ color: '#64748b' }}>{c.symbol}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Points Estimator */}
          <div className="sui-hb__card">
            <div className="sui-hb__card-title">Points Estimator</div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
              DeepBook points = maker volume. Maker fee = 0 (free).
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 2 }}>
              {(() => {
                const n = config.notionalUsd
                const holdAvg = (config.holdMinSec + config.holdMaxSec) / 2
                const cycleTime = holdAvg + 30 // hold + open/close overhead
                const cyclesPerHour = Math.floor(3600 / cycleTime)
                const cyclesPerDay = cyclesPerHour * 24
                const volPerCycle = n * 2 // both legs
                const volPerDay = volPerCycle * cyclesPerDay
                const volPerWeek = volPerDay * 7
                const volPerMonth = volPerDay * 30
                // Points estimation: ~1 point per $1 maker volume (historical approximation)
                const ptsPerDay = volPerDay
                const ptsPerWeek = volPerWeek
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Cycle time (avg)</span>
                      <b style={{ color: '#f8fafc' }}>{Math.round(cycleTime)}s</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Cycles / hour</span>
                      <b style={{ color: '#f8fafc' }}>{cyclesPerHour}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Cycles / day</span>
                      <b style={{ color: '#f8fafc' }}>{cyclesPerDay}</b>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        borderTop: '1px solid #1e293b',
                        paddingTop: 4,
                      }}
                    >
                      <span>Volume / day</span>
                      <b style={{ color: '#22c55e' }}>{formatUsd(volPerDay)}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Volume / week</span>
                      <b style={{ color: '#22c55e' }}>{formatUsd(volPerWeek)}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Volume / month</span>
                      <b style={{ color: '#22c55e' }}>{formatUsd(volPerMonth)}</b>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        borderTop: '1px solid #1e293b',
                        paddingTop: 4,
                      }}
                    >
                      <span>Est. points / day</span>
                      <b style={{ color: '#a78bfa' }}>~{Math.round(ptsPerDay).toLocaleString()}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Est. points / week</span>
                      <b style={{ color: '#a78bfa' }}>~{Math.round(ptsPerWeek).toLocaleString()}</b>
                    </div>
                  </>
                )
              })()}
            </div>
            <div style={{ fontSize: 9, color: '#475569', marginTop: 6 }}>
              * Maker fee = 0. Points ≈ 1pt/$1 maker vol (estimate). Bot tab must stay open.
            </div>
          </div>
        </div>

        {/* ── RIGHT: Bot Content ── */}
        <div className="sui-hb__main">
          {/* ── SETUP TAB ── */}
          {tab === 'setup' && (
            <>
              <div className="sui-hb__warn">
                Private keys are kept in memory only and never sent to any server. Keys are cleared
                when you close this tab. Keep your browser tab open while the bot runs.
              </div>

              <div className="sui-hb__card">
                <div className="sui-hb__card-title">Account Keys</div>

                {/* Generate 2 fresh wallets */}
                <div style={{ marginBottom: 10 }}>
                  <button
                    className="sui-hb__btn sui-hb__btn--sm"
                    onClick={handleGenerate2Wallets}
                    disabled={running}
                    style={{ width: '100%' }}
                  >
                    Generate 2 New Wallets (Ed25519)
                  </button>
                </div>

                {/* Generated wallets info */}
                {generatedWallets && (
                  <div
                    className="sui-hb__card"
                    style={{ background: '#020617', marginBottom: 10, padding: 10 }}
                  >
                    <div
                      style={{ fontSize: 10, color: '#22c55e', marginBottom: 6, fontWeight: 600 }}
                    >
                      2 wallets generated — fund these addresses:
                    </div>
                    {generatedWallets.map((w, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '4px 0',
                          borderBottom: i === 0 ? '1px solid #1e293b' : 'none',
                        }}
                      >
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          {i === 0 ? 'A (Long)' : 'B (Short)'}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: '#f8fafc',
                            fontFamily: "'Fira Code', monospace",
                            wordBreak: 'break-all',
                          }}
                        >
                          {w.addr}
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button
                        className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                        onClick={handleExportKeystore}
                        style={{ flex: 1 }}
                      >
                        Export .keystore
                      </button>
                      <button
                        className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                        onClick={handleEncryptExport}
                        style={{ flex: 1 }}
                      >
                        Export .vault (encrypted)
                      </button>
                    </div>
                    <div className="sui-hb__warn" style={{ marginTop: 6, marginBottom: 0 }}>
                      Save your keys NOW. They exist only in memory and will be lost when you close
                      this tab.
                    </div>
                  </div>
                )}

                {/* Import from keystore file */}
                <div style={{ marginBottom: 10 }}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".keystore,.json"
                    onChange={handleKeystoreFile}
                    style={{ display: 'none' }}
                  />
                  <button
                    className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={running}
                    style={{ width: '100%' }}
                  >
                    Import from sui.keystore file
                  </button>
                  <div style={{ fontSize: 9, color: '#475569', marginTop: 3 }}>
                    ~/.sui/sui_config/sui.keystore · File is read locally, never uploaded
                  </div>
                </div>

                {/* Encrypted vault — for iPad / cross-device */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <input
                    ref={encFileRef}
                    type="file"
                    accept=".vault"
                    onChange={handleDecryptImport}
                    style={{ display: 'none' }}
                  />
                  <button
                    className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                    onClick={() => encFileRef.current?.click()}
                    disabled={running}
                    style={{ flex: 1 }}
                  >
                    Open .vault file
                  </button>
                  <button
                    className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                    onClick={handleEncryptExport}
                    disabled={running || (!keyA && !keyB)}
                    style={{ flex: 1 }}
                  >
                    Export .vault
                  </button>
                </div>
                <div style={{ fontSize: 9, color: '#475569', marginBottom: 10 }}>
                  AES-256-GCM encrypted · Password-protected · Safe for iCloud / Google Drive
                </div>

                {/* Keystore picker */}
                {keystoreKeys.length > 0 && (
                  <div
                    className="sui-hb__card"
                    style={{ background: '#020617', marginBottom: 10, padding: 10 }}
                  >
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
                      {keystoreKeys.length} keys found — tap to assign:
                    </div>
                    {keystoreKeys.map((k, i) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #1e293b' }}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
                        >
                          <span
                            style={{
                              color: '#f8fafc',
                              fontFamily: "'Fira Code', monospace",
                              flex: 1,
                              fontSize: 10,
                            }}
                          >
                            {shortAddr(k.addr)}
                          </span>
                          <button
                            className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                            style={{ padding: '2px 8px', fontSize: 10 }}
                            onClick={() => setKeyA(k.key)}
                            disabled={running || keyA === k.key}
                          >
                            {keyA === k.key ? 'A ✓' : '→ A'}
                          </button>
                          <button
                            className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                            style={{ padding: '2px 8px', fontSize: 10 }}
                            onClick={() => setKeyB(k.key)}
                            disabled={running || keyB === k.key}
                          >
                            {keyB === k.key ? 'B ✓' : '→ B'}
                          </button>
                        </div>
                        {k.coins.length > 0 ? (
                          <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                            {k.coins.map((c, j) => (
                              <span
                                key={j}
                                style={{
                                  fontSize: 9,
                                  color: '#94a3b8',
                                  background: '#0f172a',
                                  borderRadius: 4,
                                  padding: '1px 6px',
                                }}
                              >
                                {c.balance} <span style={{ color: '#64748b' }}>{c.symbol}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>
                            loading balances…
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Manual input — Account A */}
                <div className="sui-hb__key-section">
                  <div className="sui-hb__key-label">
                    <span
                      className={`sui-hb__key-dot ${addrA ? 'sui-hb__key-dot--ok' : 'sui-hb__key-dot--empty'}`}
                    />
                    Account A (Long)
                  </div>
                  <input
                    className="sui-hb__input"
                    type="password"
                    placeholder="suiprivkey1... or base64 secret key"
                    value={keyA}
                    onChange={(e) => setKeyA(e.target.value)}
                    disabled={running}
                  />
                  {addrA && <div className="sui-hb__addr">{shortAddr(addrA)}</div>}
                </div>

                {/* Manual input — Account B */}
                <div className="sui-hb__key-section">
                  <div className="sui-hb__key-label">
                    <span
                      className={`sui-hb__key-dot ${addrB ? 'sui-hb__key-dot--ok' : 'sui-hb__key-dot--empty'}`}
                    />
                    Account B (Short)
                  </div>
                  <input
                    className="sui-hb__input"
                    type="password"
                    placeholder="suiprivkey1... or base64 secret key"
                    value={keyB}
                    onChange={(e) => setKeyB(e.target.value)}
                    disabled={running}
                  />
                  {addrB && <div className="sui-hb__addr">{shortAddr(addrB)}</div>}
                </div>
              </div>

              <div className="sui-hb__card">
                <div className="sui-hb__card-title">Bot Configuration</div>
                <div className="sui-hb__config-grid">
                  <div className="sui-hb__config-item">
                    <span className="sui-hb__config-label">Network</span>
                    <select
                      className="sui-hb__select"
                      value={network}
                      onChange={(e) => setNetwork(e.target.value)}
                      disabled={running}
                    >
                      <option value="mainnet">Mainnet</option>
                      <option value="testnet">Testnet</option>
                    </select>
                  </div>
                  <div className="sui-hb__config-item">
                    <span className="sui-hb__config-label">Pool</span>
                    <select
                      className="sui-hb__select"
                      value={config.pool}
                      onChange={(e) => setConfig((c) => ({ ...c, pool: e.target.value }))}
                      disabled={running}
                    >
                      {markets.length > 0 ? (
                        markets.map((m) => (
                          <option key={m.pool} value={m.pool}>
                            {m.pool.replace('_', ' / ')} — {m.change24h.toFixed(2)}%
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="SUI_USDC">SUI / USDC</option>
                          <option value="DEEP_SUI">DEEP / SUI</option>
                          <option value="DEEP_USDC">DEEP / USDC</option>
                          <option value="WAL_USDC">WAL / USDC</option>
                          <option value="WAL_SUI">WAL / SUI</option>
                          <option value="WUSDT_USDC">wUSDT / USDC</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="sui-hb__config-item">
                    <span className="sui-hb__config-label">Notional (USD)</span>
                    <input
                      className="sui-hb__input sui-hb__input--sm"
                      type="number"
                      value={config.notionalUsd}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, notionalUsd: Number(e.target.value) || 0 }))
                      }
                      disabled={running}
                    />
                  </div>
                  <div className="sui-hb__config-item">
                    <span className="sui-hb__config-label">Hold Min (sec)</span>
                    <input
                      className="sui-hb__input sui-hb__input--sm"
                      type="number"
                      value={config.holdMinSec}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, holdMinSec: Number(e.target.value) || 10 }))
                      }
                      disabled={running}
                    />
                  </div>
                  <div className="sui-hb__config-item">
                    <span className="sui-hb__config-label">Hold Max (sec)</span>
                    <input
                      className="sui-hb__input sui-hb__input--sm"
                      type="number"
                      value={config.holdMaxSec}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, holdMaxSec: Number(e.target.value) || 30 }))
                      }
                      disabled={running}
                    />
                  </div>
                  <div className="sui-hb__config-item">
                    <span className="sui-hb__config-label">Max Cycles (0 = ∞)</span>
                    <input
                      className="sui-hb__input sui-hb__input--sm"
                      type="number"
                      value={config.maxCycles ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setConfig((c) => ({ ...c, maxCycles: v > 0 ? v : null }))
                      }}
                      disabled={running}
                    />
                  </div>
                </div>
              </div>

              {/* Market Volatility Ranking */}
              <div className="sui-hb__card">
                <div className="sui-hb__card-title">
                  Pool Ranking — Lowest Volatility First
                  {marketsLoading && (
                    <span style={{ marginLeft: 8, color: '#64748b' }}>loading…</span>
                  )}
                </div>
                {markets.length > 0 ? (
                  <div className="sui-hb__history" style={{ maxHeight: 200 }}>
                    <div
                      className="sui-hb__history-row sui-hb__history-hdr"
                      style={{ gridTemplateColumns: '1fr 70px 70px 90px' }}
                    >
                      <span>Pool</span>
                      <span>24h %</span>
                      <span>Spread</span>
                      <span>Volume</span>
                    </div>
                    {markets.map((m) => (
                      <div
                        key={m.pool}
                        className="sui-hb__history-row"
                        style={{
                          gridTemplateColumns: '1fr 70px 70px 90px',
                          cursor: 'pointer',
                          background: m.pool === config.pool ? '#1e293b' : undefined,
                        }}
                        onClick={() => !running && setConfig((c) => ({ ...c, pool: m.pool }))}
                      >
                        <span
                          style={{
                            color: m.pool === config.pool ? '#22c55e' : '#f8fafc',
                            fontWeight: m.pool === config.pool ? 600 : 400,
                          }}
                        >
                          {m.pool.replace('_', ' / ')}
                        </span>
                        <span
                          style={{
                            color:
                              m.change24h < 2 ? '#22c55e' : m.change24h < 5 ? '#eab308' : '#ef4444',
                          }}
                        >
                          {m.change24h.toFixed(2)}%
                        </span>
                        <span style={{ color: '#94a3b8' }}>
                          {m.spread < 1 ? m.spread.toFixed(3) + '%' : 'N/A'}
                        </span>
                        <span style={{ color: '#64748b' }}>{formatUsd(m.volume)}</span>
                      </div>
                    ))}
                  </div>
                ) : !marketsLoading ? (
                  <div className="sui-hb__empty">No market data</div>
                ) : null}
              </div>

              <div className="sui-hb__btn-row">
                {!running ? (
                  <>
                    <button
                      className="sui-hb__btn"
                      onClick={start}
                      disabled={!keysReady || balancing}
                    >
                      {balancing
                        ? 'Balancing…'
                        : keysReady
                          ? 'Start Bot (auto-balance + run)'
                          : 'Import Keys First'}
                    </button>
                  </>
                ) : (
                  <button className="sui-hb__btn sui-hb__btn--red" onClick={stop}>
                    Stop Bot
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── DASHBOARD TAB ── */}
          {tab === 'dashboard' && (
            <>
              {/* Status */}
              <div className="sui-hb__status">
                <div className={`sui-hb__dot sui-hb__dot--${running ? stage : 'stopped'}`} />
                <span className="sui-hb__status-label">
                  {running ? stage.toUpperCase() : 'STOPPED'}
                </span>
                <span className="sui-hb__status-msg">
                  {running ? `Cycle #${cycleNum}` : 'Bot is not running'}
                </span>
              </div>

              {/* Controls */}
              <div className="sui-hb__controls">
                {!running ? (
                  <button
                    className="sui-hb__btn sui-hb__btn--sm"
                    onClick={start}
                    disabled={!keysReady}
                  >
                    Start
                  </button>
                ) : (
                  <button className="sui-hb__btn sui-hb__btn--red sui-hb__btn--sm" onClick={stop}>
                    Stop
                  </button>
                )}
              </div>

              {/* Stats */}
              <div className="sui-hb__stats">
                <div className="sui-hb__stat">
                  <span className="sui-hb__stat-label">Price</span>
                  <span className="sui-hb__stat-value">
                    {currentPrice ? formatUsd(currentPrice) : '—'}
                  </span>
                </div>
                <div className="sui-hb__stat">
                  <span className="sui-hb__stat-label">Total PnL</span>
                  <span
                    className={`sui-hb__stat-value ${totalPnl >= 0 ? 'sui-hb__stat-value--green' : 'sui-hb__stat-value--red'}`}
                  >
                    {formatUsd(totalPnl)}
                  </span>
                </div>
                <div className="sui-hb__stat">
                  <span className="sui-hb__stat-label">Volume</span>
                  <span className="sui-hb__stat-value">{formatUsd(totalVolume)}</span>
                </div>
                <div className="sui-hb__stat">
                  <span className="sui-hb__stat-label">Est. Points</span>
                  <span className="sui-hb__stat-value" style={{ color: '#a78bfa' }}>
                    ~{Math.round(totalVolume).toLocaleString()}
                  </span>
                </div>
                <div className="sui-hb__stat">
                  <span className="sui-hb__stat-label">Cycles</span>
                  <span className="sui-hb__stat-value">{cycleNum}</span>
                </div>
                <div className="sui-hb__stat">
                  <span className="sui-hb__stat-label">Pool</span>
                  <span className="sui-hb__stat-value" style={{ fontSize: 11 }}>
                    {config.pool}
                  </span>
                </div>
                <div className="sui-hb__stat">
                  <span className="sui-hb__stat-label">Network</span>
                  <span className="sui-hb__stat-value" style={{ fontSize: 11 }}>
                    {network}
                  </span>
                </div>
              </div>

              {/* Active cycle hold bar */}
              {stage === 'holding' && (
                <div className="sui-hb__card sui-hb__cycle">
                  <div className="sui-hb__card-title">Holding Position</div>
                  <div className="sui-hb__hold-bar">
                    <div className="sui-hb__hold-fill" style={{ width: `${holdPct}%` }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                    {Math.round(holdPct)}% —{' '}
                    {holdEnd ? Math.max(0, Math.round((holdEnd - Date.now()) / 1000)) : 0}s
                    remaining
                  </div>
                </div>
              )}

              {/* Account addresses */}
              {(addrA || addrB) && (
                <div className="sui-hb__card">
                  <div className="sui-hb__card-title">Accounts</div>
                  {addrA && <div className="sui-hb__addr">A (Long): {shortAddr(addrA)}</div>}
                  {addrB && <div className="sui-hb__addr">B (Short): {shortAddr(addrB)}</div>}
                </div>
              )}
            </>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <div className="sui-hb__card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div className="sui-hb__card-title" style={{ margin: 0 }}>
                  Cycle History ({history.length})
                </div>
                {history.length > 0 && (
                  <button
                    className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                    onClick={() => {
                      const csv =
                        'Cycle,OpenPrice,ClosePrice,PnL,Duration\n' +
                        history
                          .map(
                            (c) =>
                              `${c.num},${c.openPrice},${c.closePrice},${c.pnl.toFixed(6)},${c.duration}`,
                          )
                          .join('\n')
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const a = document.createElement('a')
                      a.href = URL.createObjectURL(blob)
                      a.download = `hedging-history-${Date.now()}.csv`
                      a.click()
                    }}
                  >
                    Export CSV
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <div className="sui-hb__empty">No completed cycles yet</div>
              ) : (
                <div className="sui-hb__history" style={{ maxHeight: 400 }}>
                  <div className="sui-hb__history-row sui-hb__history-hdr">
                    <span>#</span>
                    <span>Prices</span>
                    <span>PnL</span>
                    <span>Hold</span>
                  </div>
                  {history.map((c) => (
                    <div key={c.num} className="sui-hb__history-row">
                      <span style={{ color: '#94a3b8' }}>{c.num}</span>
                      <span style={{ fontSize: 10 }}>
                        {formatOBPrice(c.openPrice)} → {formatOBPrice(c.closePrice)}
                      </span>
                      <span style={{ color: c.pnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                        {c.pnl >= 0 ? '+' : ''}
                        {formatUsd(c.pnl)}
                      </span>
                      <span style={{ color: '#64748b' }}>{c.duration}s</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── LOGS TAB ── */}
          {tab === 'logs' && (
            <div className="sui-hb__card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div className="sui-hb__card-title" style={{ margin: 0 }}>
                  Runtime Logs ({logs.length})
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {logs.length > 0 && (
                    <button
                      className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                      onClick={() => {
                        const text = logs
                          .map((l) => {
                            const t = new Date(l.ts).toISOString()
                            return `[${t}] [${l.level.toUpperCase()}] ${l.msg}`
                          })
                          .join('\n')
                        const blob = new Blob([text], { type: 'text/plain' })
                        const a = document.createElement('a')
                        a.href = URL.createObjectURL(blob)
                        a.download = `hedging-logs-${Date.now()}.log`
                        a.click()
                      }}
                    >
                      Export
                    </button>
                  )}
                  <button
                    className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                    onClick={() => setLogs([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="sui-hb__logs" style={{ maxHeight: 500 }}>
                {logs.length === 0 ? (
                  <div className="sui-hb__empty">No logs yet</div>
                ) : (
                  [...logs].reverse().map((l, i) => (
                    <div key={i} className={`sui-hb__log-row sui-hb__log-row--${l.level}`}>
                      <span className="sui-hb__log-level">
                        {l.level === 'success'
                          ? '✓'
                          : l.level === 'error'
                            ? '✗'
                            : l.level === 'warn'
                              ? '!'
                              : '·'}
                      </span>
                      <span className="sui-hb__log-time">
                        {new Date(l.ts).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                      <span className={`sui-hb__log-msg sui-hb__log-msg--${l.level}`}>{l.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── ACCOUNTS TAB ── */}
          {tab === 'accounts' && (
            <>
              {!addrA && !addrB ? (
                <div className="sui-hb__empty">Import keys in Setup tab first</div>
              ) : (
                [
                  { label: 'A (Long)', addr: addrA, bal: balA },
                  { label: 'B (Short)', addr: addrB, bal: balB },
                ].map(
                  (acct) =>
                    acct.addr && (
                      <div key={acct.label} className="sui-hb__card" style={{ marginBottom: 12 }}>
                        <div className="sui-hb__card-title">{acct.label}</div>
                        <div
                          style={{
                            fontSize: 11,
                            fontFamily: "'Fira Code', monospace",
                            color: '#f8fafc',
                            wordBreak: 'break-all',
                            marginBottom: 8,
                          }}
                        >
                          {acct.addr}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                          <a
                            href={`https://suiscan.xyz/${network}/account/${acct.addr}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                            style={{ textDecoration: 'none', textAlign: 'center', flex: 1 }}
                          >
                            View on Suiscan
                          </a>
                          <button
                            className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                            style={{ flex: 1 }}
                            onClick={() => navigator.clipboard.writeText(acct.addr!)}
                          >
                            Copy Address
                          </button>
                        </div>
                        {acct.bal.loading ? (
                          <div style={{ fontSize: 11, color: '#64748b' }}>Loading balances…</div>
                        ) : acct.bal.coins.length > 0 ? (
                          <div>
                            {acct.bal.coins.map((c, j) => (
                              <div
                                key={j}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  padding: '4px 0',
                                  borderBottom: '1px solid #1e293b',
                                  fontSize: 12,
                                }}
                              >
                                <span style={{ color: '#94a3b8' }}>{c.symbol}</span>
                                <span
                                  style={{ color: '#f8fafc', fontFamily: "'Fira Code', monospace" }}
                                >
                                  {c.balance}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: '#475569' }}>No tokens found</div>
                        )}
                      </div>
                    ),
                )
              )}
              {(addrA || addrB) && (
                <button
                  className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                  onClick={() => {
                    if (addrA) {
                      setBalA((b) => ({ ...b, loading: true }))
                      fetchBalance(addrA).then(setBalA)
                    }
                    if (addrB) {
                      setBalB((b) => ({ ...b, loading: true }))
                      fetchBalance(addrB).then(setBalB)
                    }
                  }}
                >
                  Refresh Balances
                </button>
              )}
            </>
          )}
        </div>
        {/* end .sui-hb__main */}
      </div>
      {/* end .sui-hb__layout */}

      {/* Password dialog */}
      {pwDialog && (
        <div className="sui-hb__overlay">
          <div className="sui-hb__card" style={{ maxWidth: 320, margin: '0 auto' }}>
            <div className="sui-hb__card-title">
              {pwDialog.mode === 'encrypt' ? 'Set Vault Password' : 'Enter Vault Password'}
            </div>
            <div className="sui-hb__key-section">
              <input
                className="sui-hb__input"
                type="password"
                placeholder="Password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pwDialog.mode === 'decrypt') {
                    if (pwInput.length >= 1) {
                      setPwDialog(null)
                      pwDialog.resolve(pwInput)
                    }
                  }
                }}
              />
            </div>
            {pwDialog.mode === 'encrypt' && (
              <div className="sui-hb__key-section">
                <input
                  className="sui-hb__input"
                  type="password"
                  placeholder="Confirm password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pwInput.length >= 6 && pwInput === pwConfirm) {
                      setPwDialog(null)
                      pwDialog.resolve(pwInput)
                    }
                  }}
                />
              </div>
            )}
            {pwError && (
              <div style={{ color: '#ef4444', fontSize: 11, marginBottom: 8 }}>{pwError}</div>
            )}
            <div className="sui-hb__btn-row">
              <button
                className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                onClick={() => {
                  setPwDialog(null)
                  pwDialog.resolve(null)
                }}
              >
                Cancel
              </button>
              <button
                className="sui-hb__btn sui-hb__btn--sm"
                onClick={() => {
                  if (pwDialog.mode === 'encrypt') {
                    if (pwInput.length < 6) {
                      setPwError('Min 6 characters')
                      return
                    }
                    if (pwInput !== pwConfirm) {
                      setPwError('Passwords do not match')
                      return
                    }
                  }
                  if (!pwInput) {
                    setPwError('Enter password')
                    return
                  }
                  setPwDialog(null)
                  pwDialog.resolve(pwInput)
                }}
              >
                {pwDialog.mode === 'encrypt' ? 'Encrypt & Save' : 'Decrypt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Plugin export ──────────────────────────────────────────────────────────────

const SuiDeepBookHedgingBotPlugin: Plugin = {
  name: 'SuiDeepBookHedgingBot',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-deepbook-hedging-bot/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiDeepBookHedgingBot', HedgingBotContent)
    host.log('SuiDeepBookHedgingBot initialized' + (sharedHost ? ' (shared)' : ' (standalone)'))
  },
  mount() {
    console.log('[SuiDeepBookHedgingBot] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiDeepBookHedgingBot] unmounted')
  },
}

export default SuiDeepBookHedgingBotPlugin

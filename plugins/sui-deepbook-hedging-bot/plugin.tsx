// SUI DeepBook Hedging Bot Plugin — Client-Side Browser Bot
// Runs hedging cycles entirely in the browser using imported keypairs.
// No server needed — signs transactions directly via Ed25519Keypair.
//
// Architecture: Import 2 keys (Account A = Long, Account B = Short)
// → bot loop via setInterval → open/hold/close cycles → live dashboard

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
  OrderType,
} from '@mysten/deepbook-v3'
import {
  executeMarginCycle as _executeMarginCycle,
  cleanupMarginPositions as _cleanupMarginPositions,
} from './strategies'
import { pushLog, testLogEndpoint, detectLogServiceType } from './services'
import { Sidebar } from './components'
import type {
  BotStage,
  BotConfig,
  LogEntry,
  CycleRecord,
  OBLevel,
  PoolMarketData,
  WalletBalance,
} from './types'
import { INDEXER, RPC, DEFAULT_CONFIG } from './types'
import { formatUsd, formatOBPrice, shortAddr, randRange, keypairFromSecret } from './utils'
import './style.css'

// ── Helpers (re-exported from ./utils) ──────────────────────────────────────

// ── Shared host ────────────────────────────────────────────────────────────────

let sharedHost: SuiHostAPI | null = null

type BalanceManagerCardProps = {
  label: string
  role: string
  bmId: string
  hasKey: boolean
  color: string
  network: string
  running: boolean
  mgrBals: Record<string, Record<string, number>>
  mgrBalsLoading: boolean
  onWithdraw: () => void
  onReset: () => void
}

/** One on-chain balance manager row in the Accounts tab. */
function BalanceManagerCard({
  label,
  role,
  bmId,
  hasKey,
  color,
  network,
  running,
  mgrBals,
  mgrBalsLoading,
  onWithdraw,
  onReset,
}: BalanceManagerCardProps) {
  const entries = Object.entries(mgrBals[bmId] ?? {}).filter(([, v]) => (v as number) > 0)
  return (
    <div
      className="sui-hb__card"
      style={{
        background: '#020617',
        marginBottom: 8,
        padding: 10,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#f8fafc' }}>Manager {label}</div>
          <div style={{ fontSize: 9, color: '#64748b' }}>{role}</div>
          {!hasKey && <div style={{ fontSize: 9, color: '#ef4444' }}>⚠ Import key to withdraw</div>}
        </div>
        <a
          href={`https://suiscan.xyz/${network}/object/${bmId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 9, color: '#4da2ff', textDecoration: 'none' }}
        >
          {bmId.slice(0, 10)}...{bmId.slice(-4)}
        </a>
      </div>
      {entries.length > 0 ? (
        <div style={{ marginBottom: 8 }}>
          {entries.map(([coinType, amount]) => {
            const sym = coinType.split('::').pop() ?? coinType
            return (
              <div
                key={coinType}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '3px 0',
                  borderBottom: '1px solid #0f172a',
                  fontSize: 11,
                }}
              >
                <span style={{ color: '#94a3b8' }}>{sym}</span>
                <span style={{ color: '#f8fafc', fontFamily: "'Fira Code', monospace" }}>
                  {(amount as number).toFixed(4)}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 8 }}>
          {mgrBalsLoading ? 'Loading...' : 'Empty — no funds deposited'}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          className="sui-hb__btn sui-hb__btn--red sui-hb__btn--sm"
          style={{ flex: 1, fontSize: 10 }}
          disabled={running || !hasKey}
          onClick={onWithdraw}
        >
          Withdraw All
        </button>
        <button
          className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
          style={{ flex: 1, fontSize: 10 }}
          onClick={onReset}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

function HedgingBotContent() {
  const [network, setNetwork] = useState<string>('mainnet')
  const [tab, setTab] = useState<'setup' | 'dashboard' | 'accounts'>('setup')

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

  // Sync pool selection with other plugins via sharedData
  const setPoolShared = useCallback((pool: string) => {
    setConfig((c) => ({ ...c, pool }))
    if (sharedHost) sharedHost.setSharedData('deepbook:selectedPool', pool)
  }, [])

  useEffect(() => {
    if (!sharedHost) return
    const initial = sharedHost.getSharedData('deepbook:selectedPool') as string | undefined
    if (initial) setConfig((c) => ({ ...c, pool: initial }))
    return sharedHost.onSharedDataChange('deepbook:selectedPool', (v) => {
      if (typeof v === 'string') setConfig((c) => (c.pool === v ? c : { ...c, pool: v }))
    })
  }, [])

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
  const [orderPrices, setOrderPrices] = useState<{ bid: number | null; ask: number | null }>({
    bid: null,
    ask: null,
  })

  // Balance Manager IDs (on-chain, persisted in localStorage)
  const [bmIdA, setBmIdA] = useState<string | null>(() => {
    try {
      return localStorage.getItem('hb_bmA')
    } catch {
      return null
    }
  })
  const [bmIdB, setBmIdB] = useState<string | null>(() => {
    try {
      return localStorage.getItem('hb_bmB')
    } catch {
      return null
    }
  })
  const [mgrBals, setMgrBals] = useState<Record<string, Record<string, number>>>({})
  const [mgrBalsLoading, setMgrBalsLoading] = useState(false)
  // All MarginManagers per wallet address
  const [allMMs, setAllMMs] = useState<
    Record<
      string,
      {
        id: string
        pool: string
        base: number
        quote: number
        baseDebt: number
        quoteDebt: number
      }[]
    >
  >({})

  // Margin Manager IDs (for margin strategy)
  const [mmIdA, _setMmIdA] = useState<string | null>(() => {
    try {
      return localStorage.getItem('hb_mmA')
    } catch {
      return null
    }
  })
  const [mmIdB, _setMmIdB] = useState<string | null>(() => {
    try {
      return localStorage.getItem('hb_mmB')
    } catch {
      return null
    }
  })
  const mmIdARef = useRef(mmIdA)
  const mmIdBRef = useRef(mmIdB)
  const setMmIdA = (id: string) => {
    mmIdARef.current = id
    _setMmIdA(id)
  }
  const setMmIdB = (id: string) => {
    mmIdBRef.current = id
    _setMmIdB(id)
  }
  useEffect(() => {
    mmIdARef.current = mmIdA
  }, [mmIdA])
  useEffect(() => {
    mmIdBRef.current = mmIdB
  }, [mmIdB])

  // On-chain tx history per account
  const [txHistory, setTxHistory] = useState<
    Record<string, { digest: string; ts: string; status: string }[]>
  >({})
  const [pendingOrders, setPendingOrders] = useState<
    Record<string, { orderId: string; side: string; price: number; qty: number; filled: number }[]>
  >({})

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

  // Webhook for remote log tracking
  const [webhookUrl, setWebhookUrl] = useState(() => {
    try {
      return localStorage.getItem('hb_webhook') ?? ''
    } catch {
      return ''
    }
  })
  const [webhookApiKey, setWebhookApiKey] = useState(() => {
    try {
      return localStorage.getItem('hb_webhook_key') ?? ''
    } catch {
      return ''
    }
  })
  const webhookRef = useRef(webhookUrl)
  const webhookKeyRef = useRef(webhookApiKey)
  useEffect(() => {
    webhookRef.current = webhookUrl
  }, [webhookUrl])
  useEffect(() => {
    webhookKeyRef.current = webhookApiKey
  }, [webhookApiKey])

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

  const addLog = useCallback(
    (level: LogEntry['level'], msg: string) => {
      setLogs((prev) => [...prev.slice(-200), { ts: Date.now(), level, msg }])
      const url = webhookRef.current
      if (url)
        pushLog(
          {
            url,
            type: detectLogServiceType(url),
            apiKey: webhookKeyRef.current || undefined,
            labels: { job: 'hedging-bot', pool: config.pool },
          },
          level,
          msg,
        )
    },
    [config.pool],
  )

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

  // Fetch Balance Manager balances
  const fetchMgrBals = useCallback(async () => {
    if (!bmIdA && !bmIdB) return
    setMgrBalsLoading(true)
    const net = network as 'mainnet' | 'testnet'
    const [base, quote] = config.pool.split('_')
    const coinKeys = [...new Set([base, quote, 'DEEP'])]
    const ids = [bmIdA, bmIdB].filter(Boolean) as string[]
    try {
      const client = new SuiGrpcClient({ network: net, baseUrl: RPC[net] })
      const dbClient = new DeepBookClient({
        client,
        address: '0x0',
        network: net,
        coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
        pools: net === 'mainnet' ? mainnetPools : testnetPools,
        packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
      })
      const result = await dbClient.checkManagerBalancesWithAddress(ids, coinKeys)
      setMgrBals(result)
    } catch {
      /* silent */
    }
    setMgrBalsLoading(false)
  }, [bmIdA, bmIdB, network, config.pool])

  /** Fetch ALL MarginManagers for a wallet — use known IDs from localStorage + verify on-chain */
  const fetchAllMMs = useCallback(
    async (addr: string) => {
      const net = network as 'mainnet' | 'testnet'
      const mms: {
        id: string
        pool: string
        base: number
        quote: number
        baseDebt: number
        quoteDebt: number
      }[] = []
      // Collect all known MM IDs for this address
      const knownIds = new Set<string>()
      const isAddrA = addr === keypairARef.current?.getPublicKey().toSuiAddress()
      if (isAddrA && mmIdA) knownIds.add(mmIdA)
      if (!isAddrA && mmIdB) knownIds.add(mmIdB)
      // Also check all localStorage keys for historical MMs
      try {
        for (const key of ['hb_mmA', 'hb_mmB']) {
          const v = localStorage.getItem(key)
          if (v) knownIds.add(v)
        }
      } catch {}

      for (const id of knownIds) {
        try {
          const res = await fetch(RPC[net], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'sui_getObject',
              params: [id, { showType: true, showContent: true }],
            }),
          })
          const d = (await res.json()) as {
            result?: { data?: { type?: string; content?: { fields?: Record<string, any> } } }
          }
          if (!d.result?.data?.type?.includes('MarginManager')) continue
          const fields = d.result.data.content?.fields ?? {}
          const owner = (fields.owner ?? '') as string
          if (!owner.replace(/^0x0*/, '0x').startsWith(addr.replace(/^0x0*/, '0x').slice(0, 20)))
            continue
          const mm: (typeof mms)[0] = {
            id,
            pool: ((fields.deepbook_pool ?? '') as string).slice(0, 10) + '…',
            base: 0,
            quote: 0,
            baseDebt: 0,
            quoteDebt: 0,
          }
          try {
            const client = new SuiGrpcClient({ network: net, baseUrl: RPC[net] })
            const stateDb = new DeepBookClient({
              client,
              address: '0x0',
              network: net,
              marginManagers: { q: { address: id, poolKey: config.pool } },
            })
            const state = await stateDb.getMarginManagerState('q')
            mm.base = parseFloat(state.baseAsset) || 0
            mm.quote = parseFloat(state.quoteAsset) || 0
            mm.baseDebt = parseFloat(state.baseDebt) || 0
            mm.quoteDebt = parseFloat(state.quoteDebt) || 0
          } catch {
            /* state query may fail for MMs on different pools */
          }
          mms.push(mm)
        } catch {
          /* skip invalid */
        }
      }
      setAllMMs((prev) => ({ ...prev, [addr]: mms }))
    },
    [network, config.pool],
  )

  /** Refresh all MM data for both wallets */
  const fetchMmBals = useCallback(async () => {
    if (addrA) fetchAllMMs(addrA)
    if (addrB) fetchAllMMs(addrB)
  }, [addrA, addrB, fetchAllMMs])

  // Fetch on-chain tx history for an address
  const fetchTxHistory = useCallback(
    async (addr: string) => {
      try {
        const res = await fetch(RPC[network], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'suix_queryTransactionBlocks',
            params: [
              { filter: { FromAddress: addr }, options: { showEffects: true } },
              null,
              10,
              true,
            ],
          }),
        })
        const d = (await res.json()) as {
          result?: {
            data: {
              digest: string
              timestampMs?: string
              effects?: { status?: { status: string } }
            }[]
          }
        }
        const txs = (d.result?.data ?? []).map((t) => ({
          digest: t.digest,
          ts: t.timestampMs
            ? new Date(Number(t.timestampMs)).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '?',
          status: t.effects?.status?.status ?? '?',
        }))
        setTxHistory((prev) => ({ ...prev, [addr]: txs }))
      } catch {
        /* silent */
      }
    },
    [network],
  )

  // Fetch pending orders from DeepBook indexer (needs Balance Manager ID)
  const fetchPendingOrders = useCallback(
    async (bmId: string | null, addr: string) => {
      if (!bmId) {
        setPendingOrders((prev) => ({ ...prev, [addr]: [] }))
        return
      }
      try {
        // Try current pool first, then common pools
        const poolsToCheck = [config.pool, 'SUI_USDC', 'DEEP_SUI', 'WAL_SUI']
        const allOrders: {
          orderId: string
          side: string
          price: number
          qty: number
          filled: number
          pool: string
        }[] = []
        for (const p of [...new Set(poolsToCheck)]) {
          try {
            const res = await fetch(`${INDEXER[network]}/orders/${p}/${bmId}`)
            if (!res.ok) continue
            const data: {
              order_id: string
              type: string
              price: number
              original_quantity: number
              filled_quantity: number
              current_status: string
            }[] = await res.json()
            const open = data.filter(
              (o) => o.current_status === 'open' || o.current_status === 'partially_filled',
            )
            allOrders.push(
              ...open.map((o) => ({
                orderId: o.order_id,
                side: o.type,
                price: o.price,
                qty: o.original_quantity,
                filled: o.filled_quantity,
                pool: p,
              })),
            )
          } catch {
            /* skip pool */
          }
        }
        setPendingOrders((prev) => ({ ...prev, [addr]: allOrders }))
      } catch {
        setPendingOrders((prev) => ({ ...prev, [addr]: [] }))
      }
    },
    [network, config.pool],
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

    let openPrice = 0
    let quotePerLeg = 0
    let quoteLong = 0
    let quoteShort = 0
    try {
      const tickerRes = await fetch(`${indexer}/ticker`)
      const ticker: Record<string, { last_price: number }> = await tickerRes.json()
      openPrice = ticker[poolKey]?.last_price ?? 0
      setCurrentPrice(openPrice)
      if (!openPrice) throw new Error('Cannot fetch price')

      // Determine amounts based on actual wallet balances
      const [base, quote] = poolKey.split('_')
      const aCoins = await fetchAllCoins(aAddr)
      const bCoins = await fetchAllCoins(bAddr)
      const suiUsd = ticker['SUI_USDC']?.last_price ?? 1

      // A spends quote to buy base
      const aQuoteBal = parseFloat(aCoins.find((c) => c.symbol === quote)?.balance ?? '0')
      const aGas = quote === 'SUI' ? 0.5 : 0
      const maxQuoteA = (aQuoteBal - aGas) * 0.8
      // B spends base to sell
      const bBaseBal = parseFloat(bCoins.find((c) => c.symbol === base)?.balance ?? '0')
      const bGas = base === 'SUI' ? 0.5 : 0
      const maxBaseB = (bBaseBal - bGas) * 0.8
      // Convert to USD for comparison
      const maxUsdA = quote === 'SUI' ? maxQuoteA * suiUsd : maxQuoteA
      const maxUsdB =
        base === 'SUI' ? maxBaseB * suiUsd : maxBaseB * openPrice * (quote === 'SUI' ? suiUsd : 1)
      // Use min of both wallets and notional
      const effectiveUsd = Math.min(config.notionalUsd, maxUsdA, maxUsdB) * 0.9
      if (effectiveUsd <= 0.5)
        throw new Error(
          `Not enough funds. A: $${maxUsdA.toFixed(2)} ${quote}, B: $${maxUsdB.toFixed(2)} ${base}`,
        )
      quotePerLeg = quote === 'SUI' ? effectiveUsd / suiUsd : effectiveUsd
      const qty = quotePerLeg / openPrice
      addLog(
        'info',
        `Mid price: ${formatOBPrice(openPrice)} — Effective: ${formatUsd(effectiveUsd)} — Qty: ${qty.toFixed(2)}`,
      )

      if (!(poolKey in sdkPools)) throw new Error(`Pool ${poolKey} not in SDK`)

      // ── Trend Detection: prefer sharedData from Analysis plugin, fallback to direct call ──
      let longPct = 50
      let shortPct = 50
      try {
        const shared = sharedHost?.getSharedData('deepbook:analysis') as
          | {
              pool: string
              signal: string
              confidence: number
              recommendation: { longPct: number; shortPct: number }
              ts: number
            }
          | undefined
        // Use shared data if fresh (<30s) and same pool
        if (shared && shared.pool === poolKey && Date.now() - shared.ts < 30000) {
          longPct = shared.recommendation.longPct
          shortPct = shared.recommendation.shortPct
          addLog(
            'info',
            `Trend (shared): ${shared.signal.replace('_', ' ').toUpperCase()} (${shared.confidence}%) → Long ${longPct}% / Short ${shortPct}%`,
          )
        } else {
          // Fallback: run analysis directly
          const { runAnalysis } = await import('../sui-deepbook-analysis/analysis')
          const trend = await runAnalysis(poolKey, net)
          longPct = trend.recommendation.longPct
          shortPct = trend.recommendation.shortPct
          addLog(
            'info',
            `Trend (direct): ${trend.signal.replace('_', ' ').toUpperCase()} (${trend.confidence}%) → Long ${longPct}% / Short ${shortPct}%`,
          )
        }
      } catch {
        addLog('warn', 'Trend analysis unavailable — using 50/50')
      }

      const quoteLongCalc = quotePerLeg * (longPct / 50)
      const quoteShortCalc = quotePerLeg * (shortPct / 50)
      quoteLong = Math.min(quoteLongCalc, maxQuoteA)
      quoteShort = Math.min(quoteShortCalc, maxQuoteA) // cap to available
      const qtyLong = quoteLong / openPrice
      // B sells base — cap to actual base balance
      let qtyShort = quoteShort / openPrice
      qtyShort = Math.min(qtyShort, maxBaseB)

      addLog(
        'info',
        `A: BUY ${qtyLong.toFixed(2)} (${longPct}%) | B: SELL ${qtyShort.toFixed(2)} (${shortPct}%)`,
      )

      // Account A: BUY base (long)
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
      buildSwapBuy(makeDb(aAddr), poolKey, quoteLong, aAddr, txA)
      addLog('info', 'Signing A (BUY)...')
      await signAndExec(kpA, txA, net)
      addLog('success', `A: BUY ${qtyLong.toFixed(2)} filled`)

      // Account B: SELL base (short)
      const txB = new Transaction()
      buildSwapSell(makeDb(bAddr), poolKey, qtyShort, bAddr, txB)
      addLog('info', 'Signing B (SELL)...')
      await signAndExec(kpB, txB, net)
      addLog('success', `B: SELL ${qtyShort.toFixed(2)} filled`)

      // Set orderbook markers at actual execution prices
      try {
        const obRes = await fetch(`${indexer}/orderbook/${poolKey}?level=2&depth=4`)
        const ob: { bids: [string, string][]; asks: [string, string][] } = await obRes.json()
        setOrderPrices({
          bid: ob.bids[0] ? parseFloat(ob.bids[0][0]) : openPrice,
          ask: ob.asks[0] ? parseFloat(ob.asks[0][0]) : openPrice,
        })
      } catch {
        setOrderPrices({ bid: openPrice, ask: openPrice })
      }
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

      // Close A: SELL base back — use actual balance
      const [base, quote] = poolKey.split('_')
      const aCoinsClose = await fetchAllCoins(aAddr)
      const aBaseBal = parseFloat(aCoinsClose.find((c) => c.symbol === base)?.balance ?? '0')
      const aGasClose = base === 'SUI' ? 0.5 : 0
      const sellQty = (aBaseBal - aGasClose) * 0.9
      if (sellQty <= 0) throw new Error(`A has no ${base} to sell. Balance: ${aBaseBal.toFixed(4)}`)

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
      addLog('info', `Closing A (SELL ${sellQty.toFixed(4)} ${base})...`)
      await signAndExec(kpA, txA, net)
      addLog('success', `A: SELL filled at ${formatOBPrice(closePrice)}`)

      // Close B: BUY base back — check actual quote balance
      const bCoinsClose = await fetchAllCoins(bAddr)
      const bQuoteBal = parseFloat(bCoinsClose.find((c) => c.symbol === quote)?.balance ?? '0')
      const bGasClose = quote === 'SUI' ? 0.5 : 0
      const closeQuote = (bQuoteBal - bGasClose) * 0.9
      if (closeQuote <= 0)
        throw new Error(`Not enough ${quote} in B. Have: ${bQuoteBal.toFixed(4)}`)
      const txB = new Transaction()
      buildSwapBuy(makeDb2(bAddr), poolKey, closeQuote, bAddr, txB)
      addLog('info', `Closing B (BUY ${closeQuote.toFixed(4)} ${quote})...`)
      await signAndExec(kpB, txB, net)
      addLog('success', `B: BUY filled at ${formatOBPrice(closePrice)}`)

      // PnL: directional hedging — net exposure = (longPct - shortPct)% of notional
      const priceDiff = closePrice - openPrice
      const pctChange = openPrice > 0 ? priceDiff / openPrice : 0
      // A (long) gains when price up, B (short) gains when price down
      const pnlLong = pctChange * quoteLong // A profit
      const pnlShort = -pctChange * quoteShort // B profit (inverse)
      const pnl = pnlLong + pnlShort
      const suiUsdClose = ticker['SUI_USDC']?.last_price ?? 1
      const pnlUsd = poolKey.split('_')[1] === 'SUI' ? pnl * suiUsdClose : pnl
      setTotalPnl((p) => p + pnlUsd)
      setTotalVolume(
        (v) => v + (quoteLong + quoteShort) * (poolKey.split('_')[1] === 'SUI' ? suiUsdClose : 1),
      )
      setHistory((h) => [
        { num, openPrice, closePrice, pnl: pnlUsd, duration: holdSec },
        ...h.slice(0, 49),
      ])
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
    setOrderPrices({ bid: null, ask: null })

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
    const res = await client.executeTransaction({
      transaction: built,
      signatures: [sig.signature],
      include: { effects: true },
    })
    const inner =
      (res as Record<string, unknown>).Transaction ??
      (res as Record<string, unknown>).FailedTransaction ??
      res
    const data = inner as Record<string, unknown>
    if ((res as Record<string, unknown>).$kind === 'FailedTransaction') {
      throw new Error(
        `Transaction failed: ${JSON.stringify((data.status as Record<string, unknown>)?.error ?? 'unknown')}`,
      )
    }
    // Wait for object versions to propagate
    await new Promise((r) => setTimeout(r, 1500))
    return data
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

  /** Create or find existing Balance Manager for an account */
  const ensureBalanceManager = useCallback(
    async (kp: Ed25519Keypair, net: string, existingId: string | null): Promise<string> => {
      if (existingId) return existingId
      const addr = kp.getPublicKey().toSuiAddress()
      const n = net as 'mainnet' | 'testnet'
      const pkgId =
        n === 'mainnet'
          ? mainnetPackageIds.DEEPBOOK_PACKAGE_ID
          : testnetPackageIds.DEEPBOOK_PACKAGE_ID
      const bmType = `${pkgId}::balance_manager::BalanceManager`

      // Search for existing BalanceManager via JSON-RPC getOwnedObjects
      const findBM = async (): Promise<string | null> => {
        const res = await fetch(RPC[n], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'suix_getOwnedObjects',
            params: [
              addr,
              { filter: { StructType: bmType }, options: { showType: true } },
              null,
              1,
            ],
          }),
        })
        const d: { result: { data: { data: { objectId: string } }[] } } = await res.json()
        return d.result?.data?.[0]?.data?.objectId ?? null
      }

      const existing = await findBM()
      if (existing) {
        addLog('info', `Found Balance Manager: ${existing.slice(0, 12)}...`)
        return existing
      }

      // Create new
      addLog('info', `Creating Balance Manager for ${addr.slice(0, 8)}...`)
      const client = new SuiGrpcClient({ network: n, baseUrl: RPC[n] })
      const dbClient = new DeepBookClient({
        client,
        address: addr,
        network: n,
        coins: n === 'mainnet' ? mainnetCoins : testnetCoins,
        pools: n === 'mainnet' ? mainnetPools : testnetPools,
        packageIds: n === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
      })
      const tx = new Transaction()
      tx.add(dbClient.balanceManager.createAndShareBalanceManager())
      const result = (await signAndExec(kp, tx, net)) as Record<string, unknown>
      const digest = result?.digest as string
      addLog('info', `Tx digest: ${digest?.slice(0, 16)}...`)

      // Query tx via JSON-RPC to get objectChanges
      if (digest) {
        for (let attempt = 0; attempt < 3; attempt++) {
          await new Promise((r) => setTimeout(r, 2000 + attempt * 1000))
          const txRes = await fetch(RPC[n], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'sui_getTransactionBlock',
              params: [digest, { showObjectChanges: true }],
            }),
          })
          const txData = (await txRes.json()) as {
            result?: { objectChanges?: { type: string; objectId: string; objectType?: string }[] }
          }
          const changes = txData.result?.objectChanges ?? []
          addLog(
            'info',
            `Object changes: ${changes.length} — types: ${changes.map((c) => c.type).join(',')}`,
          )
          const bmChange = changes.find(
            (o) => o.type === 'created' && o.objectType?.includes('BalanceManager'),
          )
          if (bmChange) {
            addLog('success', `Balance Manager: ${bmChange.objectId.slice(0, 12)}...`)
            return bmChange.objectId
          }
          const anyCreated = changes.find(
            (o) => o.type === 'created' && !o.objectType?.includes('::coin::'),
          )
          if (anyCreated) {
            addLog('success', `Balance Manager: ${anyCreated.objectId.slice(0, 12)}...`)
            return anyCreated.objectId
          }
        }
      }

      // Fallback: retry getBalanceManagerIds (BM may have been created in a previous tx)
      addLog('info', 'Fallback: querying registry...')
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        try {
          const ids = await dbClient.getBalanceManagerIds(addr)
          if (ids.length > 0) {
            addLog('success', `Balance Manager found: ${ids[0].slice(0, 12)}...`)
            return ids[0]
          }
        } catch {
          /* retry */
        }
      }

      throw new Error('Could not find Balance Manager ID — tx: ' + (digest ?? 'unknown'))
    },
    [addLog, signAndExec],
  )

  /** Ensure Margin Manager exists for an account, create if needed */
  const ensureMarginManager = useCallback(
    async (
      kp: Ed25519Keypair,
      net: string,
      poolKey: string,
      existingId: string | null,
    ): Promise<string> => {
      const n = net as 'mainnet' | 'testnet'
      const addr = kp.getPublicKey().toSuiAddress()
      const client = new SuiGrpcClient({ network: n, baseUrl: RPC[n] })
      const sdkCoins = n === 'mainnet' ? mainnetCoins : testnetCoins
      const sdkPools = n === 'mainnet' ? mainnetPools : testnetPools
      const sdkPkgIds = n === 'mainnet' ? mainnetPackageIds : testnetPackageIds

      // Verify existing MM if provided
      if (existingId) {
        try {
          const res = await fetch(RPC[n], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'sui_getObject',
              params: [existingId, { showContent: true, showType: true }],
            }),
          })
          const d = (await res.json()) as {
            result?: { data?: { type?: string; content?: { fields?: { owner?: string } } } }
          }
          const objType = d.result?.data?.type ?? ''
          const owner = d.result?.data?.content?.fields?.owner
          if (
            d.result?.data &&
            objType.includes('MarginManager') &&
            owner &&
            owner.replace(/^0x0*/, '0x') === addr.replace(/^0x0*/, '0x')
          ) {
            addLog('info', `Margin Manager verified: ${existingId.slice(0, 12)}…`)
            return existingId
          }
          addLog('warn', `Stale MM ${existingId.slice(0, 12)}… — searching for valid one`)
        } catch {
          /* fall through to search */
        }
      }

      // Search registry for existing MMs
      const dbSearch = new DeepBookClient({
        client,
        address: addr,
        network: n,
        coins: sdkCoins,
        pools: sdkPools,
        packageIds: sdkPkgIds,
      })
      try {
        const ids = await dbSearch.getBalanceManagerIds(addr)
        // Check each to find one that's a MarginManager for our pool
        if (ids.length > 0) {
          for (const id of ids) {
            try {
              const res = await fetch(RPC[n], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'sui_getObject',
                  params: [id, { showContent: true, showType: true }],
                }),
              })
              const d = (await res.json()) as {
                result?: {
                  data?: {
                    type?: string
                    content?: { fields?: { owner?: string; deepbook_pool?: string } }
                  }
                }
              }
              if (d.result?.data?.type?.includes('MarginManager')) {
                const fields = d.result.data.content?.fields
                const owner = fields?.owner
                if (owner && owner.replace(/^0x0*/, '0x') === addr.replace(/^0x0*/, '0x')) {
                  addLog('info', `Found existing Margin Manager: ${id.slice(0, 12)}…`)
                  return id
                }
              }
            } catch {
              /* skip */
            }
          }
        }
      } catch {
        /* no registry results */
      }

      // Create new Margin Manager
      addLog('info', `Creating Margin Manager for ${addr.slice(0, 8)}…`)
      const dbCreate = new DeepBookClient({
        client,
        address: addr,
        network: n,
        coins: sdkCoins,
        pools: sdkPools,
        packageIds: sdkPkgIds,
      })
      const tx = new Transaction()
      const { manager, initializer } =
        dbCreate.marginManager.newMarginManagerWithInitializer(poolKey)(tx)
      dbCreate.marginManager.shareMarginManager(poolKey, manager, initializer)(tx)
      const result = (await signAndExec(kp, tx, net)) as Record<string, unknown>
      const digest = result?.digest as string
      addLog('info', `MM create tx: ${digest?.slice(0, 16)}…`)

      // Parse objectChanges to find the new MarginManager ID
      if (digest) {
        for (let attempt = 0; attempt < 4; attempt++) {
          await new Promise((r) => setTimeout(r, 2000 + attempt * 1000))
          const txRes = await fetch(RPC[n], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'sui_getTransactionBlock',
              params: [digest, { showObjectChanges: true }],
            }),
          })
          const txData = (await txRes.json()) as {
            result?: { objectChanges?: { type: string; objectId: string; objectType?: string }[] }
          }
          const changes = txData.result?.objectChanges ?? []
          const mmChange = changes.find(
            (o) => o.type === 'created' && o.objectType?.includes('MarginManager'),
          )
          if (mmChange) {
            addLog('success', `Margin Manager created: ${mmChange.objectId.slice(0, 12)}…`)
            return mmChange.objectId
          }
        }
      }

      throw new Error('Could not find Margin Manager ID — tx: ' + (digest ?? 'unknown'))
    },
    [addLog, signAndExec],
  )

  /** Deposit tokens into Balance Manager */
  const depositToManager = useCallback(
    async (kp: Ed25519Keypair, net: string, bmId: string, coinKey: string, amount: number) => {
      const addr = kp.getPublicKey().toSuiAddress()
      const n = net as 'mainnet' | 'testnet'
      const client = new SuiGrpcClient({ network: n, baseUrl: RPC[n] })
      const dbClient = new DeepBookClient({
        client,
        address: addr,
        network: n,
        coins: n === 'mainnet' ? mainnetCoins : testnetCoins,
        pools: n === 'mainnet' ? mainnetPools : testnetPools,
        packageIds: n === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
        balanceManagers: { main: { address: bmId } },
      })
      const tx = new Transaction()
      tx.add(dbClient.balanceManager.depositIntoManager('main', coinKey, amount))
      await signAndExec(kp, tx, net)
    },
    [signAndExec],
  )

  /** Execute maker cycle: POST_ONLY limit orders on both sides */
  const executeMakerCycle = useCallback(async () => {
    const kpA = keypairARef.current
    const kpB = keypairBRef.current
    if (!kpA || !kpB || !bmIdA || !bmIdB) return

    const net = network as 'mainnet' | 'testnet'
    const client = new SuiGrpcClient({ network: net, baseUrl: RPC[net] })
    const indexer = INDEXER[net]
    const aAddr = kpA.getPublicKey().toSuiAddress()
    const bAddr = kpB.getPublicKey().toSuiAddress()
    const poolKey = config.pool
    const sdkPools = net === 'mainnet' ? mainnetPools : testnetPools

    stageRef.current = 'opening'
    setStage('opening')
    const num = cycleRef.current + 1
    cycleRef.current = num
    setCycleNum(num)
    addLog('info', `Maker #${num} — Placing POST_ONLY orders...`)

    let bidPrice = 0
    let askPrice = 0
    let qty = 0
    try {
      const obRes = await fetch(`${indexer}/orderbook/${poolKey}?level=2&depth=4`)
      const ob: { bids: [string, string][]; asks: [string, string][] } = await obRes.json()
      if (!ob.bids.length || !ob.asks.length) throw new Error('Empty orderbook')

      bidPrice = parseFloat(ob.bids[0][0])
      askPrice = parseFloat(ob.asks[0][0])
      const mid = (bidPrice + askPrice) / 2
      setCurrentPrice(mid)

      const tickerRes = await fetch(`${indexer}/ticker`)
      await tickerRes.json() // warm up
      const [, quote] = poolKey.split('_')

      // Fetch pool constraints
      const poolsRes = await fetch(`${indexer}/get_pools`)
      const poolsMeta: {
        pool_name: string
        lot_size: number
        min_size: number
        base_asset_decimals: number
      }[] = await poolsRes.json()
      const poolMeta = poolsMeta.find((p) => p.pool_name === poolKey)
      const baseDec = poolMeta?.base_asset_decimals ?? 6
      const lotSize = (poolMeta?.lot_size ?? 1000000) / 10 ** baseDec
      const minSize = (poolMeta?.min_size ?? 10000000) / 10 ** baseDec

      if (!(poolKey in sdkPools)) throw new Error(`Pool ${poolKey} not in SDK`)

      const makeDb = (addr: string, bm: string) =>
        new DeepBookClient({
          client,
          address: addr,
          network: net,
          coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
          pools: sdkPools,
          packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
          balanceManagers: { main: { address: bm } },
        })

      // Check both manager balances to determine qty
      const [base] = poolKey.split('_')
      const dbA = makeDb(aAddr, bmIdA)
      const dbB = makeDb(bAddr, bmIdB)
      const [mgrBalA, mgrBalB] = await Promise.all([
        dbA.checkManagerBalanceWithAddress(bmIdA, quote),
        dbB.checkManagerBalanceWithAddress(bmIdB, base),
      ])
      addLog(
        'info',
        `Mgr A: ${mgrBalA.balance.toFixed(4)} ${quote} | Mgr B: ${mgrBalB.balance.toFixed(4)} ${base}`,
      )

      // Auto top-up managers if balance too low for min order
      const minQuoteNeeded = minSize * askPrice * 1.1
      const minBaseNeeded = minSize * 1.1

      // First: withdraw settled balances back to manager (after order fills, tokens may be in settled state)
      for (const [kp, bm, addr] of [[kpA, bmIdA, aAddr] as const, [kpB, bmIdB, bAddr] as const]) {
        try {
          const db = makeDb(addr, bm)
          // settleBalanceManager moves settled funds back to available
          const txSettle = new Transaction()
          txSettle.add(db.deepBook.cancelAllOrders(poolKey, 'main'))
          await signAndExec(kp, txSettle, net)
        } catch {
          /* no open orders */
        }
      }

      // Re-check balances after settle
      const [mgrBalA2, mgrBalB2] = await Promise.all([
        dbA.checkManagerBalanceWithAddress(bmIdA, quote),
        dbB.checkManagerBalanceWithAddress(bmIdB, base),
      ])
      addLog(
        'info',
        `After settle — A: ${mgrBalA2.balance.toFixed(4)} ${quote} | B: ${mgrBalB2.balance.toFixed(4)} ${base}`,
      )

      // Top-up from wallet if still low
      if (mgrBalA2.balance < minQuoteNeeded) {
        const walletCoins = await fetchAllCoins(aAddr)
        const walletQuote = parseFloat(walletCoins.find((c) => c.symbol === quote)?.balance ?? '0')
        if ((walletQuote - 0.5) * 0.8 > 0.001) {
          const topUp = Math.min((walletQuote - 0.5) * 0.8, minQuoteNeeded * 5)
          addLog('info', `Top-up A: +${topUp.toFixed(4)} ${quote}`)
          await depositToManager(kpA, net, bmIdA, quote, topUp)
          mgrBalA2.balance += topUp
        } else {
          // A may have base token from filled buy orders — recycle: withdraw base → swap → deposit quote
          addLog('info', `A has no ${quote} in wallet. Recycling...`)
          const mgrBaseA = await dbA.checkManagerBalanceWithAddress(bmIdA, base)
          if (mgrBaseA.balance > 0.01) {
            const withdrawAmt = mgrBaseA.balance * 0.9
            addLog('info', `Withdrawing ${withdrawAmt.toFixed(4)} ${base} from A manager...`)
            const txW = new Transaction()
            txW.add(dbA.balanceManager.withdrawFromManager('main', base, withdrawAmt, aAddr))
            await signAndExec(kpA, txW, net)
            // Swap base → quote
            addLog('info', `Swapping ${withdrawAmt.toFixed(4)} ${base} → ${quote}...`)
            const txS = new Transaction()
            const plainDbA = new DeepBookClient({
              client,
              address: aAddr,
              network: net,
              coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
              pools: sdkPools,
              packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
            })
            buildSwapSell(plainDbA, poolKey, withdrawAmt * 0.9, aAddr, txS)
            await signAndExec(kpA, txS, net)
            // Re-deposit quote
            const freshCoins = await fetchAllCoins(aAddr)
            const freshQuote = parseFloat(
              freshCoins.find((c) => c.symbol === quote)?.balance ?? '0',
            )
            if (freshQuote - 0.5 > 0.001) {
              const dep = (freshQuote - 0.5) * 0.8
              addLog('info', `Re-depositing ${dep.toFixed(4)} ${quote} into A manager...`)
              await depositToManager(kpA, net, bmIdA, quote, dep)
              mgrBalA2.balance += dep
            }
          }
        }
      }
      if (mgrBalB2.balance < minBaseNeeded) {
        const walletCoins = await fetchAllCoins(bAddr)
        const walletBase = parseFloat(walletCoins.find((c) => c.symbol === base)?.balance ?? '0')
        addLog(
          'info',
          `B wallet ${base}: ${walletBase.toFixed(4)}, need min: ${minBaseNeeded.toFixed(4)}`,
        )

        if (walletBase * 0.8 > 0.001) {
          const topUp = Math.min(walletBase * 0.8, minBaseNeeded * 5)
          addLog('info', `Top-up B: +${topUp.toFixed(4)} ${base}`)
          await depositToManager(kpB, net, bmIdB, base, topUp)
          mgrBalB2.balance += topUp
        } else {
          // Wallet B has no base — check wallet quote (SUI) to swap → base → deposit
          addLog('info', `B has no ${base}. Checking wallet ${quote}...`)
          const walletQuoteB = parseFloat(
            walletCoins.find((c) => c.symbol === quote)?.balance ?? '0',
          )

          if (walletQuoteB > 0.5) {
            const swapAmt = (walletQuoteB - 0.3) * 0.8
            addLog('info', `Swapping ${swapAmt.toFixed(4)} ${quote} → ${base} from wallet...`)
            // Use plain client WITHOUT balance manager to avoid object version conflict
            const plainDb = new DeepBookClient({
              client,
              address: bAddr,
              network: net,
              coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
              pools: sdkPools,
              packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
            })
            const txS = new Transaction()
            buildSwapBuy(plainDb, poolKey, swapAmt, bAddr, txS)
            await signAndExec(kpB, txS, net)

            const freshCoins = await fetchAllCoins(bAddr)
            const freshBase = parseFloat(freshCoins.find((c) => c.symbol === base)?.balance ?? '0')
            if (freshBase > 0.001) {
              const dep = freshBase * 0.8
              addLog('info', `Depositing ${dep.toFixed(4)} ${base} into B manager...`)
              await depositToManager(kpB, net, bmIdB, base, dep)
              mgrBalB2.balance += dep
              addLog('success', `B recycled: ${dep.toFixed(4)} ${base}`)
            }
          } else {
            // Also check manager for quote to withdraw+swap
            const dbB = makeDb(bAddr, bmIdB)
            const mgrQuoteB = await dbB.checkManagerBalanceWithAddress(bmIdB, quote)
            if (mgrQuoteB.balance > 0.01) {
              const withdrawAmt = mgrQuoteB.balance * 0.9
              addLog(
                'info',
                `Withdrawing ${withdrawAmt.toFixed(4)} ${quote} from B manager → swap...`,
              )
              const txW = new Transaction()
              txW.add(dbB.balanceManager.withdrawFromManager('main', quote, withdrawAmt, bAddr))
              await signAndExec(kpB, txW, net)
              const swapAmt = withdrawAmt * 0.9
              const txS = new Transaction()
              const plainDbB2 = new DeepBookClient({
                client,
                address: bAddr,
                network: net,
                coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
                pools: sdkPools,
                packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
              })
              buildSwapBuy(plainDbB2, poolKey, swapAmt, bAddr, txS)
              await signAndExec(kpB, txS, net)
              const freshCoins2 = await fetchAllCoins(bAddr)
              const freshBase2 = parseFloat(
                freshCoins2.find((c) => c.symbol === base)?.balance ?? '0',
              )
              if (freshBase2 > 0.001) {
                const dep = freshBase2 * 0.8
                await depositToManager(kpB, net, bmIdB, base, dep)
                mgrBalB2.balance += dep
                addLog('success', `B recycled from manager: ${dep.toFixed(4)} ${base}`)
              }
            } else {
              addLog('warn', `B has no ${base} or ${quote} anywhere — need more funds`)
            }
          }
        }
      }

      // A needs quote (qty * bidPrice), B needs base (qty directly)
      const maxQtyFromA = (mgrBalA2.balance * 0.9) / bidPrice
      const maxQtyFromB = mgrBalB2.balance * 0.9
      const rawQty = Math.min(maxQtyFromA, maxQtyFromB)
      qty = Math.floor(rawQty / lotSize) * lotSize
      if (qty < minSize)
        throw new Error(
          `Qty ${qty} < min ${minSize}. A: ${mgrBalA.balance.toFixed(4)} ${quote}, B: ${mgrBalB.balance.toFixed(4)} ${base}`,
        )
      addLog('info', `Bid: ${formatOBPrice(bidPrice)} Ask: ${formatOBPrice(askPrice)} Qty: ${qty}`)

      const oid = Date.now().toString()

      // A: BUY limit at best bid (maker, fee=0)
      const txA = new Transaction()
      txA.add(
        makeDb(aAddr, bmIdA).deepBook.placeLimitOrder({
          poolKey,
          balanceManagerKey: 'main',
          clientOrderId: oid,
          price: bidPrice,
          quantity: qty,
          isBid: true,
          orderType: OrderType.POST_ONLY,
          payWithDeep: false,
        }),
      )
      addLog('info', 'A: BUY limit (POST_ONLY)...')
      await signAndExec(kpA, txA, net)
      addLog('success', `A: BUY at ${formatOBPrice(bidPrice)}`)

      // B: SELL limit at best ask (maker, fee=0)
      const txB = new Transaction()
      txB.add(
        makeDb(bAddr, bmIdB).deepBook.placeLimitOrder({
          poolKey,
          balanceManagerKey: 'main',
          clientOrderId: oid,
          price: askPrice,
          quantity: qty,
          isBid: false,
          orderType: OrderType.POST_ONLY,
          payWithDeep: false,
        }),
      )
      addLog('info', 'B: SELL limit (POST_ONLY)...')
      await signAndExec(kpB, txB, net)
      addLog('success', `B: SELL at ${formatOBPrice(askPrice)}`)

      setOrderPrices({ bid: bidPrice, ask: askPrice })
      setTotalVolume((v) => v + config.notionalUsd * 2)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addLog('error', `Maker open failed: ${msg}`)
      stageRef.current = 'error'
      setStage('error')
      setError(msg)
      return
    }

    // HOLD — wait for fills
    stageRef.current = 'holding'
    setStage('holding')
    const holdSec = randRange(config.holdMinSec, config.holdMaxSec)
    setHoldStart(Date.now())
    setHoldEnd(Date.now() + holdSec * 1000)
    addLog('info', `Holding ${holdSec}s (waiting for fills)...`)
    await new Promise((r) => setTimeout(r, holdSec * 1000))
    if (stageRef.current !== 'holding') {
      addLog('warn', 'Interrupted')
      return
    }

    // CLOSE — cancel remaining + settle
    stageRef.current = 'closing'
    setStage('closing')
    addLog('info', `Maker #${num} — Cancelling + settling...`)
    try {
      const makeDb = (addr: string, bm: string) =>
        new DeepBookClient({
          client,
          address: addr,
          network: net,
          coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
          pools: sdkPools,
          packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
          balanceManagers: { main: { address: bm } },
        })
      const txCA = new Transaction()
      txCA.add(makeDb(aAddr, bmIdA).deepBook.cancelAllOrders(poolKey, 'main'))
      await signAndExec(kpA, txCA, net)
      const txCB = new Transaction()
      txCB.add(makeDb(bAddr, bmIdB).deepBook.cancelAllOrders(poolKey, 'main'))
      await signAndExec(kpB, txCB, net)

      const spread = askPrice - bidPrice
      const pnl = spread * qty
      setTotalPnl((p) => p + pnl)
      setHistory((h) => [
        { num, openPrice: bidPrice, closePrice: askPrice, pnl, duration: holdSec },
        ...h.slice(0, 49),
      ])
      addLog('success', `Maker #${num} done — Spread: ${formatUsd(pnl)}`)
    } catch (err) {
      addLog('error', `Maker close failed: ${err instanceof Error ? err.message : err}`)
      stageRef.current = 'error'
      setStage('error')
      return
    }
    setHoldEnd(null)
    setHoldStart(null)
    setOrderPrices({ bid: null, ask: null })
    if (config.maxCycles && num >= config.maxCycles) {
      addLog('info', `Max cycles reached`)
      stageRef.current = 'idle'
      setStage('idle')
      setRunning(false)
      return
    }
    stageRef.current = 'idle'
    setStage('idle')
  }, [network, config, addLog, signAndExec, bmIdA, bmIdB])

  /** Volume Farm: 1 account, buy then sell same amount. Minimal cost, max volume for points. */
  const executeVolumeCycle = useCallback(async () => {
    const kpA = keypairARef.current
    if (!kpA) return

    const net = network as 'mainnet' | 'testnet'
    const indexer = INDEXER[net]
    const aAddr = kpA.getPublicKey().toSuiAddress()
    const poolKey = config.pool
    const sdkPools = net === 'mainnet' ? mainnetPools : testnetPools
    const [base, quote] = poolKey.split('_')

    stageRef.current = 'opening'
    setStage('opening')
    const num = cycleRef.current + 1
    cycleRef.current = num
    setCycleNum(num)

    try {
      if (!(poolKey in sdkPools)) throw new Error(`Pool ${poolKey} not in SDK`)

      // Get price + wallet balance
      const tickerRes = await fetch(`${indexer}/ticker`)
      const ticker: Record<string, { last_price: number }> = await tickerRes.json()
      const price = ticker[poolKey]?.last_price ?? 0
      if (!price) throw new Error('No price')
      setCurrentPrice(price)

      const suiUsd = ticker['SUI_USDC']?.last_price ?? 1
      const walletCoins = await fetchAllCoins(aAddr)
      const walletQuote = parseFloat(walletCoins.find((c) => c.symbol === quote)?.balance ?? '0')

      // Calculate swap amount: use small % of wallet to minimize slippage loss
      let swapQuote: number
      if (quote === 'SUI') {
        swapQuote = Math.min((config.notionalUsd / suiUsd) * 0.8, (walletQuote - 0.3) * 0.5)
      } else {
        swapQuote = Math.min(config.notionalUsd * 0.8, walletQuote * 0.5)
      }
      if (swapQuote <= 0) throw new Error(`Not enough ${quote}. Have: ${walletQuote.toFixed(4)}`)

      const qty = swapQuote / price
      addLog(
        'info',
        `Vol #${num} — BUY ${qty.toFixed(1)} ${base} (${swapQuote.toFixed(4)} ${quote})`,
      )

      // Step 1: BUY base with quote
      const plainDb = new DeepBookClient({
        client: new SuiGrpcClient({ network: net, baseUrl: RPC[net] }),
        address: aAddr,
        network: net,
        coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
        pools: sdkPools,
        packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
      })
      const txBuy = new Transaction()
      buildSwapBuy(plainDb, poolKey, swapQuote, aAddr, txBuy)
      await signAndExec(kpA, txBuy, net)
      addLog('success', `BUY filled at ${formatOBPrice(price)}`)
      setOrderPrices({ bid: price, ask: null })

      // Step 2: Hold briefly (shorter for volume farming)
      stageRef.current = 'holding'
      setStage('holding')
      const holdSec = randRange(5, 15) // short hold — just enough to not look like wash trading
      setHoldStart(Date.now())
      setHoldEnd(Date.now() + holdSec * 1000)
      await new Promise((r) => setTimeout(r, holdSec * 1000))
      if (stageRef.current !== 'holding') return

      // Step 3: SELL base back
      stageRef.current = 'closing'
      setStage('closing')
      const freshCoins = await fetchAllCoins(aAddr)
      const baseHeld = parseFloat(freshCoins.find((c) => c.symbol === base)?.balance ?? '0')
      const sellQty = baseHeld * 0.95 // sell 95% of what we bought
      if (sellQty < 0.001) throw new Error(`No ${base} to sell back`)

      addLog('info', `SELL ${sellQty.toFixed(1)} ${base}...`)
      const txSell = new Transaction()
      buildSwapSell(plainDb, poolKey, sellQty, aAddr, txSell)
      await signAndExec(kpA, txSell, net)

      const closePrice = ticker[poolKey]?.last_price ?? price
      const volume = swapQuote * 2 // buy + sell
      const volumeUsd = quote === 'SUI' ? volume * suiUsd : volume
      setTotalVolume((v) => v + volumeUsd)

      // PnL is near zero (spread cost only)
      const pnl = -volumeUsd * 0.001 // ~0.1% spread cost estimate
      setTotalPnl((p) => p + pnl)
      setHistory((h) => [
        { num, openPrice: price, closePrice, pnl, duration: holdSec },
        ...h.slice(0, 49),
      ])
      addLog(
        'success',
        `Vol #${num} done — Vol: ${formatUsd(volumeUsd)} — Cost: ${formatUsd(Math.abs(pnl))}`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addLog('error', `Vol #${num} failed: ${msg}`)
      stageRef.current = 'error'
      setStage('error')
      setError(msg)
      return
    }

    setHoldEnd(null)
    setHoldStart(null)
    setOrderPrices({ bid: null, ask: null })
    if (config.maxCycles && num >= config.maxCycles) {
      addLog('info', 'Max cycles reached')
      stageRef.current = 'idle'
      setStage('idle')
      setRunning(false)
      return
    }
    stageRef.current = 'idle'
    setStage('idle')
  }, [network, config, addLog, signAndExec, fetchAllCoins])

  /** Cleanup margin positions — delegates to strategies/margin.ts */
  const cleanupMargin = useCallback(async () => {
    const kpA = keypairARef.current
    const kpB = keypairBRef.current
    const curMmIdA = mmIdARef.current
    const curMmIdB = mmIdBRef.current
    if (!kpA || !kpB || !curMmIdA || !curMmIdB) return
    const net = network as 'mainnet' | 'testnet'
    await _cleanupMarginPositions(
      kpA,
      kpB,
      curMmIdA,
      curMmIdB,
      net,
      config.pool,
      addLog,
      signAndExec,
    )
    setOrderPrices({ bid: null, ask: null })
    fetchMmBals()
    if (keypairARef.current)
      fetchBalance(keypairARef.current.getPublicKey().toSuiAddress()).then(setBalA)
    if (keypairBRef.current)
      fetchBalance(keypairBRef.current.getPublicKey().toSuiAddress()).then(setBalB)
  }, [network, config.pool, signAndExec, addLog, fetchMmBals, fetchBalance])

  /** Margin cycle — delegates to strategies/margin.ts */
  const executeMarginCycle = useCallback(async () => {
    const kpA = keypairARef.current
    const kpB = keypairBRef.current
    const curMmIdA = mmIdARef.current
    const curMmIdB = mmIdBRef.current
    if (!kpA || !kpB || !curMmIdA || !curMmIdB) return
    await _executeMarginCycle({
      kpA,
      kpB,
      mmIdA: curMmIdA,
      mmIdB: curMmIdB,
      cleanupMargin,
      network: network as 'mainnet' | 'testnet',
      config,
      addLog,
      signAndExec: signAndExec as any,
      setStage,
      setCurrentPrice,
      setOrderPrices,
      setTotalVolume,
      setTotalPnl,
      setHistory,
      setHoldStart,
      setHoldEnd,
      stageRef,
      cycleRef,
      setCycleNum,
    })
    if (config.maxCycles && cycleRef.current >= config.maxCycles) setRunning(false)
  }, [network, config, addLog, signAndExec, cleanupMargin])

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
    const [base, quote] = poolKey.split('_')

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

    // 3. Check token needs
    const bHasBase = valB.coins.some((c) => c.symbol === base && parseFloat(c.balance) > 0)
    const aQuoteBal = parseFloat(valA.coins.find((c) => c.symbol === quote)?.balance ?? '0')
    const aHasEnoughQuote = aQuoteBal >= config.notionalUsd * 0.5 // need at least half notional

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

    // 6. Swap: A needs quote token (e.g. USDC for SUI_USDC)
    if (quote !== 'SUI' && !aHasEnoughQuote && poolKey in sdkPools) {
      const aSui = parseFloat(
        (await fetchAllCoins(aAddr)).find((c) => c.symbol === 'SUI')?.balance ?? '0',
      )
      const swapSui = (aSui - gasReserve) * 0.9
      if (swapSui > 0.1) {
        // Need to swap SUI → quote. Find SUI_QUOTE pool or QUOTE_SUI pool
        const suiQuotePool = `SUI_${quote}` in sdkPools ? `SUI_${quote}` : null
        const quotesuiPool = `${quote}_SUI` in sdkPools ? `${quote}_SUI` : null
        const plainDb = new DeepBookClient({
          client,
          address: aAddr,
          network: net,
          coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
          pools: sdkPools,
          packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
        })
        const tx3 = new Transaction()
        if (suiQuotePool) {
          // SUI is base, quote is quote → sell SUI for quote
          addLog('info', `Swapping ${swapSui.toFixed(4)} SUI → ${quote} for Account A...`)
          buildSwapSell(plainDb, suiQuotePool, swapSui, aAddr, tx3)
        } else if (quotesuiPool) {
          // quote is base, SUI is quote → buy quote with SUI
          addLog('info', `Swapping ${swapSui.toFixed(4)} SUI → ${quote} for Account A...`)
          buildSwapBuy(plainDb, quotesuiPool, swapSui, aAddr, tx3)
        }
        if (suiQuotePool || quotesuiPool) {
          await signAndExec(kpA, tx3, net)
          addLog('success', `Swapped SUI → ${quote} for A`)
        }
      }
    } else if (quote !== 'SUI' && aHasEnoughQuote) {
      addLog('info', `A has ${aQuoteBal.toFixed(2)} ${quote} — enough`)
    }

    // Refresh balances
    const [newBalA, newBalB] = await Promise.all([fetchBalance(aAddr), fetchBalance(bAddr)])
    setBalA(newBalA)
    setBalB(newBalB)
    addLog('success', 'Auto-balance complete!')
  }, [network, config.pool, addLog, signAndExec, fetchBalance])

  // ── Start / Stop ─────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (!keypairARef.current) {
      setError('Import at least Account A key')
      return
    }
    if (config.strategy !== 'volume' && !keypairBRef.current) {
      setError('Import both keys for Maker/Taker strategy')
      return
    }
    setError(null)
    setRunning(true)
    setTab('dashboard')
    addLog(
      'info',
      `Bot starting — ${config.strategy.toUpperCase()} — Pool: ${config.pool}, Notional: ${formatUsd(config.notionalUsd)}`,
    )

    // Volume strategy: skip auto-balance and BM setup — just use Account A
    if (config.strategy === 'volume') {
      addLog('info', 'Volume farm mode — using Account A only')
      const cycleFn = executeVolumeCycle
      cycleFn()
      intervalRef.current = setInterval(() => {
        if (stageRef.current === 'idle') cycleFn()
      }, config.intervalMs)
      return
    }

    // Margin strategy: ensure MarginManagers exist, then run cycles
    if (config.strategy === 'margin') {
      try {
        addLog('info', 'Setting up Margin Managers...')
        const net = network as 'mainnet' | 'testnet'
        const idA = await ensureMarginManager(keypairARef.current, net, config.pool, mmIdA)
        setMmIdA(idA)
        try {
          localStorage.setItem('hb_mmA', idA)
        } catch {}
        const idB = await ensureMarginManager(keypairBRef.current!, net, config.pool, mmIdB)
        setMmIdB(idB)
        try {
          localStorage.setItem('hb_mmB', idB)
        } catch {}
        addLog('success', `Margin Managers ready — A: ${idA.slice(0, 10)}… B: ${idB.slice(0, 10)}…`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        addLog('error', `Margin Manager setup failed: ${msg}`)
        setError(msg)
        setRunning(false)
        return
      }
      const cycleFn = executeMarginCycle
      cycleFn()
      intervalRef.current = setInterval(() => {
        if (stageRef.current === 'idle') cycleFn()
      }, config.intervalMs)
      return
    }

    // Auto-balance before first cycle (taker/maker)
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

    // Setup Balance Managers for maker strategy
    if (config.strategy === 'maker') {
      try {
        addLog('info', 'Setting up Balance Managers...')
        const net = network
        const idA = await ensureBalanceManager(keypairARef.current, net, bmIdA)
        setBmIdA(idA)
        try {
          localStorage.setItem('hb_bmA', idA)
        } catch {}
        const idB = await ensureBalanceManager(keypairBRef.current!, net, bmIdB)
        setBmIdB(idB)
        try {
          localStorage.setItem('hb_bmB', idB)
        } catch {}

        const [base, quote] = config.pool.split('_')
        const aCoins = await fetchAllCoins(keypairARef.current.getPublicKey().toSuiAddress())
        const bCoins = await fetchAllCoins(keypairBRef.current!.getPublicKey().toSuiAddress())

        const aQuoteBal = parseFloat(aCoins.find((c) => c.symbol === quote)?.balance ?? '0')
        const aDeposit = Math.max(0, (aQuoteBal - 0.5) * 0.7)
        if (aDeposit > 0.001) {
          addLog('info', `Depositing ${aDeposit.toFixed(4)} ${quote} into A manager...`)
          await depositToManager(keypairARef.current, net, idA, quote, aDeposit)
        }

        // B needs base token (e.g. DEEP for DEEP_SUI)
        const bBaseBal = parseFloat(bCoins.find((c) => c.symbol === base)?.balance ?? '0')
        const bDeposit = Math.max(0, bBaseBal * 0.7) // deposit 70% of base
        if (bDeposit > 0.001) {
          addLog('info', `Depositing ${bDeposit.toFixed(4)} ${base} into B manager...`)
          await depositToManager(keypairBRef.current!, net, idB, base, bDeposit)
        }
        addLog('success', 'Balance Managers ready')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        addLog('error', `Balance Manager setup failed: ${msg}`)
        setError(msg)
        setRunning(false)
        return
      }
    }

    const cycleFn = config.strategy === 'maker' ? executeMakerCycle : executeCycle
    addLog('info', 'Starting cycle loop...')
    cycleFn()
    intervalRef.current = setInterval(() => {
      if (stageRef.current === 'idle') cycleFn()
    }, config.intervalMs)
  }, [
    config,
    executeCycle,
    executeMakerCycle,
    executeMarginCycle,
    executeVolumeCycle,
    addLog,
    autoBalance,
    network,
    ensureBalanceManager,
    ensureMarginManager,
    depositToManager,
    bmIdA,
    bmIdB,
    mmIdA,
    mmIdB,
  ])

  const stop = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    stageRef.current = 'idle'
    setStage('idle')
    setRunning(false)
    setHoldEnd(null)
    setHoldStart(null)

    if (config.strategy === 'margin' && mmIdARef.current && mmIdBRef.current) {
      addLog('warn', 'Stopping — cleaning up margin positions...')
      await cleanupMargin()
      addLog('success', 'Margin positions closed, funds returned to wallets')
    } else {
      addLog('warn', 'Bot stopped by user')
    }
    setOrderPrices({ bid: null, ask: null })
  }, [addLog, config.strategy, cleanupMargin])

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

  // Fetch manager balances when tab = accounts
  useEffect(() => {
    if (tab === 'accounts' && (bmIdA || bmIdB)) fetchMgrBals()
    if (tab === 'accounts' && (mmIdA || mmIdB)) fetchMmBals()
    if (tab === 'accounts') {
      if (addrA) {
        fetchTxHistory(addrA)
        fetchPendingOrders(bmIdA, addrA)
        fetchAllMMs(addrA)
      }
      if (addrB) {
        fetchTxHistory(addrB)
        fetchPendingOrders(bmIdB, addrB)
        fetchAllMMs(addrB)
      }
    }
  }, [
    tab,
    bmIdA,
    bmIdB,
    mmIdA,
    mmIdB,
    fetchMgrBals,
    fetchMmBals,
    addrA,
    addrB,
    fetchTxHistory,
    fetchPendingOrders,
    fetchAllMMs,
  ])

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

  const keysReady = config.strategy === 'volume' ? !!addrA : !!addrA && !!addrB

  const handleForceCloseMargins = useCallback(async () => {
    addLog('warn', 'Force closing all margin positions...')
    await cleanupMargin()
    addLog('success', 'All margin positions closed')
  }, [addLog, cleanupMargin])

  const handleSwapAllToSui = useCallback(async () => {
    const net = network as 'mainnet' | 'testnet'
    const sdkPools = net === 'mainnet' ? mainnetPools : testnetPools
    const swapToSui = async (kp: Ed25519Keypair | null, addr: string | null) => {
      if (!kp || !addr) return
      const coins = await fetchAllCoins(addr)
      for (const c of coins) {
        if (c.symbol === 'SUI' || parseFloat(c.balance) < 0.001) continue
        const amt = parseFloat(c.balance)
        const route1 = `${c.symbol}_SUI`
        const route2 = `SUI_${c.symbol}`
        const plainDb = new DeepBookClient({
          client: new SuiGrpcClient({ network: net, baseUrl: RPC[net] }),
          address: addr,
          network: net,
          coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
          pools: sdkPools,
          packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
        })
        try {
          const tx = new Transaction()
          if (route1 in sdkPools) {
            addLog('info', `${c.symbol} → SUI: sell ${amt.toFixed(4)} via ${route1}`)
            buildSwapSell(plainDb, route1, amt, addr, tx)
          } else if (route2 in sdkPools) {
            addLog(
              'info',
              `${c.symbol} → SUI: buy SUI via ${route2} with ${amt.toFixed(4)} ${c.symbol}`,
            )
            buildSwapBuy(plainDb, route2, amt, addr, tx)
          } else {
            const toUsdc = `${c.symbol}_USDC`
            if (toUsdc in sdkPools) {
              addLog('info', `${c.symbol} → USDC → SUI (2-hop)`)
              buildSwapSell(plainDb, toUsdc, amt, addr, tx)
            } else {
              addLog('warn', `No route for ${c.symbol} → SUI`)
              continue
            }
          }
          await signAndExec(kp, tx, net)
          addLog('success', `Swapped ${c.symbol} → SUI`)
        } catch (err) {
          addLog('warn', `Skip ${c.symbol}: ${err instanceof Error ? err.message : err}`)
        }
      }
      const freshCoins = await fetchAllCoins(addr)
      const usdc = freshCoins.find((c) => c.symbol === 'USDC' && parseFloat(c.balance) > 0.01)
      if (usdc && 'SUI_USDC' in sdkPools) {
        const usdcAmt = parseFloat(usdc.balance)
        try {
          addLog('info', `USDC → SUI: buy ${usdcAmt.toFixed(4)} USDC worth of SUI`)
          const plainDb2 = new DeepBookClient({
            client: new SuiGrpcClient({ network: net, baseUrl: RPC[net] }),
            address: addr,
            network: net,
            coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
            pools: sdkPools,
            packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
          })
          const tx2 = new Transaction()
          buildSwapBuy(plainDb2, 'SUI_USDC', usdcAmt, addr, tx2)
          await signAndExec(kp, tx2, net)
          addLog('success', 'Swapped USDC → SUI')
        } catch (err) {
          addLog('warn', `USDC→SUI: ${err instanceof Error ? err.message : err}`)
        }
      }
    }
    addLog('info', 'Swapping all tokens → SUI...')
    await swapToSui(keypairARef.current, addrA)
    await swapToSui(keypairBRef.current, addrB)
    addLog('success', 'Done — all tokens → SUI')
    if (addrA) fetchBalance(addrA).then(setBalA)
    if (addrB) fetchBalance(addrB).then(setBalB)
  }, [network, addrA, addrB, addLog, signAndExec, fetchAllCoins, fetchBalance])

  const handleWithdrawAllFromManager = useCallback(
    async (label: string, bmId: string, addr: string, isAccountA: boolean) => {
      const kp = isAccountA ? keypairARef.current : keypairBRef.current
      if (!kp || !bmId) return
      const [base, quote] = config.pool.split('_')
      const net = network as 'mainnet' | 'testnet'
      const client = new SuiGrpcClient({ network: net, baseUrl: RPC[net] })
      const dbClient = new DeepBookClient({
        client,
        address: addr,
        network: net,
        coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
        pools: net === 'mainnet' ? mainnetPools : testnetPools,
        packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
        balanceManagers: { main: { address: bmId } },
      })
      try {
        addLog('info', `Cancelling orders + withdrawing ${label}...`)
        const txC = new Transaction()
        txC.add(dbClient.deepBook.cancelAllOrders(config.pool, 'main'))
        await signAndExec(kp, txC, net)
        for (const coinKey of [base, quote, 'DEEP']) {
          try {
            const txW = new Transaction()
            txW.add(dbClient.balanceManager.withdrawAllFromManager('main', coinKey, addr))
            await signAndExec(kp, txW, net)
            addLog('success', `Withdrew ${coinKey} from ${label}`)
          } catch {
            /* skip */
          }
        }
        addLog('success', `Manager ${label} emptied`)
        fetchBalance(addr).then(isAccountA ? setBalA : setBalB)
        fetchMgrBals()
      } catch (err) {
        addLog('error', `Withdraw failed: ${err instanceof Error ? err.message : err}`)
      }
    },
    [network, config.pool, addLog, signAndExec, fetchBalance, fetchMgrBals],
  )

  const handleResetManagerCache = useCallback(
    (label: string, setBm: (id: string | null) => void, lsKey: string) => {
      setBm(null)
      try {
        localStorage.removeItem(lsKey)
      } catch {
        /* ignore */
      }
      addLog('info', `Cleared ${label} cache`)
      fetchMgrBals()
    },
    [addLog, fetchMgrBals],
  )

  const withdrawManagerA = useCallback(() => {
    if (!bmIdA || !addrA) return
    void handleWithdrawAllFromManager('A (Long)', bmIdA, addrA, true)
  }, [bmIdA, addrA, handleWithdrawAllFromManager])

  const withdrawManagerB = useCallback(() => {
    if (!bmIdB || !addrB) return
    void handleWithdrawAllFromManager('B (Short)', bmIdB, addrB, false)
  }, [bmIdB, addrB, handleWithdrawAllFromManager])

  const resetManagerA = useCallback(() => {
    handleResetManagerCache('A (Long)', setBmIdA, 'hb_bmA')
  }, [handleResetManagerCache])

  const resetManagerB = useCallback(() => {
    handleResetManagerCache('B (Short)', setBmIdB, 'hb_bmB')
  }, [handleResetManagerCache])

  const accountsTabPanel = useMemo(() => {
    const suiUsd = currentPrice && config.pool === 'SUI_USDC' ? currentPrice : null
    const estimateUsd = (coins: { symbol: string; balance: string }[]) => {
      let total = 0
      for (const c of coins) {
        const amt = parseFloat(c.balance)
        if (c.symbol === 'SUI') total += amt * (suiUsd ?? 0.95)
        else if (c.symbol === 'USDC' || c.symbol === 'USDT') total += amt
        else if (c.symbol === 'DEEP') total += amt * 0.029
        else if (c.symbol === 'WAL') total += amt * 0.07
        else if (c.symbol === 'NS') total += amt * 0.018
      }
      return total
    }
    const usdA = estimateUsd(balA.coins)
    const usdB = estimateUsd(balB.coins)
    const totalUsd = usdA + usdB
    const [base, quote] = config.pool.split('_')

    return (
      <>
        {/* Total summary */}
        <div className="sui-hb__card" style={{ marginBottom: 12 }}>
          <div className="sui-hb__card-title">Portfolio Summary</div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}
          >
            <div className="sui-hb__stat">
              <span className="sui-hb__stat-label">Total Value</span>
              <span className="sui-hb__stat-value" style={{ color: '#22c55e' }}>
                {formatUsd(totalUsd)}
              </span>
            </div>
            <div className="sui-hb__stat">
              <span className="sui-hb__stat-label">Account A</span>
              <span className="sui-hb__stat-value">{formatUsd(usdA)}</span>
            </div>
            <div className="sui-hb__stat">
              <span className="sui-hb__stat-label">Account B</span>
              <span className="sui-hb__stat-value">{formatUsd(usdB)}</span>
            </div>
          </div>
          {/* Balance bar */}
          <div
            style={{
              display: 'flex',
              height: 6,
              borderRadius: 3,
              overflow: 'hidden',
              background: '#1e293b',
            }}
          >
            <div
              style={{
                width: `${totalUsd > 0 ? (usdA / totalUsd) * 100 : 50}%`,
                background: '#4da2ff',
              }}
            />
            <div
              style={{
                width: `${totalUsd > 0 ? (usdB / totalUsd) * 100 : 50}%`,
                background: '#a78bfa',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9,
              color: '#64748b',
              marginTop: 4,
            }}
          >
            <span>A: {totalUsd > 0 ? ((usdA / totalUsd) * 100).toFixed(1) : '50'}%</span>
            <span>B: {totalUsd > 0 ? ((usdB / totalUsd) * 100).toFixed(1) : '50'}%</span>
          </div>
          {Math.abs(usdA - usdB) > 1 && (
            <div style={{ fontSize: 10, color: '#eab308', marginTop: 6 }}>
              ⚠ Imbalance: ${Math.abs(usdA - usdB).toFixed(2)} — auto-balance will fix on next Start
            </div>
          )}
        </div>

        {/* Per-account cards */}
        {[
          {
            label: 'A (Long)',
            role: `Buys ${base} with ${quote}`,
            addr: addrA,
            bal: balA,
            usd: usdA,
            color: '#4da2ff',
            bmId: bmIdA,
            mmId: mmIdA,
            allMm: allMMs[addrA ?? ''] ?? [],
          },
          {
            label: 'B (Short)',
            role: `Sells ${base} for ${quote}`,
            addr: addrB,
            bal: balB,
            usd: usdB,
            color: '#a78bfa',
            bmId: bmIdB,
            mmId: mmIdB,
            allMm: allMMs[addrB ?? ''] ?? [],
          },
        ]
          .filter((acct) => !!acct.addr)
          .map((acct) => (
            <div
              key={acct.label}
              className="sui-hb__card"
              style={{ marginBottom: 12, borderLeft: `3px solid ${acct.color}` }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <div>
                  <div className="sui-hb__card-title" style={{ margin: 0 }}>
                    {acct.label}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{acct.role}</div>
                </div>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: acct.color,
                    fontFamily: "'Fira Code', monospace",
                  }}
                >
                  {formatUsd(acct.usd)}
                </span>
              </div>

              {/* Address */}
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "'Fira Code', monospace",
                  color: '#94a3b8',
                  wordBreak: 'break-all',
                  marginBottom: 6,
                  background: '#020617',
                  padding: '4px 8px',
                  borderRadius: 4,
                }}
              >
                {acct.addr}
              </div>

              {/* Balance Manager */}
              {acct.bmId && (
                <div style={{ fontSize: 9, color: '#475569', marginBottom: 6 }}>
                  Balance Manager:{' '}
                  <span style={{ fontFamily: "'Fira Code', monospace" }}>
                    {acct.bmId.slice(0, 16)}...
                  </span>
                </div>
              )}

              {/* Margin Managers — all owned by this wallet */}
              {acct.allMm.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 600, marginBottom: 4 }}>
                    Margin Managers ({acct.allMm.length})
                  </div>
                  {acct.allMm.map((mm) => {
                    const isActive = mm.id === acct.mmId
                    const hasAssets = mm.base > 0 || mm.quote > 0
                    const hasDebt = mm.baseDebt > 0 || mm.quoteDebt > 0
                    return (
                      <div
                        key={mm.id}
                        style={{
                          background: isActive ? '#0a1628' : '#020617',
                          borderRadius: 4,
                          padding: '4px 8px',
                          marginBottom: 4,
                          fontSize: 10,
                          borderLeft: isActive ? '2px solid #22c55e' : '2px solid #1e293b',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'Fira Code', monospace",
                              color: isActive ? '#22c55e' : '#64748b',
                            }}
                          >
                            {mm.id.slice(0, 14)}…
                            {isActive && (
                              <span style={{ color: '#22c55e', fontSize: 8, marginLeft: 4 }}>
                                ACTIVE
                              </span>
                            )}
                          </span>
                          <button
                            style={{
                              fontSize: 8,
                              background: 'none',
                              border: '1px solid #334155',
                              color: '#64748b',
                              borderRadius: 3,
                              padding: '1px 4px',
                              cursor: 'pointer',
                            }}
                            onClick={() => navigator.clipboard.writeText(mm.id)}
                          >
                            copy
                          </button>
                        </div>
                        {(hasAssets || hasDebt) && (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: 2,
                              marginTop: 3,
                              fontSize: 9,
                            }}
                          >
                            {mm.base > 0 && (
                              <div>
                                <span style={{ color: '#64748b' }}>{base}:</span>{' '}
                                <span
                                  style={{ color: '#f8fafc', fontFamily: "'Fira Code', monospace" }}
                                >
                                  {mm.base.toFixed(4)}
                                </span>
                              </div>
                            )}
                            {mm.quote > 0 && (
                              <div>
                                <span style={{ color: '#64748b' }}>{quote}:</span>{' '}
                                <span
                                  style={{ color: '#f8fafc', fontFamily: "'Fira Code', monospace" }}
                                >
                                  {mm.quote.toFixed(4)}
                                </span>
                              </div>
                            )}
                            {mm.baseDebt > 0 && (
                              <div>
                                <span style={{ color: '#ef4444' }}>{base} debt:</span>{' '}
                                <span
                                  style={{ color: '#ef4444', fontFamily: "'Fira Code', monospace" }}
                                >
                                  {mm.baseDebt.toFixed(4)}
                                </span>
                              </div>
                            )}
                            {mm.quoteDebt > 0 && (
                              <div>
                                <span style={{ color: '#ef4444' }}>{quote} debt:</span>{' '}
                                <span
                                  style={{ color: '#ef4444', fontFamily: "'Fira Code', monospace" }}
                                >
                                  {mm.quoteDebt.toFixed(4)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        {!hasAssets && !hasDebt && (
                          <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>empty</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {acct.mmId && !acct.allMm.length && (
                <div style={{ fontSize: 9, color: '#22c55e', marginBottom: 6 }}>
                  Margin Manager:{' '}
                  <span style={{ fontFamily: "'Fira Code', monospace" }}>
                    {acct.mmId.slice(0, 16)}...
                  </span>
                </div>
              )}
              {acct.mmId && !acct.allMm.length && (
                <div style={{ fontSize: 9, color: '#64748b' }}>Loading MMs…</div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <a
                  href={`https://suiscan.xyz/${network}/account/${acct.addr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                  style={{ textDecoration: 'none', textAlign: 'center', flex: 1 }}
                >
                  Suiscan
                </a>
                <button
                  className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                  style={{ flex: 1 }}
                  onClick={() => navigator.clipboard.writeText(acct.addr!)}
                >
                  Copy
                </button>
              </div>

              {/* Coin balances */}
              {acct.bal.loading ? (
                <div style={{ fontSize: 11, color: '#64748b' }}>Loading…</div>
              ) : acct.bal.coins.length > 0 ? (
                <div>
                  {acct.bal.coins.map((c, j) => {
                    const amt = parseFloat(c.balance)
                    let coinUsd = 0
                    if (c.symbol === 'SUI') coinUsd = amt * (suiUsd ?? 0.95)
                    else if (c.symbol === 'USDC' || c.symbol === 'USDT') coinUsd = amt
                    else if (c.symbol === 'DEEP') coinUsd = amt * 0.029
                    else if (c.symbol === 'WAL') coinUsd = amt * 0.07
                    const isPoolToken = c.symbol === base || c.symbol === quote
                    return (
                      <div
                        key={j}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '4px 0',
                          borderBottom: '1px solid #1e293b',
                          fontSize: 12,
                          background: isPoolToken ? 'rgba(34,197,94,0.04)' : undefined,
                        }}
                      >
                        <span style={{ color: isPoolToken ? '#22c55e' : '#94a3b8' }}>
                          {isPoolToken ? '● ' : ''}
                          {c.symbol}
                        </span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: '#f8fafc', fontFamily: "'Fira Code', monospace" }}>
                            {c.balance}
                          </span>
                          {coinUsd > 0.01 && (
                            <span style={{ color: '#64748b', fontSize: 10, marginLeft: 6 }}>
                              ≈{formatUsd(coinUsd)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#475569' }}>No tokens</div>
              )}

              {/* Pending Orders */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>
                  Open Orders{' '}
                  {(pendingOrders[acct.addr!] ?? []).length > 0
                    ? `(${(pendingOrders[acct.addr!] ?? []).length})`
                    : ''}
                </div>
                {(pendingOrders[acct.addr!] ?? []).length > 0 ? (
                  (pendingOrders[acct.addr!] ?? []).map((o) => (
                    <div
                      key={o.orderId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 10,
                        padding: '2px 0',
                        borderBottom: '1px solid #0f172a',
                      }}
                    >
                      <span
                        style={{ color: o.side === 'buy' ? '#22c55e' : '#ef4444', fontWeight: 600 }}
                      >
                        {o.side.toUpperCase()}
                      </span>
                      <span style={{ color: '#94a3b8', fontFamily: "'Fira Code', monospace" }}>
                        {o.price.toFixed(6)}
                      </span>
                      <span style={{ color: '#64748b' }}>
                        {o.filled}/{o.qty}
                      </span>
                      {'pool' in o && (
                        <span style={{ color: '#475569', fontSize: 9 }}>
                          {(o as { pool: string }).pool}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 9, color: '#475569' }}>
                    {config.strategy === 'maker'
                      ? 'No open orders'
                      : 'Market swaps — no pending orders'}
                    {!bmIdA && !bmIdB && config.strategy !== 'maker' ? ' (no Balance Manager)' : ''}
                  </div>
                )}
              </div>

              {/* Recent Transactions */}
              {(txHistory[acct.addr!] ?? []).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>
                    Recent Transactions
                  </div>
                  {(txHistory[acct.addr!] ?? []).slice(0, 8).map((t) => (
                    <div
                      key={t.digest}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 10,
                        padding: '2px 0',
                        borderBottom: '1px solid #0f172a',
                      }}
                    >
                      <a
                        href={`https://suiscan.xyz/${network}/tx/${t.digest}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#4da2ff',
                          textDecoration: 'none',
                          fontFamily: "'Fira Code', monospace",
                        }}
                      >
                        {t.digest.slice(0, 12)}...
                      </a>
                      <span style={{ color: '#64748b' }}>{t.ts}</span>
                      <span style={{ color: t.status === 'success' ? '#22c55e' : '#ef4444' }}>
                        {t.status === 'success' ? '✓' : '✗'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button
            className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
            style={{ flex: 1 }}
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
            Refresh
          </button>
          {(mmIdA || mmIdB) && (
            <button
              className="sui-hb__btn sui-hb__btn--sm"
              style={{ flex: 1, background: '#dc2626', color: '#fff' }}
              disabled={running}
              onClick={handleForceCloseMargins}
            >
              Force Close Margins
            </button>
          )}
          <button
            className="sui-hb__btn sui-hb__btn--yellow sui-hb__btn--sm"
            style={{ flex: 1 }}
            disabled={running}
            onClick={handleSwapAllToSui}
          >
            Swap All → SUI
          </button>
        </div>

        {/* Balance Manager Controls */}
        {(bmIdA || bmIdB) && (
          <div className="sui-hb__card" style={{ marginTop: 12 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <div className="sui-hb__card-title" style={{ margin: 0 }}>
                Balance Managers (On-Chain)
              </div>
              <button
                className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                onClick={fetchMgrBals}
                disabled={mgrBalsLoading}
              >
                {mgrBalsLoading ? '...' : 'Refresh'}
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 10 }}>
              Funds locked in managers until withdrawn. Bot crash → Withdraw All to recover.
            </div>
            {bmIdA && addrA ? (
              <BalanceManagerCard
                label="A (Long)"
                role={`Holds ${quote} to buy ${base}`}
                bmId={bmIdA}
                hasKey={!!addrA}
                color="#4da2ff"
                network={network}
                running={running}
                mgrBals={mgrBals}
                mgrBalsLoading={mgrBalsLoading}
                onWithdraw={withdrawManagerA}
                onReset={resetManagerA}
              />
            ) : null}
            {bmIdB && addrB ? (
              <BalanceManagerCard
                label="B (Short)"
                role={`Holds ${base} to sell`}
                bmId={bmIdB}
                hasKey={!!addrB}
                color="#a78bfa"
                network={network}
                running={running}
                mgrBals={mgrBals}
                mgrBalsLoading={mgrBalsLoading}
                onWithdraw={withdrawManagerB}
                onReset={resetManagerB}
              />
            ) : null}
          </div>
        )}
      </>
    )
  }, [
    currentPrice,
    config,
    balA,
    balB,
    addrA,
    addrB,
    bmIdA,
    bmIdB,
    mmIdA,
    mmIdB,
    allMMs,
    pendingOrders,
    txHistory,
    network,
    running,
    mgrBals,
    mgrBalsLoading,
    handleForceCloseMargins,
    handleSwapAllToSui,
    fetchMgrBals,
    fetchBalance,
    setBalA,
    setBalB,
    withdrawManagerA,
    withdrawManagerB,
    resetManagerA,
    resetManagerB,
  ])

  return (
    <div className="sui-hb">
      <div className="sui-hb__header">
        <h3 className="sui-hb__title">DeepBook Hedging Bot</h3>
        <p className="sui-hb__desc">Client-side hedging bot — runs entirely in your browser</p>
      </div>

      {/* Tabs */}
      <div className="sui-hb__tabs">
        {(['setup', 'dashboard', 'accounts'] as const).map((t) => (
          <button
            key={t}
            className={`sui-hb__tab ${tab === t ? 'sui-hb__tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {{ setup: 'Setup', dashboard: 'Dashboard', accounts: 'Accounts' }[t]}
          </button>
        ))}
      </div>

      {error && <div className="sui-hb__error">{error}</div>}

      {/* 2-column layout: orderbook left, content right */}
      <div className="sui-hb__layout">
        {/* ── LEFT: Mini Orderbook + Funding + Points ── */}
        <Sidebar
          config={config}
          obBids={obBids}
          obAsks={obAsks}
          orderPrices={orderPrices}
          addrA={addrA}
          addrB={addrB}
          balA={balA}
          balB={balB}
        />

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
                    <span className="sui-hb__config-label">Strategy</span>
                    <select
                      className="sui-hb__select"
                      value={config.strategy}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          strategy: e.target.value as BotConfig['strategy'],
                        }))
                      }
                      disabled={running}
                    >
                      <option value="margin">
                        Margin (2 wallets, borrow+POST_ONLY, max points)
                      </option>
                      <option value="directional">
                        Directional (2 wallets, trend-follow, +PnL)
                      </option>
                      <option value="volume">Volume Farm (1 wallet, buy+sell, points)</option>
                      <option value="maker">Maker (2 wallets, POST_ONLY, +spread)</option>
                      <option value="taker">Taker (2 wallets, market swap, neutral)</option>
                    </select>
                  </div>
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
                      onChange={(e) => setPoolShared(e.target.value)}
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

              {/* Webhook for remote log tracking */}
              <div className="sui-hb__card">
                <div className="sui-hb__card-title">Remote Log Tracking</div>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
                  Push logs to Supabase, Discord, Grafana Loki, or any HTTP endpoint.
                </div>
                <input
                  className="sui-hb__input"
                  type="url"
                  placeholder="https://xxxxx.supabase.co or Discord/Loki URL"
                  value={webhookUrl}
                  onChange={(e) => {
                    setWebhookUrl(e.target.value)
                    try {
                      localStorage.setItem('hb_webhook', e.target.value)
                    } catch {}
                  }}
                  style={{ width: '100%', marginBottom: 6 }}
                />
                {webhookUrl && detectLogServiceType(webhookUrl) === 'supabase' && (
                  <input
                    className="sui-hb__input"
                    type="password"
                    placeholder="Supabase anon key (eyJhbGci...)"
                    value={webhookApiKey}
                    onChange={(e) => {
                      setWebhookApiKey(e.target.value)
                      try {
                        localStorage.setItem('hb_webhook_key', e.target.value)
                      } catch {}
                    }}
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                )}
                {webhookUrl && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 9,
                        color: '#22c55e',
                        background: '#0a1628',
                        padding: '2px 6px',
                        borderRadius: 3,
                      }}
                    >
                      {detectLogServiceType(webhookUrl).toUpperCase()}
                    </span>
                    <button
                      className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                      onClick={async () => {
                        const ok = await testLogEndpoint({
                          url: webhookUrl,
                          type: detectLogServiceType(webhookUrl),
                          apiKey: webhookApiKey || undefined,
                          labels: { job: 'hedging-bot', pool: config.pool },
                        })
                        addLog(
                          ok ? 'success' : 'error',
                          ok ? 'Log endpoint test sent!' : 'Log endpoint test failed',
                        )
                      }}
                    >
                      Test
                    </button>
                    <button
                      className="sui-hb__btn sui-hb__btn--ghost sui-hb__btn--sm"
                      onClick={() => {
                        setWebhookUrl('')
                        setWebhookApiKey('')
                        try {
                          localStorage.removeItem('hb_webhook')
                          localStorage.removeItem('hb_webhook_key')
                        } catch {}
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
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
                        onClick={() => !running && setPoolShared(m.pool)}
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

              {/* History */}
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
                        <span
                          style={{ color: c.pnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}
                        >
                          {c.pnl >= 0 ? '+' : ''}
                          {formatUsd(c.pnl)}
                        </span>
                        <span style={{ color: '#64748b' }}>{c.duration}s</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Logs */}
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
                        <span className={`sui-hb__log-msg sui-hb__log-msg--${l.level}`}>
                          {l.msg}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── ACCOUNTS TAB ── */}
          {tab === 'accounts' && (
            <>
              {!addrA && !addrB ? (
                <div className="sui-hb__empty">Import keys in Setup tab first</div>
              ) : (
                accountsTabPanel
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

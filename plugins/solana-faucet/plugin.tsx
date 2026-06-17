// Solana Faucet Plugin — request SOL airdrop on devnet/testnet
// Includes web cron-job: auto-airdrop on both networks at a configurable interval

import type { Plugin, HostAPI } from '../../src/plugins/types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useCallback, useRef, useEffect } from 'react'
import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js'
import type { SolanaWalletProfile } from '../solana-wallet-profile/types'
import './style.css'

let sharedHost: SuiHostAPI | null = null

type FaucetNetwork = 'devnet' | 'testnet'
const AMOUNTS = [0.5, 1, 2]
const INTERVAL_OPTIONS = [
  { label: '1 min', ms: 60_000 },
  { label: '5 min', ms: 300_000 },
  { label: '15 min', ms: 900_000 },
  { label: '30 min', ms: 1_800_000 },
  { label: '1 hour', ms: 3_600_000 },
]

const STORAGE_KEY = 'solana_dev_wallets'

interface StoredWallet {
  address: string
  publicKey: string
  secretKey: string
  mnemonic: string | null
  createdAt: number
}

function loadStoredWallets(): StoredWallet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function shortenAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

interface CronLog {
  time: number
  network: FaucetNetwork
  status: 'success' | 'error'
  msg: string
  sig?: string
}

async function requestAirdrop(
  addr: string,
  network: FaucetNetwork,
  amount: number,
): Promise<{ ok: boolean; sig?: string; error?: string; rateLimited?: boolean }> {
  try {
    const conn = new Connection(clusterApiUrl(network), 'confirmed')
    const pubkey = new PublicKey(addr)
    const sig = await conn.requestAirdrop(pubkey, amount * LAMPORTS_PER_SOL)
    await conn.confirmTransaction(sig, 'confirmed')
    return { ok: true, sig }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Airdrop failed'
    if (msg.includes('429') || msg.includes('limit') || msg.includes('run dry')) {
      return { ok: false, error: 'Rate limited (429). Daily limit reached.', rateLimited: true }
    }
    return { ok: false, error: msg }
  }
}

/** Request from Solana web faucet (same API that faucet.solana.com uses) */
async function requestFromWebFaucet(
  addr: string,
  network: FaucetNetwork,
): Promise<{ ok: boolean; sig?: string; error?: string }> {
  const faucetUrl =
    network === 'devnet'
      ? 'https://faucet.solana.com/api/request-airdrop'
      : 'https://faucet.solana.com/api/request-airdrop'

  try {
    const resp = await fetch(faucetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: addr, network }),
    })

    if (resp.status === 429) {
      return { ok: false, error: 'Web faucet rate limited' }
    }

    if (!resp.ok) {
      return { ok: false, error: `Faucet HTTP ${resp.status}` }
    }

    const data = await resp.json()
    if (data.signature) return { ok: true, sig: data.signature }
    if (data.error) return { ok: false, error: data.error }
    return { ok: true, sig: data.txid || data.tx || undefined }
  } catch {
    // Web faucet unreachable, let caller fallback
    return { ok: false, error: 'Web faucet unavailable' }
  }
}

function SolanaFaucetContent() {
  const [network, setNetwork] = useState<FaucetNetwork>('devnet')
  const [address, setAddress] = useState('')
  const [amount, setAmount] = useState(1)
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'loading'
    msg: string
  } | null>(null)
  const [txSig, setTxSig] = useState<string | null>(null)

  // Cron state
  const [cronEnabled, setCronEnabled] = useState(false)
  const [cronInterval, setCronInterval] = useState(300_000) // 5 min default
  const [cronAmount, setCronAmount] = useState(1)
  const [cronLogs, setCronLogs] = useState<CronLog[]>([])
  const [nextRun, setNextRun] = useState<number | null>(null)
  const cronRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stored wallets
  const [storedWallets, setStoredWallets] = useState<StoredWallet[]>(loadStoredWallets)
  const [showPicker, setShowPicker] = useState(false)

  // Refresh stored wallets
  useEffect(() => {
    const id = setInterval(() => setStoredWallets(loadStoredWallets()), 3000)
    return () => clearInterval(id)
  }, [])

  const walletAddress = (() => {
    if (!sharedHost) return null
    const profile = sharedHost.getSharedData('solanaWalletProfile') as SolanaWalletProfile | null
    return profile?.address ?? null
  })()

  const effectiveAddress = address || walletAddress || ''

  // Manual airdrop
  const handleAirdrop = useCallback(async () => {
    if (!effectiveAddress) {
      setStatus({ type: 'error', msg: 'Enter a wallet address or connect wallet first' })
      return
    }
    setStatus({ type: 'loading', msg: `Requesting ${amount} SOL airdrop...` })
    setTxSig(null)

    // Try web faucet first, then RPC
    let result = await requestFromWebFaucet(effectiveAddress, network)
    if (!result.ok) {
      result = await requestAirdrop(effectiveAddress, network, amount)
    }

    if (result.ok) {
      setTxSig(result.sig ?? null)
      setStatus({ type: 'success', msg: `Airdrop successful: ${amount} SOL` })
    } else if ('rateLimited' in result && result.rateLimited) {
      setStatus({ type: 'error', msg: '429 Rate limited. See alternatives below.' })
    } else {
      setStatus({ type: 'error', msg: result.error! })
    }
  }, [effectiveAddress, amount, network])

  // Cron job logic
  const runCronCycle = useCallback(async () => {
    if (!effectiveAddress) return

    const networks: FaucetNetwork[] = ['devnet', 'testnet']
    const results = await Promise.allSettled(
      networks.map((net) => requestAirdrop(effectiveAddress, net, cronAmount)),
    )

    const newLogs: CronLog[] = results.map((r, i) => {
      const net = networks[i]
      if (r.status === 'fulfilled' && r.value.ok) {
        return {
          time: Date.now(),
          network: net,
          status: 'success' as const,
          msg: `${cronAmount} SOL`,
          sig: r.value.sig,
        }
      }
      const errMsg = r.status === 'fulfilled' ? r.value.error! : 'Network error'
      return { time: Date.now(), network: net, status: 'error' as const, msg: errMsg }
    })

    setCronLogs((prev) => [...newLogs, ...prev].slice(0, 50))
  }, [effectiveAddress, cronAmount])

  // Start/stop cron
  const toggleCron = useCallback(() => {
    if (cronEnabled) {
      // Stop
      if (cronRef.current) clearInterval(cronRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
      cronRef.current = null
      countdownRef.current = null
      setCronEnabled(false)
      setNextRun(null)
    } else {
      // Start
      if (!effectiveAddress) {
        setStatus({ type: 'error', msg: 'Set a wallet address before starting auto-faucet' })
        return
      }
      setCronEnabled(true)
      setNextRun(Date.now() + cronInterval)

      // Run immediately first time
      runCronCycle()

      cronRef.current = setInterval(() => {
        runCronCycle()
        setNextRun(Date.now() + cronInterval)
      }, cronInterval)

      // Countdown refresh every second
      countdownRef.current = setInterval(() => {
        setNextRun((prev) => prev) // force re-render for countdown display
      }, 1000)
    }
  }, [cronEnabled, cronInterval, effectiveAddress, runCronCycle])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cronRef.current) clearInterval(cronRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const explorerUrl = txSig ? `https://explorer.solana.com/tx/${txSig}?cluster=${network}` : null

  const countdown = nextRun ? Math.max(0, Math.ceil((nextRun - Date.now()) / 1000)) : null

  return (
    <div className="sol-faucet">
      <h3 className="sol-faucet__title">Solana Faucet</h3>
      <p className="sol-faucet__desc">Manual airdrop or auto-faucet cron on devnet + testnet</p>

      {/* Network (for manual) */}
      <div className="sol-faucet__network-row">
        {(['devnet', 'testnet'] as FaucetNetwork[]).map((net) => (
          <button
            key={net}
            className={`sol-faucet__net-btn ${net === network ? 'sol-faucet__net-btn--active' : ''}`}
            onClick={() => setNetwork(net)}
          >
            {net}
          </button>
        ))}
        <button className="sol-faucet__net-btn" disabled>
          mainnet-beta
        </button>
      </div>

      <div className="sol-faucet__form">
        <input
          className="sol-faucet__input"
          type="text"
          placeholder={
            walletAddress ? `Connected: ${walletAddress.slice(0, 8)}...` : 'Wallet address (base58)'
          }
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        {/* Stored wallet picker */}
        {storedWallets.length > 0 && (
          <div className="sol-faucet__stored">
            <button
              className="sol-faucet__stored-toggle"
              onClick={() => setShowPicker(!showPicker)}
            >
              {showPicker ? 'Hide' : 'Pick from'} Stored Wallets ({storedWallets.length})
            </button>
            {showPicker && (
              <div className="sol-faucet__stored-list">
                {storedWallets.map((w) => (
                  <button
                    key={w.address}
                    className={`sol-faucet__stored-item ${address === w.address ? 'sol-faucet__stored-item--active' : ''}`}
                    onClick={() => {
                      setAddress(w.address)
                      setShowPicker(false)
                    }}
                  >
                    {shortenAddr(w.address)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="sol-faucet__row">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              className={`sol-faucet__amount-btn ${a === amount ? 'sol-faucet__amount-btn--active' : ''}`}
              onClick={() => setAmount(a)}
            >
              {a} SOL
            </button>
          ))}
        </div>

        <button
          className="sol-faucet__submit"
          onClick={handleAirdrop}
          disabled={status?.type === 'loading'}
        >
          {status?.type === 'loading' ? 'Requesting...' : `Airdrop ${amount} SOL`}
        </button>
      </div>

      {status && (
        <div className={`sol-faucet__status sol-faucet__status--${status.type}`}>
          {status.msg}
          {explorerUrl && (
            <>
              <br />
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="sol-faucet__tx-link"
              >
                View transaction on Explorer
              </a>
            </>
          )}
        </div>
      )}

      {/* Alternatives when rate limited */}
      {status?.type === 'error' && status.msg.includes('429') && (
        <div className="sol-faucet__alternatives">
          <h5 className="sol-faucet__alt-title">Alternative methods:</h5>
          <div className="sol-faucet__alt-item">
            <code>
              solana airdrop 2 {effectiveAddress ? shortenAddr(effectiveAddress) : '<ADDR>'} --url
              devnet
            </code>
          </div>
          <div className="sol-faucet__alt-item">
            <code>devnet-pow mine -d 3 --reward 0.02 --no-infer -t 5000000000</code>
            <span className="sol-faucet__alt-note">No rate limits (PoW faucet)</span>
          </div>
          <div className="sol-faucet__alt-item">
            <code>solana-test-validator</code>
            <span className="sol-faucet__alt-note">Unlimited SOL on local validator</span>
          </div>
          <a
            href="https://solana.com/developers/guides/getstarted/solana-token-airdrop-and-faucets"
            target="_blank"
            rel="noopener noreferrer"
            className="sol-faucet__tx-link"
          >
            Full guide: Solana devnet SOL sources
          </a>
        </div>
      )}

      {/* === Auto Faucet Cron === */}
      <div className="sol-faucet__cron">
        <div className="sol-faucet__cron-header">
          <h4 className="sol-faucet__cron-title">Auto Faucet (Cron)</h4>
          {cronEnabled && (
            <span className="sol-faucet__cron-badge">
              Running {countdown !== null ? `(next: ${countdown}s)` : ''}
            </span>
          )}
        </div>
        <p className="sol-faucet__cron-desc">
          Automatically airdrop on both devnet and testnet at a set interval. Keep this tab open for
          the cron to run. Note: Solana limits ~2 SOL/day per IP. Use longer intervals to avoid 429
          errors.
        </p>

        {/* Interval selector */}
        <div className="sol-faucet__cron-config">
          <label className="sol-faucet__cron-label">Interval:</label>
          <div className="sol-faucet__row">
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.ms}
                className={`sol-faucet__amount-btn ${opt.ms === cronInterval ? 'sol-faucet__amount-btn--active' : ''}`}
                onClick={() => setCronInterval(opt.ms)}
                disabled={cronEnabled}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount for cron */}
        <div className="sol-faucet__cron-config">
          <label className="sol-faucet__cron-label">Amount per airdrop:</label>
          <div className="sol-faucet__row">
            {AMOUNTS.map((a) => (
              <button
                key={a}
                className={`sol-faucet__amount-btn ${a === cronAmount ? 'sol-faucet__amount-btn--active' : ''}`}
                onClick={() => setCronAmount(a)}
                disabled={cronEnabled}
              >
                {a} SOL
              </button>
            ))}
          </div>
        </div>

        {/* Start/Stop */}
        <button
          className={`sol-faucet__submit ${cronEnabled ? 'sol-faucet__submit--stop' : ''}`}
          onClick={toggleCron}
        >
          {cronEnabled ? 'Stop Auto Faucet' : 'Start Auto Faucet'}
        </button>

        {/* Logs */}
        {cronLogs.length > 0 && (
          <div className="sol-faucet__cron-logs">
            <div className="sol-faucet__cron-logs-header">
              <span>Recent ({cronLogs.length})</span>
              <button className="sol-faucet__cron-clear" onClick={() => setCronLogs([])}>
                Clear
              </button>
            </div>
            <div className="sol-faucet__cron-log-list">
              {cronLogs.slice(0, 20).map((log, i) => (
                <div key={i} className={`sol-faucet__cron-log sol-faucet__cron-log--${log.status}`}>
                  <span className="sol-faucet__cron-log-time">
                    {new Date(log.time).toLocaleTimeString()}
                  </span>
                  <span className="sol-faucet__cron-log-net">{log.network}</span>
                  <span className="sol-faucet__cron-log-msg">{log.msg}</span>
                  {log.sig && (
                    <a
                      href={`https://explorer.solana.com/tx/${log.sig}?cluster=${log.network}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sol-faucet__cron-log-link"
                    >
                      tx
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const SolanaFaucetPlugin: Plugin = {
  name: 'SolanaFaucet',
  version: '2.0.0',
  styleUrls: ['plugins/solana-faucet/style.css'],

  init(host: HostAPI) {
    if (isSuiHostAPI(host)) sharedHost = host as SuiHostAPI
    host.registerComponent('SolanaFaucet', SolanaFaucetContent as never)
    host.log('[SolanaFaucet] Plugin initialized (manual + cron)')
  },

  mount() {},

  unmount() {
    sharedHost = null
  },
}

export default SolanaFaucetPlugin

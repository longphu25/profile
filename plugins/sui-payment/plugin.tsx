// SUI Payment Plugin
// Create payment requests with payment links
// Uses @mysten/payment-kit for URI generation
// Reads wallet context from sui-wallet-profile via sharedData

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback } from 'react'
import { createPaymentTransactionUri, parsePaymentTransactionUri } from '@mysten/payment-kit'
import { Transaction } from '@mysten/sui/transactions'
import './style.css'

// Shared key from wallet-profile plugin
const WALLET_PROFILE_KEY = 'walletProfile'

interface WalletProfile {
  address: string
  suinsName: string | null
  network: string
  balances: { coinType: string; symbol: string; balance: string; decimals: number }[]
}

const TOKENS: Record<string, { type: string; decimals: number }> = {
  SUI: { type: '0x2::sui::SUI', decimals: 9 },
  USDC: {
    type: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
    decimals: 6,
  },
}

interface PaymentRecord {
  id: string
  amount: string
  token: string
  memo: string
  uri: string
  status: 'pending' | 'paid' | 'expired'
  createdAt: string
}

let sharedHost: SuiHostAPI | null = null

function shortenAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function PaymentContent() {
  const [tab, setTab] = useState<'create' | 'pay'>('create')
  const [profile, setProfile] = useState<WalletProfile | null>(null)

  // Create form
  const [amount, setAmount] = useState('')
  const [token, setToken] = useState('SUI')
  const [memo, setMemo] = useState('')
  const [generatedUri, setGeneratedUri] = useState<string | null>(null)

  // Pay form
  const [payUri, setPayUri] = useState('')
  const [paying, setPaying] = useState(false)

  // History
  const [history, setHistory] = useState<PaymentRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Read wallet profile from shared data
  useEffect(() => {
    if (!sharedHost) return

    // Initial read
    const data = sharedHost.getSharedData(WALLET_PROFILE_KEY)
    if (data) setProfile(data as WalletProfile)

    // Subscribe to changes
    return sharedHost.onSharedDataChange(WALLET_PROFILE_KEY, (value) => {
      setProfile(value as WalletProfile | null)
    })
  }, [])

  const isConnected = !!profile?.address

  const handleCreate = useCallback(() => {
    if (!profile?.address || !amount) return
    setError(null)
    setSuccess(null)

    try {
      const amountNum = Number(amount)
      if (amountNum <= 0) throw new Error('Amount must be positive')

      const tokenInfo = TOKENS[token]
      const atomicAmount = BigInt(Math.floor(amountNum * 10 ** tokenInfo.decimals))
      const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

      const uri = createPaymentTransactionUri({
        receiverAddress: profile.address,
        amount: atomicAmount,
        coinType: tokenInfo.type,
        nonce,
        label: memo || undefined,
      })

      setGeneratedUri(uri)

      const record: PaymentRecord = {
        id: nonce,
        amount: `${amountNum} ${token}`,
        token,
        memo,
        uri,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      setHistory((prev) => [record, ...prev])
      setSuccess('Payment request created')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [profile?.address, amount, token, memo])

  const handlePay = useCallback(async () => {
    if (!sharedHost || !payUri) return
    setPaying(true)
    setError(null)
    setSuccess(null)

    try {
      const params = parsePaymentTransactionUri(payUri)
      const tx = new Transaction()
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(params.amount)])
      tx.transferObjects([coin], tx.pure.address(params.receiverAddress))

      const result = await sharedHost.signAndExecuteTransaction(tx)
      setSuccess(`Payment sent — tx: ${result.digest.slice(0, 12)}...`)
      setPayUri('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPaying(false)
    }
  }, [payUri])

  const copyUri = async () => {
    if (!generatedUri) return
    await navigator.clipboard.writeText(generatedUri)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="sui-pay">
      <div className="sui-pay__header">
        <h3 className="sui-pay__title">Payment Kit</h3>
        <p className="sui-pay__desc">Create and process payment requests on Sui</p>
      </div>

      {/* Wallet status from wallet-profile */}
      {isConnected ? (
        <div className="sui-pay__wallet-bar">
          <span className="sui-pay__wallet-dot" />
          <span className="sui-pay__wallet-addr">
            {profile!.suinsName ?? shortenAddr(profile!.address)}
          </span>
          <span className="sui-pay__wallet-net">{profile!.network}</span>
        </div>
      ) : (
        <div className="sui-pay__wallet-disconnected">
          <span>⚠ Wallet not connected</span>
          <span className="sui-pay__wallet-hint">
            Load the <strong>Wallet Profile</strong> plugin first
          </span>
          {sharedHost && (
            <button
              className="sui-pay__action sui-pay__action--connect"
              onClick={() => sharedHost!.requestConnect()}
            >
              Connect Wallet
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="sui-pay__tabs">
        <button
          className={`sui-pay__tab ${tab === 'create' ? 'sui-pay__tab--active' : ''}`}
          onClick={() => setTab('create')}
        >
          Create Request
        </button>
        <button
          className={`sui-pay__tab ${tab === 'pay' ? 'sui-pay__tab--active' : ''}`}
          onClick={() => setTab('pay')}
        >
          Pay Request
        </button>
      </div>

      {error && <div className="sui-pay__error">{error}</div>}
      {success && <div className="sui-pay__success">{success}</div>}

      {/* Create tab */}
      {tab === 'create' && (
        <>
          <div className="sui-pay__form">
            <div className="sui-pay__field">
              <label className="sui-pay__label">Amount</label>
              <input
                className="sui-pay__input"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              />
            </div>
            <div className="sui-pay__field">
              <label className="sui-pay__label">Token</label>
              <select
                className="sui-pay__select"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              >
                {Object.keys(TOKENS).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="sui-pay__field">
              <label className="sui-pay__label">Memo (optional)</label>
              <input
                className="sui-pay__input"
                type="text"
                placeholder="Payment for..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>

            <button
              className="sui-pay__action"
              disabled={!isConnected || !amount || Number(amount) <= 0}
              onClick={handleCreate}
            >
              {!isConnected ? 'Connect Wallet First' : 'Create Payment Request'}
            </button>
          </div>

          {generatedUri && (
            <div className="sui-pay__result">
              <div className="sui-pay__result-title">Payment Request Created</div>
              <div className="sui-pay__link-box">{generatedUri}</div>
              <button className="sui-pay__copy-btn" onClick={copyUri}>
                {copied ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Pay tab */}
      {tab === 'pay' && (
        <div className="sui-pay__form">
          <div className="sui-pay__field">
            <label className="sui-pay__label">Payment URI</label>
            <input
              className="sui-pay__input"
              type="text"
              placeholder="sui:0x...?amount=...&coinType=..."
              value={payUri}
              onChange={(e) => setPayUri(e.target.value)}
            />
          </div>

          <button
            className="sui-pay__action"
            disabled={!isConnected || !payUri || paying}
            onClick={handlePay}
          >
            {!isConnected ? 'Connect Wallet First' : paying ? 'Processing...' : 'Pay Now'}
          </button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <>
          <div className="sui-pay__section-title">Recent Requests ({history.length})</div>
          {history.map((r) => (
            <div key={r.id} className="sui-pay__history-row">
              <div>
                <div className="sui-pay__history-amount">{r.amount}</div>
                <div className="sui-pay__history-meta">{r.memo || 'No memo'}</div>
              </div>
              <span className={`sui-pay__history-status sui-pay__history-status--${r.status}`}>
                {r.status}
              </span>
            </div>
          ))}
        </>
      )}

      <div className="sui-pay__footer">
        Powered by{' '}
        <a
          href="https://sdk.mystenlabs.com/payment-kit"
          target="_blank"
          rel="noopener noreferrer"
          className="sui-pay__link"
        >
          @mysten/payment-kit
        </a>
      </div>
    </div>
  )
}

const SuiPaymentPlugin: Plugin = {
  name: 'SuiPayment',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-payment/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiPayment', PaymentContent)
    host.log('SuiPayment initialized' + (sharedHost ? ' (shared)' : ' (standalone)'))
  },

  mount() {
    console.log('[SuiPayment] mounted')
  },
  unmount() {
    sharedHost = null
    console.log('[SuiPayment] unmounted')
  },
}

export default SuiPaymentPlugin

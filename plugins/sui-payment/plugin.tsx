// SUI Payment Plugin
// Create payment requests with QR codes and payment links
// Uses @mysten/payment-kit for URI generation and processing

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useCallback } from 'react'
import { createPaymentTransactionUri, parsePaymentTransactionUri } from '@mysten/payment-kit'
import './style.css'

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

function PaymentContent() {
  const [tab, setTab] = useState<'create' | 'pay'>('create')
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)

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

  useEffect(() => {
    if (!sharedHost) return
    const update = () => {
      const ctx = sharedHost!.getSuiContext()
      setIsConnected(ctx.isConnected)
      setWalletAddress(ctx.address)
    }
    update()
    return sharedHost.onSuiContextChange(update)
  }, [])

  const handleCreate = useCallback(() => {
    if (!walletAddress || !amount) return
    setError(null)
    setSuccess(null)

    try {
      const amountNum = Number(amount)
      if (amountNum <= 0) throw new Error('Amount must be positive')

      const tokenInfo = TOKENS[token]
      const atomicAmount = BigInt(Math.floor(amountNum * 10 ** tokenInfo.decimals))
      const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

      const uri = createPaymentTransactionUri({
        receiverAddress: walletAddress,
        amount: atomicAmount,
        coinType: tokenInfo.type,
        nonce,
        label: memo || undefined,
      })

      setGeneratedUri(uri)

      const record: PaymentRecord = {
        id: Date.now().toString(),
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
  }, [walletAddress, amount, token, memo])

  const handlePay = useCallback(async () => {
    if (!sharedHost || !payUri) return
    setPaying(true)
    setError(null)
    setSuccess(null)

    try {
      const params = parsePaymentTransactionUri(payUri)
      // Build transfer transaction from parsed params
      const { Transaction } = await import('@mysten/sui/transactions')
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

            {!isConnected && sharedHost ? (
              <button
                className="sui-pay__action sui-pay__action--connect"
                onClick={() => sharedHost!.requestConnect()}
              >
                Connect Wallet
              </button>
            ) : (
              <button
                className="sui-pay__action"
                disabled={!amount || Number(amount) <= 0}
                onClick={handleCreate}
              >
                Create Payment Request
              </button>
            )}
          </div>

          {/* Generated URI */}
          {generatedUri && (
            <div className="sui-pay__result">
              <div className="sui-pay__result-title">Payment Request Created</div>
              <div className="sui-pay__link-box">{generatedUri.slice(0, 80)}...</div>
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
              placeholder="sui-payment://..."
              value={payUri}
              onChange={(e) => setPayUri(e.target.value)}
            />
          </div>

          {!isConnected && sharedHost ? (
            <button
              className="sui-pay__action sui-pay__action--connect"
              onClick={() => sharedHost!.requestConnect()}
            >
              Connect Wallet
            </button>
          ) : (
            <button className="sui-pay__action" disabled={!payUri || paying} onClick={handlePay}>
              {paying ? 'Processing...' : 'Pay Now'}
            </button>
          )}
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

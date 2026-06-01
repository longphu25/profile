import { useCallback, useEffect, useState } from 'react'
import { Transaction } from '@mysten/sui/transactions'
import { PREDICT_PACKAGE, PREDICT_ID, DUSDC_TYPE, DUSDC_DECIMALS } from '../domain/constants'
import { CollapsibleNotes } from './shared'
import type { SuiHostAPI } from '../../../src/sui-dashboard/sui-types'

export function VaultPanel({
  walletAddress,
  vaultData,
  host,
}: {
  walletAddress: string
  vaultData: any
  host: SuiHostAPI
}) {
  const [action, setAction] = useState<'supply' | 'withdraw'>('supply')
  const [amount, setAmount] = useState('')
  const [txDigest, setTxDigest] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [balance, setBalance] = useState<number>(0)

  const PLP_TYPE = `${PREDICT_PACKAGE}::plp::PLP`

  const fetchBalance = useCallback(async () => {
    const coinType = action === 'supply' ? DUSDC_TYPE : PLP_TYPE
    try {
      const res = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getBalance',
          params: [walletAddress, coinType],
        }),
      })
      const data = (await res.json()) as { result?: { totalBalance: string } }
      const raw = parseInt(data.result?.totalBalance || '0', 10)
      setBalance(raw / 10 ** DUSDC_DECIMALS)
    } catch {
      setBalance(0)
    }
  }, [walletAddress, action])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  const handleSubmit = async () => {
    if (!amount) return
    setSubmitting(true)
    setTxError(null)
    setTxDigest(null)

    try {
      const tx = new Transaction()
      tx.setSender(walletAddress)
      const amountRaw = Math.floor(Number(amount) * 10 ** DUSDC_DECIMALS)

      if (action === 'supply') {
        const coinsRes = await fetch('https://fullnode.testnet.sui.io:443', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'suix_getCoins',
            params: [walletAddress, DUSDC_TYPE, null, 50],
          }),
        })
        const coinsData = (await coinsRes.json()) as {
          result?: { data: { coinObjectId: string; balance: string }[] }
        }
        const dusdc_coins = coinsData.result?.data || []
        if (dusdc_coins.length === 0) {
          setTxError('No DUSDC coins found in wallet.')
          setSubmitting(false)
          return
        }

        const primaryCoin = dusdc_coins[0].coinObjectId
        if (dusdc_coins.length > 1) {
          tx.mergeCoins(
            tx.object(primaryCoin),
            dusdc_coins.slice(1).map((c) => tx.object(c.coinObjectId)),
          )
        }
        const [supplyCoin] = tx.splitCoins(tx.object(primaryCoin), [tx.pure.u64(amountRaw)])

        const [plpCoin] = tx.moveCall({
          target: `${PREDICT_PACKAGE}::predict::supply`,
          typeArguments: [DUSDC_TYPE],
          arguments: [tx.object(PREDICT_ID), supplyCoin, tx.object.clock()],
        })
        tx.transferObjects([plpCoin], tx.pure.address(walletAddress))
      } else {
        const coinsRes = await fetch('https://fullnode.testnet.sui.io:443', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'suix_getCoins',
            params: [walletAddress, PLP_TYPE, null, 50],
          }),
        })
        const coinsData = (await coinsRes.json()) as {
          result?: { data: { coinObjectId: string; balance: string }[] }
        }
        const plp_coins = coinsData.result?.data || []
        if (plp_coins.length === 0) {
          setTxError('No PLP coins found in wallet.')
          setSubmitting(false)
          return
        }

        const primaryCoin = plp_coins[0].coinObjectId
        if (plp_coins.length > 1) {
          tx.mergeCoins(
            tx.object(primaryCoin),
            plp_coins.slice(1).map((c) => tx.object(c.coinObjectId)),
          )
        }
        const [withdrawCoin] = tx.splitCoins(tx.object(primaryCoin), [tx.pure.u64(amountRaw)])

        const [dusdcCoin] = tx.moveCall({
          target: `${PREDICT_PACKAGE}::predict::withdraw`,
          typeArguments: [DUSDC_TYPE],
          arguments: [tx.object(PREDICT_ID), withdrawCoin, tx.object.clock()],
        })
        tx.transferObjects([dusdcCoin], tx.pure.address(walletAddress))
      }

      const result = await host.signAndExecuteTransaction(tx)
      setTxDigest(result.digest)
      host.setSharedData('txRefresh', Date.now())
      fetchBalance()
    } catch (e) {
      setTxError(e instanceof Error ? e.message : String(e))
    }
    setSubmitting(false)
  }

  const estimatedShares =
    vaultData && Number(amount) > 0
      ? ((Number(amount) * vaultData.plp_total_supply) / (vaultData.vault_value / 1e6)).toFixed(2)
      : null

  return (
    <div className="sui-predict__card sui-predict__card--wide">
      <div className="sui-predict__card-header">
        <h3 className="sui-predict__card-title">
          {action === 'supply' ? 'Supply Liquidity' : 'Withdraw Liquidity'}
        </h3>
      </div>
      <div className="sui-predict__toggle-row">
        <div className="sui-predict__toggle">
          <button
            type="button"
            className={`sui-predict__toggle-btn ${action === 'supply' ? 'sui-predict__toggle-btn--active' : ''}`}
            onClick={() => setAction('supply')}
          >
            Supply
          </button>
          <button
            type="button"
            className={`sui-predict__toggle-btn ${action === 'withdraw' ? 'sui-predict__toggle-btn--active' : ''}`}
            onClick={() => setAction('withdraw')}
          >
            Withdraw
          </button>
        </div>
      </div>
      <div className="sui-predict__form">
        <div className="sui-predict__field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="sui-predict__field-label">
              {action === 'supply' ? 'DUSDC Amount' : 'PLP Amount'}
            </label>
            <span style={{ fontSize: '10px', color: '#9fb9b1' }}>
              Balance: {balance > 0 ? parseFloat(balance.toFixed(4)).toString() : '0'}
            </span>
          </div>
          <input
            className="sui-predict__input"
            type="number"
            placeholder="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
            {[5, 10, 50, 100].map((pct) => (
              <button
                type="button"
                key={pct}
                className="sui-predict__btn sui-predict__btn--ghost sui-predict__btn--sm"
                onClick={() => setAmount(parseFloat(((balance * pct) / 100).toFixed(4)).toString())}
                disabled={balance <= 0}
              >
                {pct === 100 ? 'Max' : `${pct}%`}
              </button>
            ))}
          </div>
        </div>
        {action === 'supply' && estimatedShares && (
          <div className="sui-predict__trade-info">
            <span>≈ {estimatedShares} PLP shares</span>
            <span>Share price: {vaultData.plp_share_price?.toFixed(6)}</span>
          </div>
        )}
        <button
          type="button"
          className="sui-predict__btn sui-predict__btn--full"
          onClick={handleSubmit}
          disabled={submitting || !amount}
        >
          {submitting
            ? 'Submitting…'
            : action === 'supply'
              ? 'Supply DUSDC → PLP'
              : 'Burn PLP → DUSDC'}
        </button>
      </div>
      {txDigest && <div className="sui-predict__success">TX: {txDigest.slice(0, 16)}…</div>}
      {txError && <div className="sui-predict__error">{txError}</div>}
      <CollapsibleNotes title="How Supply/Withdraw works">
        <p>
          <strong>Supply:</strong> Deposit DUSDC → receive PLP shares. First supplier gets 1:1,
          later suppliers proportional to vault value.
        </p>
        <p>
          <strong>Withdraw:</strong> Burn PLP → receive DUSDC. Subject to available liquidity after
          max payout coverage.
        </p>
      </CollapsibleNotes>
    </div>
  )
}

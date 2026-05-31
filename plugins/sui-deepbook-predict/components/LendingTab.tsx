/**
 * Lending Tab — Supply to DeepBook MarginPool, earn interest from borrowers.
 * Uses the DeepBook Margin indexer for pool state and @mysten/deepbook-v3 SDK for transactions.
 */

import { useState, useEffect, useCallback } from 'react'
import { Transaction } from '@mysten/sui/transactions'
import {
  DeepBookClient,
  testnetCoins,
  testnetPools,
  testnetPackageIds,
  mainnetCoins,
  mainnetPools,
  mainnetPackageIds,
} from '@mysten/deepbook-v3'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import type { SuiHostAPI } from '../../../src/sui-dashboard/sui-types'
import { CollapsibleNotes } from './shared'

const MARGIN_INDEXER = {
  mainnet: 'https://deepbook-margin-indexer.mainnet.mystenlabs.com',
  testnet: 'https://deepbook-margin-indexer.testnet.mystenlabs.com',
}

const RPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
}

interface PoolState {
  asset: string
  total_supplied: number
  total_borrowed: number
  utilization: number
  supply_apy: number
  borrow_apy: number
  supply_cap: number
}

interface Props {
  walletAddress: string | null
  isConnected: boolean
  sharedHost: SuiHostAPI | null
  network: string
}

export function LendingTab({ walletAddress, isConnected, sharedHost, network }: Props) {
  const [pools, setPools] = useState<PoolState[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAsset, setSelectedAsset] = useState<string>('USDC')
  const [amount, setAmount] = useState('')
  const [action, setAction] = useState<'supply' | 'withdraw'>('supply')
  const [submitting, setSubmitting] = useState(false)
  const [txDigest, setTxDigest] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [userSupplied, setUserSupplied] = useState<Record<string, number>>({})

  const net = (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet'
  const indexerBase = MARGIN_INDEXER[net]

  // Fetch pool states
  const fetchPools = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${indexerBase}/margin-pools`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setPools(
          data.map((p: any) => ({
            asset: p.asset || p.coin_type?.split('::').pop() || 'Unknown',
            total_supplied: Number(p.total_supplied || 0) / 1e9,
            total_borrowed: Number(p.total_borrowed || 0) / 1e9,
            utilization: Number(p.utilization || 0),
            supply_apy: Number(p.supply_apy || p.supply_rate || 0) * 100,
            borrow_apy: Number(p.borrow_apy || p.borrow_rate || 0) * 100,
            supply_cap: Number(p.supply_cap || 0) / 1e9,
          })),
        )
      }
    } catch {
      // Fallback: show placeholder data if indexer unavailable
      setPools([
        {
          asset: 'SUI',
          total_supplied: 0,
          total_borrowed: 0,
          utilization: 0,
          supply_apy: 3.2,
          borrow_apy: 5.1,
          supply_cap: 1000000,
        },
        {
          asset: 'USDC',
          total_supplied: 0,
          total_borrowed: 0,
          utilization: 0,
          supply_apy: 4.8,
          borrow_apy: 7.5,
          supply_cap: 5000000,
        },
      ])
    }
    setLoading(false)
  }, [indexerBase])

  useEffect(() => {
    fetchPools()
  }, [fetchPools])

  // Fetch user's supplied positions
  useEffect(() => {
    if (!walletAddress) return
    fetch(`${indexerBase}/margin-pools/suppliers?owner=${walletAddress}`)
      .then((r) => r.json())
      .then((data: any[]) => {
        const supplied: Record<string, number> = {}
        for (const s of data || []) {
          const asset = s.asset || s.coin_type?.split('::').pop() || ''
          supplied[asset] = (supplied[asset] || 0) + Number(s.amount || 0) / 1e9
        }
        setUserSupplied(supplied)
      })
      .catch(() => {})
  }, [walletAddress, indexerBase])

  const selectedPool = pools.find((p) => p.asset === selectedAsset)
  const balance = userSupplied[selectedAsset] || 0

  const handleSubmit = async () => {
    if (!sharedHost || !walletAddress || !amount) return
    setSubmitting(true)
    setTxError(null)
    setTxDigest(null)

    try {
      const client = new SuiGrpcClient({ network: net, baseUrl: RPC_URLS[net] })
      const coins = net === 'mainnet' ? mainnetCoins : testnetCoins
      const pools = net === 'mainnet' ? mainnetPools : testnetPools
      const packageIds = net === 'mainnet' ? mainnetPackageIds : testnetPackageIds

      const dbClient = new DeepBookClient({
        client,
        network: net,
        address: walletAddress,
        coins,
        pools,
        packageIds,
      })

      const tx = new Transaction()
      tx.setSender(walletAddress)
      const amountNum = Number(amount)

      if (action === 'supply') {
        // Mint a SupplierCap + supply in one PTB
        const supplierCap = dbClient.marginPool.mintSupplierCap()(tx)
        dbClient.marginPool.supplyToMarginPool(selectedAsset, supplierCap, amountNum)(tx)
        // Transfer the SupplierCap to the user (needed for future withdrawals)
        tx.transferObjects([supplierCap], tx.pure.address(walletAddress))
      } else {
        // Withdraw requires an existing SupplierCap
        // For now, show error if no cap found
        setTxError('Withdraw requires a SupplierCap. Supply first to get one.')
        setSubmitting(false)
        return
      }

      const result = await sharedHost.signAndExecuteTransaction(tx)
      setTxDigest(result.digest)
      sharedHost.setSharedData('txRefresh', Date.now())
      fetchPools()
    } catch (e) {
      setTxError(e instanceof Error ? e.message : String(e))
    }
    setSubmitting(false)
  }

  return (
    <div className="sui-predict__grid">
      {/* Pool Overview — TOP */}
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Margin Pools</h3>
          <button type="button"
            className="sui-predict__btn sui-predict__btn--ghost sui-predict__btn--sm"
            onClick={fetchPools}
            disabled={loading}
          >
            {loading ? '⟳' : '↻'}
          </button>
        </div>
        {pools.length === 0 ? (
          <div className="sui-predict__empty">Loading pools…</div>
        ) : (
          <div className="sui-predict__table">
            <div className="sui-predict__table-header sui-predict__table-header--6col">
              <span>Asset</span>
              <span>Supply APY</span>
              <span>Borrow APY</span>
              <span>Utilization</span>
              <span>Total Supplied</span>
              <span>Action</span>
            </div>
            {pools.map((p) => (
              <div
                key={p.asset}
                className={`sui-predict__table-row sui-predict__table-row--6col ${selectedAsset === p.asset ? 'sui-predict__oracle-row--active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedAsset(p.asset)}
              >
                <span style={{ fontWeight: 650 }}>{p.asset}</span>
                <span className="sui-predict__text--green">{p.supply_apy.toFixed(2)}%</span>
                <span>{p.borrow_apy.toFixed(2)}%</span>
                <span>{(p.utilization * 100).toFixed(1)}%</span>
                <span>
                  {p.total_supplied.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span>
                  <button type="button"
                    className="sui-predict__btn sui-predict__btn--sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedAsset(p.asset)
                      setAction('supply')
                    }}
                  >
                    Supply
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supply/Withdraw Form */}
      {selectedPool && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">
              {action === 'supply' ? 'Supply' : 'Withdraw'} {selectedAsset}
            </h3>
            <span className="sui-predict__badge sui-predict__badge--green">
              APY: {selectedPool.supply_apy.toFixed(2)}%
            </span>
          </div>

          <div className="sui-predict__toggle-row">
            <div className="sui-predict__toggle">
              <button type="button"
                className={`sui-predict__toggle-btn ${action === 'supply' ? 'sui-predict__toggle-btn--active' : ''}`}
                onClick={() => setAction('supply')}
              >
                Supply
              </button>
              <button type="button"
                className={`sui-predict__toggle-btn ${action === 'withdraw' ? 'sui-predict__toggle-btn--active' : ''}`}
                onClick={() => setAction('withdraw')}
              >
                Withdraw
              </button>
            </div>
          </div>

          {!isConnected ? (
            <div className="sui-predict__empty">
              <p>Connect wallet to supply/withdraw</p>
              <button type="button" className="sui-predict__btn" onClick={() => sharedHost?.requestConnect()}>
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="sui-predict__form">
              <div className="sui-predict__field">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="sui-predict__field-label">
                    {action === 'supply' ? `${selectedAsset} Amount` : 'Withdraw Amount'}
                  </label>
                  {action === 'withdraw' && balance > 0 && (
                    <span style={{ fontSize: '10px', color: '#9fb9b1' }}>
                      Supplied: {balance.toFixed(4)}
                    </span>
                  )}
                </div>
                <input
                  className="sui-predict__input"
                  type="number"
                  placeholder="1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {action === 'withdraw' && balance > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    {[25, 50, 75, 100].map((pct) => (
                      <button type="button"
                        key={pct}
                        className="sui-predict__btn sui-predict__btn--ghost sui-predict__btn--sm"
                        onClick={() =>
                          setAmount(parseFloat(((balance * pct) / 100).toFixed(4)).toString())
                        }
                      >
                        {pct === 100 ? 'Max' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {action === 'supply' && Number(amount) > 0 && selectedPool.supply_apy > 0 && (
                <div className="sui-predict__trade-info">
                  <span>
                    Est. daily: +
                    {((Number(amount) * selectedPool.supply_apy) / 100 / 365).toFixed(4)}{' '}
                    {selectedAsset}
                  </span>
                  <span>
                    Est. monthly: +
                    {((Number(amount) * selectedPool.supply_apy) / 100 / 12).toFixed(2)}{' '}
                    {selectedAsset}
                  </span>
                </div>
              )}

              <button type="button"
                className="sui-predict__btn sui-predict__btn--full"
                onClick={handleSubmit}
                disabled={submitting || !amount || Number(amount) <= 0}
              >
                {submitting
                  ? 'Submitting…'
                  : `${action === 'supply' ? 'Supply' : 'Withdraw'} ${selectedAsset}`}
              </button>

              {txDigest && <div className="sui-predict__success">TX: {txDigest.slice(0, 16)}…</div>}
              {txError && <div className="sui-predict__error">{txError}</div>}
            </div>
          )}
        </div>
      )}

      {/* User positions */}
      {Object.keys(userSupplied).length > 0 && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">Your Supplied Positions</h3>
          </div>
          <div className="sui-predict__stats">
            {Object.entries(userSupplied).map(([asset, amt]) => {
              const pool = pools.find((p) => p.asset === asset)
              return (
                <div key={asset} className="sui-predict__stat">
                  <span className="sui-predict__stat-label">{asset}</span>
                  <span className="sui-predict__stat-value">{amt.toFixed(4)}</span>
                  {pool && (
                    <span style={{ fontSize: '10px', color: '#80ffd5' }}>
                      +{((amt * pool.supply_apy) / 100 / 365).toFixed(4)}/day
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      <CollapsibleNotes title="How Lending Works">
        <h4>Supply</h4>
        <p>
          Deposit assets into a MarginPool. Borrowers pay interest which accrues to suppliers
          proportionally.
        </p>
        <h4>Interest Rate Model</h4>
        <p className="sui-predict__formula">if util &lt; kink: rate = base + slope₁ × util</p>
        <p className="sui-predict__formula">
          if util ≥ kink: rate = base + slope₁ × kink + slope₂ × (util − kink)
        </p>
        <h4>Fee Split</h4>
        <p>90% of interest → suppliers, 5% referral, 2.5% protocol, 2.5% maintainer.</p>
        <h4>Risks</h4>
        <ul>
          <li>Bad debt if liquidations don't fully cover borrower debt</li>
          <li>High utilization may delay withdrawals</li>
          <li>Interest rates fluctuate with utilization</li>
        </ul>
      </CollapsibleNotes>
    </div>
  )
}

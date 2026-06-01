/**
 * Keeper Tab — Permissionless redeem for settled positions (any manager).
 * Earns gas refund by helping the protocol settle positions.
 */

import { useState, useEffect, useCallback } from 'react'
import { Transaction } from '@mysten/sui/transactions'
import { PREDICT_PACKAGE, PREDICT_ID, DUSDC_TYPE, DUSDC_DECIMALS, STRIKE_SCALE } from '../types'
import { getManagerPositions, getManagers } from '../data/managerRepository'
import type { SuiHostAPI } from '../../../src/sui-dashboard/sui-types'
import { CollapsibleNotes, StepTree } from './shared'
import type { TreeStep } from './shared'

interface Props {
  oracles: any[]
  walletAddress: string | null
  isConnected: boolean
  sharedHost: SuiHostAPI | null
}

interface SettledPosition {
  manager_id: string
  owner: string
  oracle_id: string
  underlying_asset: string
  expiry: number
  strike: number
  is_up: boolean
  open_quantity: number
}

export function KeeperTab({ oracles, walletAddress, isConnected, sharedHost }: Props) {
  const [settledPositions, setSettledPositions] = useState<SettledPosition[]>([])
  const [loading, setLoading] = useState(false)
  const [execSteps, setExecSteps] = useState<TreeStep[]>([])
  const [executing, setExecuting] = useState(false)
  const [txDigest, setTxDigest] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  const settledOracles = oracles.filter((o) => o.status === 'settled')

  // Scan for redeemable positions across all managers
  const scanPositions = useCallback(async () => {
    if (settledOracles.length === 0) return
    setLoading(true)
    const found: SettledPosition[] = []

    try {
      // Get all managers
      const managers = await getManagers()
      if (managers.length === 0) {
        setLoading(false)
        return
      }

      // For each manager, check positions on settled oracles
      for (const mgr of managers.slice(0, 20)) {
        // limit to 20 for performance
        const positions = await getManagerPositions(mgr.manager_id)
        if (positions.length === 0) continue

        for (const pos of positions) {
          if (Number(pos.open_quantity) <= 0) continue
          const isSettled = settledOracles.some((o) => o.oracle_id === pos.oracle_id)
          if (isSettled) {
            found.push({
              manager_id: mgr.manager_id,
              owner: mgr.owner,
              oracle_id: String(pos.oracle_id || ''),
              underlying_asset: String(pos.underlying_asset || 'BTC'),
              expiry: Number(pos.expiry),
              strike: Number(pos.strike),
              is_up: Boolean(pos.is_up),
              open_quantity: Number(pos.open_quantity),
            })
          }
        }
      }
    } catch {
      /* silent */
    }

    setSettledPositions(found)
    setLoading(false)
  }, [settledOracles])

  useEffect(() => {
    scanPositions()
  }, [scanPositions])

  // Batch redeem all found positions in one PTB
  const redeemAll = async () => {
    if (!sharedHost || !walletAddress || settledPositions.length === 0) return
    setExecuting(true)
    setTxError(null)
    setTxDigest(null)

    const steps: TreeStep[] = settledPositions.map((p) => ({
      protocol: 'predict',
      action: `Redeem ${p.is_up ? 'UP' : 'DOWN'} $${(p.strike / Number(STRIKE_SCALE)).toFixed(0)} — mgr ${p.manager_id.slice(0, 8)}…`,
      status: 'pending' as const,
    }))
    setExecSteps(steps)

    try {
      const tx = new Transaction()
      tx.setSender(walletAddress)

      for (const pos of settledPositions) {
        const keyFn = pos.is_up ? 'up' : 'down'
        const [marketKey] = tx.moveCall({
          target: `${PREDICT_PACKAGE}::market_key::${keyFn}`,
          arguments: [tx.pure.id(pos.oracle_id), tx.pure.u64(pos.expiry), tx.pure.u64(pos.strike)],
        })

        tx.moveCall({
          target: `${PREDICT_PACKAGE}::predict::redeem_permissionless`,
          typeArguments: [DUSDC_TYPE],
          arguments: [
            tx.object(PREDICT_ID),
            tx.object(pos.manager_id),
            tx.object(pos.oracle_id),
            marketKey,
            tx.pure.u64(pos.open_quantity),
            tx.object.clock(),
          ],
        })
      }

      // Execute single atomic PTB
      const result = await sharedHost.signAndExecuteTransaction(tx)
      setTxDigest(result.digest)
      for (const s of steps) s.status = 'done'
      setExecSteps([...steps])
      sharedHost.setSharedData('txRefresh', Date.now())
      // Refresh
      setSettledPositions([])
    } catch (e) {
      setTxError(e instanceof Error ? e.message : String(e))
      for (const s of steps) s.status = 'error'
      setExecSteps([...steps])
    }
    setExecuting(false)
  }

  return (
    <div className="sui-predict__grid">
      {/* Scan + Action */}
      <div className="sui-predict__card sui-predict__card--wide">
        <div className="sui-predict__card-header">
          <h3 className="sui-predict__card-title">Keeper — Permissionless Redeem</h3>
          <span className="sui-predict__badge sui-predict__badge--green">
            {settledOracles.length} settled oracle{settledOracles.length !== 1 ? 's' : ''}
          </span>
        </div>

        {!isConnected ? (
          <div className="sui-predict__empty">
            <p>Connect wallet to run keeper</p>
            <button
              type="button"
              className="sui-predict__btn"
              onClick={() => sharedHost?.requestConnect()}
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div>
            <div className="sui-predict__trade-info">
              <span>Scans all managers for settled positions</span>
              <span>Anyone can call redeem_permissionless</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                className="sui-predict__btn sui-predict__btn--ghost"
                onClick={scanPositions}
                disabled={loading}
              >
                {loading ? '⟳ Scanning…' : '↻ Scan Positions'}
              </button>
              {settledPositions.length > 0 && (
                <button
                  type="button"
                  className="sui-predict__btn"
                  onClick={redeemAll}
                  disabled={executing}
                >
                  {executing
                    ? 'Redeeming…'
                    : `Redeem All (${settledPositions.length} positions, 1 PTB)`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Found positions */}
      {settledPositions.length > 0 && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__card-header">
            <h3 className="sui-predict__card-title">
              Redeemable Positions ({settledPositions.length})
            </h3>
          </div>
          <div className="sui-predict__table">
            <div className="sui-predict__table-header sui-predict__table-header--6col">
              <span>Manager</span>
              <span>Asset</span>
              <span>Strike</span>
              <span>Dir</span>
              <span>Qty</span>
              <span>Owner</span>
            </div>
            {settledPositions.map((p, i) => (
              <div key={i} className="sui-predict__table-row sui-predict__table-row--6col">
                <span style={{ fontFamily: 'var(--font-ui-mono)', fontSize: '10px' }}>
                  {p.manager_id.slice(0, 8)}…
                </span>
                <span>{p.underlying_asset}</span>
                <span>${(p.strike / Number(STRIKE_SCALE)).toFixed(0)}</span>
                <span className={p.is_up ? 'sui-predict__text--green' : 'sui-predict__text--red'}>
                  {p.is_up ? '▲ UP' : '▼ DOWN'}
                </span>
                <span>${(p.open_quantity / 10 ** DUSDC_DECIMALS).toFixed(0)}</span>
                <span style={{ fontFamily: 'var(--font-ui-mono)', fontSize: '10px' }}>
                  {p.owner.slice(0, 8)}…
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {settledPositions.length === 0 && !loading && (
        <div className="sui-predict__card sui-predict__card--wide">
          <div className="sui-predict__empty">
            {settledOracles.length === 0
              ? 'No settled oracles yet. Wait for an oracle to expire.'
              : 'No unredeemed positions found on settled oracles.'}
          </div>
        </div>
      )}

      {/* Execution progress */}
      <StepTree steps={execSteps} title="Redeem Progress" />

      {txDigest && <div className="sui-predict__success">TX: {txDigest.slice(0, 16)}…</div>}
      {txError && <div className="sui-predict__error">{txError}</div>}

      {/* Notes */}
      <CollapsibleNotes title="How Keeper Works">
        <h4>Permissionless Redeem</h4>
        <p>
          After an oracle settles, <code>predict::redeem_permissionless</code> can be called by
          ANYONE — not just the position owner.
        </p>
        <h4>Why run a keeper?</h4>
        <ul>
          <li>Helps the protocol settle positions faster</li>
          <li>Payout goes to the position owner's manager (not you)</li>
          <li>You pay gas but help maintain protocol health</li>
          <li>Future: protocol may reward keepers</li>
        </ul>
        <h4>Batch Efficiency</h4>
        <p>
          All redeems are batched into one PTB — one signature, one gas fee, multiple settlements.
        </p>
      </CollapsibleNotes>
    </div>
  )
}

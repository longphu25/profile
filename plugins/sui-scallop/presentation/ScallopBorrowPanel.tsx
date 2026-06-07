import { useState, useEffect } from 'react'
import type { Transaction } from '@mysten/sui/transactions'
import { borrowUsdc } from '../application/borrowUsdc'
import { MIN_HEALTH_FACTOR } from '../domain/policies'
import { createScallopGateway } from '../infrastructure/scallopGateway'

export interface ScallopBorrowPanelProps {
  walletAddress: string
  signAndExecute: (tx: Transaction) => Promise<{ digest: string }>
  onSuccess?: (digest: string) => void
  onError?: (error: string) => void
  maxCollateralSui?: number
}

function healthColor(h: number | null): string {
  if (h === null) return 'text-on-surface-variant'
  if (h < 1.1) return 'text-error'
  if (h < MIN_HEALTH_FACTOR) return 'text-tertiary-fixed'
  return 'text-primary-fixed-dim'
}

function healthLabel(h: number | null): string {
  if (h === null) return '—'
  if (h < 1.1) return 'Danger'
  if (h < MIN_HEALTH_FACTOR) return 'Warning'
  return 'Safe'
}

export function ScallopBorrowPanel({
  walletAddress,
  signAndExecute,
  onSuccess,
  onError,
  maxCollateralSui = 10,
}: ScallopBorrowPanelProps) {
  const [collateral, setCollateral] = useState(Math.min(5, maxCollateralSui).toFixed(2))
  const [borrow, setBorrow] = useState('10.00')
  const [health, setHealth] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)

  // Fetch live health factor
  useEffect(() => {
    if (!walletAddress) return
    const gateway = createScallopGateway()
    gateway.getHealthFactor(walletAddress).then(setHealth).catch(() => {})
  }, [walletAddress])

  // Estimate health after borrow (simple: collateral*0.7 / borrow)
  const collateralNum = parseFloat(collateral) || 0
  const borrowNum = parseFloat(borrow) || 0
  const estimatedHealth =
    borrowNum > 0 ? Math.min((collateralNum * 0.7 * 1.0) / (borrowNum * 0.001 || 1), 9.99) : null

  async function handleBorrow() {
    if (!agreed) return
    setLoading(true)
    const result = await borrowUsdc(
      { walletAddress, signAndExecute },
      { collateralSui: collateralNum, borrowUsdc: borrowNum },
    )
    setLoading(false)
    if (result.ok && result.digest) {
      onSuccess?.(result.digest)
    } else {
      onError?.(result.error ?? 'Borrow failed')
    }
  }

  const canExecute = agreed && collateralNum > 0 && borrowNum > 0 && !loading

  return (
    <div className="flex flex-col gap-md p-md">
      {/* Collateral Input */}
      <div className="flex flex-col gap-xs">
        <div className="flex justify-between items-center">
          <span className="font-label text-label-caps text-on-surface-variant uppercase">
            Collateral
          </span>
          <button
            type="button"
            className="font-data text-data-sm text-primary-fixed-dim"
            onClick={() => setCollateral(maxCollateralSui.toFixed(2))}
          >
            MAX {maxCollateralSui.toFixed(1)} SUI
          </button>
        </div>
        <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded px-md py-sm focus-within:border-primary-fixed-dim">
          <input
            className="bg-transparent w-full outline-none font-data text-data-lg text-primary"
            type="number"
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
            min="0"
            step="0.1"
          />
          <span className="font-body text-body-base text-on-surface ml-2 pl-sm border-l border-outline-variant">
            SUI
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <span className="material-symbols-outlined text-[16px] text-outline">arrow_downward</span>
      </div>

      {/* Borrow Input */}
      <div className="flex flex-col gap-xs">
        <span className="font-label text-label-caps text-on-surface-variant uppercase">
          Borrow Amount
        </span>
        <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded px-md py-sm focus-within:border-primary-fixed-dim">
          <input
            className="bg-transparent w-full outline-none font-data text-data-lg text-primary"
            type="number"
            value={borrow}
            onChange={(e) => setBorrow(e.target.value)}
            min="0"
            step="1"
          />
          <span className="font-body text-body-base text-on-surface ml-2 pl-sm border-l border-outline-variant">
            USDC
          </span>
        </div>
      </div>

      {/* Health Factor */}
      <div className="bg-surface-container-low border border-outline-variant rounded p-md flex flex-col gap-sm">
        <div className="flex justify-between items-end">
          <div>
            <span className="font-label text-label-caps text-on-surface-variant uppercase block mb-xs">
              Est. Health Factor
            </span>
            <span className={`font-headline text-headline-md ${healthColor(estimatedHealth)}`}>
              {estimatedHealth !== null ? estimatedHealth.toFixed(2) : '—'}
            </span>
          </div>
          <span className={`font-label text-label-caps ${healthColor(estimatedHealth)}`}>
            {healthLabel(estimatedHealth)}
          </span>
        </div>
        {health !== null && (
          <div className="font-data text-data-sm text-on-surface-variant">
            Current: <span className={healthColor(health)}>{health.toFixed(2)}</span>
          </div>
        )}
        {/* Gauge */}
        <div className="relative w-full h-[6px] rounded-full overflow-hidden flex">
          <div className="h-full bg-error" style={{ width: '25%' }} />
          <div className="h-full bg-tertiary-container" style={{ width: '25%' }} />
          <div className="h-full bg-primary-fixed-dim/40" style={{ width: '50%' }} />
          {estimatedHealth !== null && (
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_8px_rgba(253,255,252,0.8)]"
              style={{ left: `${Math.min((estimatedHealth / 3) * 100, 98)}%` }}
            />
          )}
        </div>
        <div className="flex justify-between font-data text-[10px] text-on-surface-variant/50">
          <span>0</span><span>1.0</span><span>1.5</span><span>3.0+</span>
        </div>
      </div>

      {/* Warning checkbox */}
      <label className="flex items-start gap-sm p-sm border border-tertiary-fixed/30 bg-tertiary-fixed/5 rounded cursor-pointer">
        <input
          type="checkbox"
          className="mt-[2px] w-4 h-4 accent-tertiary-fixed"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <p className="font-body text-body-sm text-on-surface/90 leading-relaxed">
          I understand my SUI collateral may be liquidated if health factor drops below 1.0.
        </p>
      </label>

      {/* Execute */}
      <button
        type="button"
        onClick={handleBorrow}
        disabled={!canExecute}
        className="w-full py-sm rounded font-label text-label-caps text-on-primary uppercase tracking-wider transition-colors
          bg-primary-fixed-dim hover:bg-primary-fixed disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Borrowing…' : `Borrow ${borrowNum.toFixed(0)} USDC`}
      </button>
    </div>
  )
}

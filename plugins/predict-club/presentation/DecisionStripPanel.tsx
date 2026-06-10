import { useState } from 'react'
import { usePredictClub } from './usePredictClub'
import { selectAutoOracle, selectOracle } from '../infrastructure/deepbookOracleService'
import { formatUsd, labelize } from './shared'

function formatAge(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

function formatExpiry(ms: number): string {
  const diff = ms - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatDirection(direction: 'UP' | 'DOWN' | 'RANGE'): string {
  if (direction === 'UP') return 'ABOVE'
  if (direction === 'DOWN') return 'BELOW'
  return 'RANGE'
}

function directionIcon(direction: 'UP' | 'DOWN' | 'RANGE'): string {
  if (direction === 'UP') return 'trending_up'
  if (direction === 'DOWN') return 'trending_down'
  return 'swap_horiz'
}

export function DecisionStripPanel() {
  const { club, context, primaryAction, toastMessage, oracleSnapshot, riskEvaluation, setModal } =
    usePredictClub()
  const [oraclesOpen, setOraclesOpen] = useState(false)
  const round = club.activeRound
  const spot = oracleSnapshot.oracleState?.latest_price?.spot
  const forward = oracleSnapshot.oracleState?.latest_price?.forward
  const selectedOracle = oracleSnapshot.oracles.find(
    (oracle) => oracle.oracle_id === oracleSnapshot.selectedOracleId,
  )
  const activeOracles = oracleSnapshot.oracles.filter(
    (oracle) => oracle.status === 'active' && oracle.expiry > Date.now(),
  )
  const priceTicks = oracleSnapshot.prices.slice(-24)
  const priceTickSpots = priceTicks.map((price) => price.spot)
  const priceTickMin = priceTickSpots.length > 0 ? Math.min(...priceTickSpots) : 0
  const priceTickMax = priceTickSpots.length > 0 ? Math.max(...priceTickSpots) : 0
  const priceTickRange = priceTickMax - priceTickMin || 1
  const oracleSelectionNote = oracleSnapshot.selectionMode === 'manual' ? 'Manual' : 'Auto-selected'
  const strikeLabel = round.direction === 'RANGE' ? 'Range' : 'Strike'
  const strikeValue =
    round.direction === 'RANGE'
      ? `$${formatUsd(round.lowerStrike ?? round.strike)}–$${formatUsd(
          round.upperStrike ?? round.strike,
        )}`
      : `$${formatUsd(round.strike)}`
  const isConnectAction = !context.isConnected
  const blocked =
    !isConnectAction && (riskEvaluation.state === 'blocked' || riskEvaluation.state === 'unknown')
  const firstReason =
    riskEvaluation.blockingReasons[0]?.message ??
    riskEvaluation.warningReasons[0]?.message ??
    'Review risk checks before continuing'

  function handlePrimary() {
    if (blocked) {
      if (riskEvaluation.blockingReasons.some((check) => check.actionTarget === 'funding')) {
        setModal('fund-to-join')
      }
      return
    }
    primaryAction.action()
  }

  return (
    <>
      <div className="flex items-center gap-lg flex-wrap">
        <div className="flex flex-col" data-animate="strip-item">
          <span className="font-label text-label-caps text-on-surface-variant uppercase tracking-wider">
            Asset
          </span>
          <div className="flex items-center gap-sm">
            <span className="font-data text-data-lg font-bold">BTC</span>
            <span
              className="font-data text-data-md text-primary-fixed-dim tabular-nums font-bold"
              id="live-price"
            >
              ${formatUsd(spot ?? round.btcSpot)}
            </span>
          </div>
        </div>
        <Divider />
        <StripItem label="Forward">
          <span className="font-data text-data-md text-primary-fixed-dim tabular-nums font-bold">
            {forward ? `$${formatUsd(forward)}` : '—'}
          </span>
        </StripItem>
        <Divider />
        <StripItem label="Oracle">
          <span
            className={`font-data text-data-md tabular-nums flex items-center gap-1 ${
              oracleSnapshot.isHealthy ? 'text-primary-fixed-dim' : 'text-error'
            }`}
            title={oracleSelectionNote}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                oracleSnapshot.isHealthy ? 'bg-primary-fixed-dim animate-pulse' : 'bg-error'
              }`}
            />
            <span>
              {selectedOracle ? `Exp ${formatExpiry(selectedOracle.expiry)}` : 'Pending'}
              {oracleSnapshot.lastUpdateMs ? ` · ${formatAge(oracleSnapshot.lastUpdateMs)}` : ''}
            </span>
          </span>
        </StripItem>
        <Divider />
        <StripItem label="Direction">
          <span className="font-data text-data-md text-primary-fixed-dim font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">
              {directionIcon(round.direction)}
            </span>
            {formatDirection(round.direction)}
          </span>
        </StripItem>
        <Divider />
        <StripItem label={strikeLabel}>
          <span className="font-data text-data-md tabular-nums">{strikeValue}</span>
        </StripItem>
        <Divider />
        <StripItem label="Status">
          <span className="font-data text-data-md tabular-nums text-tertiary-fixed-dim uppercase">
            {labelize(round.status)}
          </span>
        </StripItem>
        <Divider />
        <StripItem label="Pledged">
          <span className="font-data text-data-md tabular-nums">
            {formatUsd(round.totalPledgedDusdc)}{' '}
            <span className="text-on-surface-variant text-body-sm">DUSDC</span>
          </span>
        </StripItem>
        <Divider />
        <StripItem label="Price ticks">
          <div className="flex items-center gap-xs rounded-md border border-outline-variant bg-surface-container-high px-xs py-[3px]">
            <div
              className="relative flex items-end gap-px h-6 w-28 overflow-hidden"
              title={`${oracleSnapshot.prices.length} price ticks`}
            >
              <div className="absolute left-0 right-0 top-1/2 h-px bg-outline-variant/70" />
              {priceTicks.length > 0 ? (
                priceTicks.map((price, index) => {
                  const pct = ((price.spot - priceTickMin) / priceTickRange) * 100
                  const isLatest = index === priceTicks.length - 1
                  return (
                    <div
                      key={`${price.timestamp}-${index}`}
                      className={`relative z-10 flex-1 rounded-sm ${
                        isLatest ? 'bg-primary-fixed-dim' : 'bg-primary-fixed-dim/45'
                      }`}
                      style={{ height: `${Math.max(10, pct)}%` }}
                    />
                  )
                })
              ) : (
                <div className="h-px w-full bg-outline-variant" />
              )}
            </div>
            <span className="font-data text-[11px] leading-4 text-primary-fixed-dim tabular-nums font-bold">
              {oracleSnapshot.prices.length}
            </span>
          </div>
        </StripItem>
      </div>
      <div className="flex items-center gap-md">
        <div className="relative">
          <button
            type="button"
            className="font-label text-label-caps text-primary-fixed-dim uppercase border border-primary-fixed-dim/40 rounded px-sm py-1 flex items-center gap-1 shrink-0"
            onClick={() => setOraclesOpen((open) => !open)}
          >
            Active Oracles ({activeOracles.length})
            <span
              className="material-symbols-outlined text-[14px] transition-transform"
              style={{ transform: oraclesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              expand_more
            </span>
          </button>
          {oraclesOpen && (
            <div className="absolute right-0 top-full z-50 mt-sm w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-outline-variant bg-surface-container-highest p-sm shadow-2xl">
              <div className="flex items-center justify-between gap-sm mb-xs">
                <span className="font-label text-label-caps text-on-surface-variant uppercase">
                  Active Oracles
                </span>
                {oracleSnapshot.selectionMode === 'manual' && (
                  <button
                    type="button"
                    onClick={selectAutoOracle}
                    className="font-label text-label-caps text-primary-fixed-dim uppercase border border-primary-fixed-dim/40 rounded px-xs py-[2px]"
                  >
                    Auto
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-xs max-h-56 overflow-y-auto">
                {activeOracles.map((oracle) => (
                  <div
                    key={oracle.oracle_id}
                    className={`rounded border p-xs ${
                      oracle.oracle_id === oracleSnapshot.selectedOracleId
                        ? 'border-primary-fixed-dim/50 bg-primary-fixed-dim/5'
                        : 'border-outline-variant bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-sm">
                      <span className="font-data text-data-sm text-on-surface truncate">
                        {oracle.underlying_asset}
                      </span>
                      <span className="font-label text-label-caps text-on-surface-variant uppercase shrink-0">
                        {formatExpiry(oracle.expiry)}
                      </span>
                    </div>
                    <div className="flex items-center gap-sm mt-px">
                      <span className="font-data text-[10px] text-on-surface-variant truncate">
                        {oracle.oracle_id.slice(0, 10)}…{oracle.oracle_id.slice(-6)}
                      </span>
                      {oracle.oracle_id !== oracleSnapshot.selectedOracleId ? (
                        <button
                          type="button"
                          onClick={() => {
                            selectOracle(oracle.oracle_id)
                            setOraclesOpen(false)
                          }}
                          className="ml-auto font-label text-label-caps text-primary-fixed-dim uppercase border border-primary-fixed-dim/40 rounded px-xs py-[2px] shrink-0"
                        >
                          Select
                        </button>
                      ) : (
                        <span className="ml-auto font-label text-label-caps text-primary-fixed-dim uppercase">
                          Selected
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border border-primary-fixed-dim rounded-full px-sm py-1 bg-[#00e0b31a]">
          <div className="w-2 h-2 rounded-full bg-primary-fixed-dim glow-mint animate-pulse-dot" />
          <span className="font-data text-data-sm text-primary-fixed-dim uppercase tracking-widest">
            {labelize(riskEvaluation.state)}
          </span>
        </div>
        <button
          className={`px-lg py-sm rounded font-headline text-headline-md transition-colors ${
            blocked
              ? 'bg-surface-variant text-on-surface-variant border border-outline cursor-not-allowed'
              : 'bg-primary-fixed-dim text-on-primary-fixed cursor-pointer hover:bg-primary-container glow-mint'
          }`}
          type="button"
          disabled={blocked}
          onClick={handlePrimary}
        >
          {blocked ? 'Review Risk' : primaryAction.label}
        </button>
        {blocked && (
          <span className="font-data text-data-sm text-error max-w-[220px] truncate">
            {firstReason}
          </span>
        )}
      </div>
      {toastMessage && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-md py-xs bg-surface-container-highest border border-primary-fixed-dim/50 rounded text-data-sm font-data text-primary-fixed-dim z-50 whitespace-nowrap">
          {toastMessage}
        </div>
      )}
    </>
  )
}

function StripItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="font-label text-label-caps text-on-surface-variant uppercase tracking-wider">
        {label}
      </span>
      {children}
    </div>
  )
}

function Divider() {
  return <div className="w-px h-8 bg-outline-variant hidden lg:block" />
}

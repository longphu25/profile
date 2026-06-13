import { usePredictClub } from '../usePredictClub'
import { formatUsd } from '../shared'
import type { Direction } from '../../domain/types'

/**
 * Context Rail (C3): the dense, single-row decision-context band above the chart.
 *
 * Answers "what is this round?" at a glance: asset + spot, forward, direction,
 * strike, expiry, pledged, oracle count. Reads the shared snapshot only (no
 * forked data). No raw `Phase: {status}` text anywhere - lifecycle context lives
 * in `LifecycleRail`. Em-dash is banned, so the empty marker is a plain hyphen.
 */

function formatExpiry(ms: number): string {
  const diff = ms - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatDirection(direction: Direction): string {
  if (direction === 'UP') return 'ABOVE'
  if (direction === 'DOWN') return 'BELOW'
  return 'RANGE'
}

function directionIcon(direction: Direction): string {
  if (direction === 'UP') return 'trending_up'
  if (direction === 'DOWN') return 'trending_down'
  return 'swap_horiz'
}

function Cell({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex min-w-0 shrink-0 flex-col ${className}`}>
      <span className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant/60">
        {label}
      </span>
      {children}
    </div>
  )
}

export function ContextRail({ className = '' }: { className?: string }) {
  const { club, oracleSnapshot } = usePredictClub()
  const round = club.activeRound
  const spot = oracleSnapshot.oracleState?.latest_price?.spot
  const forward = oracleSnapshot.oracleState?.latest_price?.forward
  const selectedOracle = oracleSnapshot.oracles.find(
    (oracle) => oracle.oracle_id === oracleSnapshot.selectedOracleId,
  )
  const activeCount = oracleSnapshot.oracles.filter((o) => o.status === 'active').length

  const isRange = round.direction === 'RANGE'
  const strikeLabel = isRange ? 'Range' : 'Strike'
  const strikeValue = isRange
    ? `$${formatUsd(round.lowerStrike ?? round.strike)} / $${formatUsd(round.upperStrike ?? round.strike)}`
    : `$${formatUsd(round.strike)}`

  const expiryLabel = selectedOracle ? formatExpiry(selectedOracle.expiry) : 'Pending'
  const healthy = oracleSnapshot.isHealthy

  return (
    <div
      data-pc-context
      aria-label="Round context"
      className={`flex items-center gap-lg overflow-x-auto px-md py-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <Cell label="Asset">
        <span className="flex items-center gap-sm">
          <span className="font-data text-data-md font-bold text-on-surface">
            {selectedOracle?.underlying_asset ?? round.market ?? 'BTC'}
          </span>
          <span className="font-data text-data-md font-bold tabular-nums text-primary-fixed-dim">
            ${formatUsd(spot ?? round.btcSpot)}
          </span>
        </span>
      </Cell>

      <Cell label="Forward">
        <span className="font-data text-data-sm font-bold tabular-nums text-on-surface-variant">
          {forward ? `$${formatUsd(forward)}` : '-'}
        </span>
      </Cell>

      <Cell label="Direction">
        <span className="flex items-center gap-1 font-data text-data-sm font-bold text-primary-fixed-dim">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            {directionIcon(round.direction)}
          </span>
          {formatDirection(round.direction)}
        </span>
      </Cell>

      <Cell label={strikeLabel}>
        <span className="font-data text-data-sm tabular-nums text-on-surface">{strikeValue}</span>
      </Cell>

      <Cell label="Expiry">
        <span
          className={`flex items-center gap-1 font-data text-data-sm tabular-nums ${
            healthy ? 'text-on-surface' : 'text-error'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              healthy ? 'bg-primary-fixed-dim' : 'bg-error'
            }`}
            aria-hidden="true"
          />
          {expiryLabel}
        </span>
      </Cell>

      <Cell label="Pledged">
        <span className="font-data text-data-sm tabular-nums text-on-surface">
          {formatUsd(round.totalPledgedDusdc)}{' '}
          <span className="text-[10px] text-on-surface-variant">DUSDC</span>
        </span>
      </Cell>

      <Cell label="Oracles" className="ml-auto">
        <span className="font-data text-data-sm tabular-nums text-on-surface-variant">
          {activeCount} active
        </span>
      </Cell>
    </div>
  )
}

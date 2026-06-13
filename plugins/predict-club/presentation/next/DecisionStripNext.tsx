import { usePredictClub } from '../usePredictClub'
import { formatUsd } from '../shared'
import { PanelShell } from './PanelShell'
import type { Direction } from '../../domain/types'

/**
 * Decision Strip (R3, next surface) — the at-a-glance round context band.
 *
 * Reads the same shared snapshot as the legacy `DecisionStripPanel` (no forked
 * data). It is intentionally lighter: the live lifecycle/countdown lives in
 * `RoundLifecycleStrip`, and full oracle selection stays in the legacy panel /
 * a later R3 follow-up. This band only answers "what is the round?".
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

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      {children}
    </div>
  )
}

function Divider() {
  return <div className="w-px h-8 bg-outline-variant hidden lg:block shrink-0" />
}

export function DecisionStripNext({ className }: { className?: string }) {
  const { club, oracleSnapshot } = usePredictClub()
  const round = club.activeRound
  const spot = oracleSnapshot.oracleState?.latest_price?.spot
  const forward = oracleSnapshot.oracleState?.latest_price?.forward
  const selectedOracle = oracleSnapshot.oracles.find(
    (oracle) => oracle.oracle_id === oracleSnapshot.selectedOracleId,
  )

  const strikeLabel = round.direction === 'RANGE' ? 'Range' : 'Strike'
  const strikeValue =
    round.direction === 'RANGE'
      ? `$${formatUsd(round.lowerStrike ?? round.strike)}–$${formatUsd(round.upperStrike ?? round.strike)}`
      : `$${formatUsd(round.strike)}`

  const expiryLabel = selectedOracle ? formatExpiry(selectedOracle.expiry) : 'Pending'
  const healthy = oracleSnapshot.isHealthy

  return (
    <PanelShell bordered={false} title="Decision" icon="tune" className={className}>
      <div className="flex items-center gap-lg flex-wrap min-w-0">
        <Cell label="Asset">
          <div className="flex items-center gap-sm">
            <span className="font-data text-data-lg font-bold">BTC</span>
            <span className="font-data text-data-md text-primary-fixed-dim tabular-nums font-bold">
              ${formatUsd(spot ?? round.btcSpot)}
            </span>
          </div>
        </Cell>
        <Divider />
        <Cell label="Forward">
          <span className="font-data text-data-md text-primary-fixed-dim tabular-nums font-bold">
            {forward ? `$${formatUsd(forward)}` : '—'}
          </span>
        </Cell>
        <Divider />
        <Cell label="Direction">
          <span className="font-data text-data-md text-primary-fixed-dim font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">
              {directionIcon(round.direction)}
            </span>
            {formatDirection(round.direction)}
          </span>
        </Cell>
        <Divider />
        <Cell label={strikeLabel}>
          <span className="font-data text-data-md tabular-nums">{strikeValue}</span>
        </Cell>
        <Divider />
        <Cell label="Expiry">
          <span
            className={`font-data text-data-md tabular-nums flex items-center gap-1 ${
              healthy ? 'text-tertiary-fixed-dim' : 'text-error'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                healthy ? 'bg-primary-fixed-dim animate-pulse' : 'bg-error'
              }`}
            />
            {expiryLabel}
          </span>
        </Cell>
        <Divider />
        <Cell label="Pledged">
          <span className="font-data text-data-md tabular-nums">
            {formatUsd(round.totalPledgedDusdc)}{' '}
            <span className="text-on-surface-variant text-body-sm">DUSDC</span>
          </span>
        </Cell>
      </div>
    </PanelShell>
  )
}

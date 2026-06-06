import { usePredictClub } from './PredictClubContext'
import { formatUsd, labelize } from './shared'

export function DecisionStripPanel() {
  const { club, context, primaryAction, toastMessage, oracleSnapshot, riskEvaluation, setModal } =
    usePredictClub()
  const round = club.activeRound
  const spot = oracleSnapshot.oracleState?.latest_price?.spot
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
        <StripItem label="Asset">
          <div className="flex items-center gap-sm">
            <span className="font-data text-data-lg font-bold">BTC</span>
            <span className="font-data text-data-md text-on-surface-variant tabular-nums">
              ${formatUsd(spot ?? round.btcSpot)}
            </span>
          </div>
        </StripItem>
        <Divider />
        <StripItem label="Oracle">
          <div className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                oracleSnapshot.isHealthy ? 'bg-primary-fixed-dim animate-pulse' : 'bg-error'
              }`}
            />
            <span
              className={`font-data text-data-sm ${
                oracleSnapshot.isHealthy ? 'text-primary-fixed-dim' : 'text-error'
              }`}
            >
              {oracleSnapshot.isHealthy
                ? 'Live'
                : oracleSnapshot.lastUpdateMs
                  ? 'Stale'
                  : 'Connecting…'}
            </span>
          </div>
        </StripItem>
        <Divider />
        <StripItem label="Direction">
          <span className="font-data text-data-md text-primary-fixed-dim font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">
              {round.direction === 'DOWN' ? 'trending_down' : 'trending_up'}
            </span>
            {round.direction}
          </span>
        </StripItem>
        <Divider />
        <StripItem label="Strike">
          <span className="font-data text-data-md tabular-nums">{formatUsd(round.strike)}</span>
        </StripItem>
        <Divider />
        <StripItem label="Status">
          <span className="font-data text-data-md tabular-nums text-tertiary-fixed-dim uppercase">
            {round.status}
          </span>
        </StripItem>
        <Divider />
        <StripItem label="Pledged">
          <span className="font-data text-data-md tabular-nums">
            {formatUsd(round.totalPledgedDusdc)}{' '}
            <span className="text-on-surface-variant text-body-sm">DUSDC</span>
          </span>
        </StripItem>
      </div>
      <div className="flex items-center gap-md">
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

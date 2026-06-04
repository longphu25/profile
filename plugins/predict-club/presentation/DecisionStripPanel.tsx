import { usePredictClub } from './PredictClubContext'
import { formatUsd, Icon, labelize } from './shared'

export function DecisionStripPanel() {
  const { club, primaryAction, fundingRecommendation } = usePredictClub()
  const round = club.activeRound

  return (
    <>
      <div className="pc-decision-group">
        <DataBlock label="Asset" value="BTC" note={`$${formatUsd(round.btcSpot)}`} />
        <Divider />
        <DataBlock label="Direction" value={round.direction} tone="mint" icon="trending_up" />
        <Divider />
        <DataBlock label="Strike" value={formatUsd(round.strike)} />
        <Divider />
        <DataBlock label="Expiry" value={`${round.expiryMinutes}:00`} tone="amber" />
        <Divider />
        <DataBlock label="Pledged" value={`${formatUsd(round.totalPledgedDusdc)} DUSDC`} />
      </div>
      <div className="pc-decision-actions">
        <span className={`pc-status pc-status-${round.risk}`}>
          <i />
          {round.risk === 'ready' ? 'Ready' : labelize(round.risk)}
        </span>
        <button
          className="pc-button pc-button-primary pc-button-lg"
          type="button"
          onClick={primaryAction.action}
        >
          {primaryAction.label}
        </button>
        <span className="pc-funding-note">{fundingRecommendation.label}</span>
      </div>
    </>
  )
}

function DataBlock({
  label,
  value,
  note,
  tone,
  icon,
}: {
  label: string
  value: string
  note?: string
  tone?: 'mint' | 'amber'
  icon?: string
}) {
  return (
    <div className="pc-data-block">
      <span>{label}</span>
      <strong className={tone ? `pc-tone-${tone}` : ''}>
        {icon ? <Icon name={icon} /> : null}
        {value}
      </strong>
      {note ? <em>{note}</em> : null}
    </div>
  )
}

function Divider() {
  return <i className="pc-divider" />
}

import { usePredictClub } from './PredictClubContext'
import { Icon } from './shared'

export function PredictionRoomPanel() {
  const { club } = usePredictClub()
  const round = club.activeRound

  return (
    <>
      <header className="pc-panel-header pc-room-header">
        <h2>
          <Icon name="analytics" /> Prediction Room
        </h2>
        <span>Phase: {round.status}</span>
      </header>
      <div className="pc-room-body">
        <article className="pc-thesis-card">
          <span>Leader Thesis</span>
          <time>12m ago</time>
          <p>{round.thesis}</p>
        </article>
        <div className="pc-indicator-grid">
          {round.indicators.slice(0, 6).map((indicator) => (
            <article key={indicator.id}>
              <span>{indicator.name}</span>
              <strong className={`pc-tone-${indicator.state}`}>{indicator.value}</strong>
            </article>
          ))}
        </div>
        <div className="pc-chart-shell">
          <div className="pc-chart-grid" />
          <div className="pc-chart-label">
            <Icon name="candlestick_chart" />
            <span>[ DeepBook Order Flow Visualization ]</span>
          </div>
        </div>
      </div>
    </>
  )
}

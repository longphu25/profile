import { usePredictClub } from './PredictClubContext'
import { formatUsd, Icon } from './shared'

export function RiskPanel() {
  const { club, context, fundingRecommendation, primaryAction } = usePredictClub()
  const round = club.activeRound

  const items = [
    ['Signal Received', true],
    ['Club Consensus', true],
    ['Wallet Connected', context.isConnected],
    ['Liquidity Sourced', fundingRecommendation.route === 'ready-with-dusdc'],
    ['Funds Escrowed', false],
    ['Contract Signed', false],
  ] as const

  return (
    <>
      <header className="pc-panel-header">
        <h2>
          <Icon name="gpp_maybe" /> Risk &amp; Execution
        </h2>
      </header>
      <div className="pc-risk-body">
        <section>
          <div className="pc-section-title">
            <span>Execution Readiness</span>
            <b>{items.filter(([, ok]) => ok).length}/6</b>
          </div>
          <div className="pc-check-list">
            {items.map(([label, ok]) => (
              <div className={ok ? 'pc-check-ok' : 'pc-check-wait'} key={label}>
                <Icon name={ok ? 'check_circle' : 'radio_button_unchecked'} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="pc-exposure-card">
          <div className="pc-data-row">
            <span>Your Max Loss</span>
            <strong className="pc-tone-error">-{round.suggestedDusdc} DUSDC</strong>
          </div>
          <div className="pc-data-row">
            <span>Est. Payout</span>
            <strong className="pc-tone-mint">+{formatUsd(round.suggestedDusdc * 2.5)} DUSDC</strong>
          </div>
        </section>
        <div className="pc-execute-box">
          <button
            className="pc-button pc-button-primary pc-button-full"
            type="button"
            onClick={primaryAction.action}
          >
            {primaryAction.label}
          </button>
          <p>Awaiting full escrow funding</p>
        </div>
      </div>
    </>
  )
}

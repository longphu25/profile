import { usePredictClub } from './PredictClubContext'
import { formatUsd } from './shared'

export function RiskPanel() {
  const { club, context, fundingRecommendation, primaryAction } = usePredictClub()
  const round = club.activeRound

  const items: Array<[string, boolean]> = [
    ['Signal Received', true],
    ['Club Consensus', true],
    ['Wallet Connected', context.isConnected],
    ['Liquidity Sourced', fundingRecommendation.route === 'ready-with-dusdc'],
    ['Funds Escrowed', false],
    ['Contract Signed', false],
  ]
  const doneCount = items.filter(([, ok]) => ok).length

  return (
    <>
      <div className="p-md border-b border-outline-variant bg-surface-container-high">
        <h2 className="font-headline text-headline-md text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-error">gpp_maybe</span> Risk &amp;
          Execution
        </h2>
      </div>
      <div className="p-md flex flex-col gap-lg flex-1 overflow-y-auto">
        {/* Readiness */}
        <div>
          <div className="flex justify-between items-center mb-sm">
            <span className="font-label text-label-caps text-on-surface-variant uppercase">
              Execution Readiness
            </span>
            <span className="font-data text-data-sm text-primary-fixed-dim">{doneCount}/6</span>
          </div>
          <div className="w-full h-1 bg-surface-container-highest rounded-full mb-sm overflow-hidden">
            <div
              className="h-full bg-primary-fixed-dim rounded-full"
              style={{ width: `${Math.round((doneCount / 6) * 100)}%` }}
            />
          </div>
          <div className="flex flex-col gap-xs">
            {items.map(([label, ok]) => (
              <div
                key={label}
                className={`flex items-center gap-sm font-data text-data-sm ${ok ? '' : 'opacity-50'}`}
              >
                <span
                  className={`material-symbols-outlined text-[16px] ${ok ? 'text-primary-fixed-dim' : 'text-outline'}`}
                >
                  {ok ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className={ok ? 'text-on-surface' : 'text-on-surface-variant'}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Exposure */}
        <div className="bg-surface-container-highest border border-outline-variant p-md rounded-xl flex flex-col gap-sm">
          <span className="font-label text-label-caps text-on-surface-variant uppercase mb-1">
            Your Exposure
          </span>
          <div className="flex justify-between items-center">
            <span className="font-data text-data-sm text-on-surface-variant">Max Loss</span>
            <span className="font-data text-data-md text-error tabular-nums font-bold">
              -{round.suggestedDusdc} DUSDC
            </span>
          </div>
          <div className="w-full h-px bg-outline-variant" />
          <div className="flex justify-between items-center">
            <span className="font-data text-data-sm text-on-surface-variant">Est. Payout</span>
            <span className="font-data text-data-md text-primary-fixed-dim tabular-nums font-bold">
              +{formatUsd(round.suggestedDusdc * 2.5)} DUSDC
            </span>
          </div>
          <div className="w-full h-px bg-outline-variant" />
          <div className="flex justify-between items-center">
            <span className="font-data text-data-sm text-on-surface-variant">Risk/Reward</span>
            <span className="font-data text-data-md text-primary-fixed-dim tabular-nums">
              1:2.5
            </span>
          </div>
        </div>

        {/* Execute */}
        <div className="mt-auto">
          <button
            className="w-full bg-surface-variant text-on-surface-variant border border-outline px-md py-sm rounded-xl font-headline text-headline-md opacity-50 cursor-not-allowed flex justify-center items-center gap-2"
            type="button"
            onClick={primaryAction.action}
          >
            <span className="material-symbols-outlined">lock</span> {primaryAction.label}
          </button>
          <p className="font-data text-data-sm text-center text-on-surface-variant mt-2">
            Awaiting full escrow funding
          </p>
        </div>
      </div>
    </>
  )
}

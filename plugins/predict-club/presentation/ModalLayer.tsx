import { usePredictClub } from './PredictClubContext'
import { formatUsd } from './shared'
import type { ModalKind } from '../domain/types'
import { demoClubState } from '../domain/fixtures'

export function ModalLayer() {
  const { modal, setModal } = usePredictClub()
  if (!modal) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-lg bg-[#0c1512cc] backdrop-blur-xl"
      onClick={() => setModal(null)}
    >
      <section
        className="w-full max-w-[480px] max-h-[80vh] flex flex-col border border-outline-variant rounded-xl bg-surface-container overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between p-md border-b border-outline-variant bg-surface-container-high">
          <h2 className="font-headline text-headline-md text-on-surface">{modalTitle(modal)}</h2>
          <button
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-bright cursor-pointer"
            type="button"
            onClick={() => setModal(null)}
          >
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-lg flex flex-col gap-lg">
          <ModalBodyContent modal={modal} />
        </div>
        <footer className="flex justify-end gap-md p-md border-t border-outline-variant bg-surface-container-lowest">
          <ModalFooterContent modal={modal} />
        </footer>
      </section>
    </div>
  )
}

function ModalBodyContent({ modal }: { modal: ModalKind }) {
  const { club, balances, selectedOffer } = usePredictClub()
  const round = club.activeRound

  switch (modal) {
    case 'create-round':
      return (
        <>
          <InfoRow label="Oracle" value="Pyth BTC/USD" />
          <InfoRow label="Market" value="BTC/USD 5m" />
          <InfoRow label="Direction" value={round.direction} />
          <InfoRow label="Strike" value={formatUsd(round.strike)} />
          <InfoRow label="Expiry" value={`${round.expiryMinutes} minutes`} />
          <InfoRow label="Suggested Size" value={`${round.suggestedDusdc} DUSDC`} />
          <div className="text-body-sm text-on-surface-variant bg-surface-container-lowest p-sm rounded border border-outline-variant">
            {round.thesis}
          </div>
        </>
      )
    case 'fund-to-join':
      return (
        <>
          <div className="grid grid-cols-3 gap-xs">
            <MetricCard label="SUI" value={balances.sui.toFixed(2)} />
            <MetricCard label="USDC" value={balances.usdc.toFixed(2)} />
            <MetricCard label="DUSDC" value={balances.dusdc.toFixed(2)} />
          </div>
          <InfoRow label="Suggested Pledge" value={`${round.suggestedDusdc} DUSDC`} />
          <InfoRow label="Funding Route" value="Ready with DUSDC" tone="mint" />
        </>
      )
    case 'execute-trade':
      return (
        <>
          <InfoRow label="Direction" value={round.direction} tone="mint" />
          <InfoRow label="Strike" value={formatUsd(round.strike)} />
          <InfoRow label="Amount" value={`${round.suggestedDusdc} DUSDC`} />
          <InfoRow label="Max Loss" value={`-${round.suggestedDusdc} DUSDC`} tone="error" />
          <InfoRow
            label="Est. Payout"
            value={`+${formatUsd(round.suggestedDusdc * 2.5)} DUSDC`}
            tone="mint"
          />
          <InfoRow label="Oracle" value={round.oracle} />
        </>
      )
    case 'create-escrow':
      return (
        <>
          <InfoRow label="Offer" value="500 DUSDC" />
          <InfoRow label="Want" value="480 USDC" />
          <InfoRow label="Rate" value="1 DUSDC = 0.96 USDC" />
          <InfoRow label="Expiry" value="12 hours" />
        </>
      )
    case 'fill-escrow':
      return (
        <>
          <InfoRow label="Offer ID" value={selectedOffer?.id ?? '-'} />
          <InfoRow
            label="You Pay"
            value={
              selectedOffer
                ? `${formatUsd(selectedOffer.wantAmount)} ${selectedOffer.wantAsset}`
                : '-'
            }
          />
          <InfoRow
            label="You Receive"
            value={
              selectedOffer
                ? `${formatUsd(selectedOffer.offerAmount)} ${selectedOffer.offerAsset}`
                : '-'
            }
          />
        </>
      )
    case 'scallop-borrow':
      return (
        <>
          <InfoRow label="Collateral" value="5,000 SUI" />
          <InfoRow label="Borrow" value="1,500 USDC" />
          <InfoRow label="Health Factor" value="1.85" tone="mint" />
          <InfoRow label="APY" value="6.45%" />
        </>
      )
    case 'claim-settlement':
      return (
        <>
          <InfoRow label="Round" value={round.id} />
          <InfoRow label="Result" value="Won" tone="mint" />
          <InfoRow label="Claimable" value={`${formatUsd(round.suggestedDusdc * 2.5)} DUSDC`} />
        </>
      )
    default:
      return null
  }
}

function ModalFooterContent({ modal }: { modal: ModalKind }) {
  const { setModal, actions, club, selectedOffer, updateRoundStatus } = usePredictClub()

  switch (modal) {
    case 'create-round':
      return (
        <>
          <Btn label="Cancel" onClick={() => setModal(null)} />
          <BtnPrimary
            label="Create & Publish"
            onClick={() => {
              const round = club.activeRound
              const result = actions.createRound({
                oracle: round.oracle,
                market: round.market,
                expiryMinutes: round.expiryMinutes,
                direction: round.direction,
                strike: round.strike,
                lowerStrike: round.lowerStrike,
                upperStrike: round.upperStrike,
                suggestedDusdc: round.suggestedDusdc,
                thesis: round.thesis || 'New prediction round',
                indicators: demoClubState.activeRound.indicators,
              })
              if (result.ok) actions.publishRound()
            }}
          />
        </>
      )
    case 'fund-to-join':
      return (
        <>
          <Btn label="Cancel" onClick={() => setModal(null)} />
          <BtnPrimary
            label="Pledge DUSDC"
            onClick={() => {
              actions.pledgeToRound('m2', club.activeRound.suggestedDusdc)
              setModal(null)
            }}
          />
        </>
      )
    case 'execute-trade':
      return (
        <>
          <Btn label="Back" onClick={() => setModal(null)} />
          <BtnPrimary label="Sign & Execute" onClick={() => actions.executeRound()} />
        </>
      )
    case 'create-escrow':
      return (
        <>
          <Btn label="Cancel" onClick={() => setModal(null)} />
          <BtnPrimary
            label="Create Offer"
            onClick={() =>
              actions.createEscrowOffer({
                offerAsset: 'DUSDC',
                wantAsset: 'USDC',
                offerAmount: 500,
                wantAmount: 480,
                expiryMinutes: 720,
                maker: club.leaderName,
              })
            }
          />
        </>
      )
    case 'fill-escrow':
      return (
        <>
          <Btn label="Cancel" onClick={() => setModal(null)} />
          <BtnPrimary
            label="Fill Offer"
            onClick={() => {
              if (selectedOffer) actions.fillEscrowOffer(selectedOffer.id)
            }}
          />
        </>
      )
    case 'scallop-borrow':
      return (
        <>
          <Btn label="Cancel" onClick={() => setModal(null)} />
          <BtnPrimary label="Continue" onClick={() => setModal(null)} />
        </>
      )
    case 'claim-settlement':
      return (
        <>
          <Btn label="Close" onClick={() => setModal(null)} />
          <BtnPrimary
            label="Claim"
            onClick={() => {
              updateRoundStatus('claimed')
              setModal(null)
            }}
          />
        </>
      )
    default:
      return <Btn label="Close" onClick={() => setModal(null)} />
  }
}

function InfoRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'mint' | 'error' | 'amber'
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-data text-data-sm text-on-surface-variant">{label}</span>
      <span
        className={`font-data text-data-md tabular-nums ${tone === 'mint' ? 'text-primary-fixed-dim' : tone === 'error' ? 'text-error' : tone === 'amber' ? 'text-tertiary-fixed-dim' : 'text-on-surface'}`}
      >
        {value}
      </span>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center p-sm border border-outline-variant rounded bg-surface-container-lowest">
      <span className="font-label text-label-caps text-on-surface-variant">{label}</span>
      <span className="font-data text-data-md tabular-nums">{value}</span>
    </div>
  )
}

function Btn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="px-md py-xs border border-outline-variant rounded font-data text-data-sm text-on-surface-variant hover:bg-surface-bright cursor-pointer transition-colors"
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function BtnPrimary({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="px-md py-xs bg-primary-fixed-dim text-on-primary-fixed rounded font-data text-data-sm hover:bg-primary-container cursor-pointer transition-colors glow-mint"
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function modalTitle(modal: ModalKind): string {
  return (
    {
      'create-round': 'Create Prediction Round',
      'fund-to-join': 'Fund to Join',
      'create-escrow': 'Create Escrow Offer',
      'fill-escrow': 'Fill Escrow Offer',
      'scallop-borrow': 'Scallop Borrow USDC',
      'execute-trade': 'Execute My Trade',
      'claim-settlement': 'Claim Settlement',
    }[modal] ?? modal
  )
}

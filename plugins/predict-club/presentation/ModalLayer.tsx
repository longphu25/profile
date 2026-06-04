import type { ReactNode } from 'react'
import { usePredictClub } from './PredictClubContext'
import { formatUsd, Icon } from './shared'
import type { ClubState, AssetBalances, EscrowOfferView, ModalKind } from '../domain/types'

export function ModalLayer() {
  const { modal, setModal, club, balances, selectedOffer, updateRoundStatus } = usePredictClub()

  if (!modal) return null

  return (
    <div className="pc-modal-backdrop">
      <section
        className={`pc-modal pc-modal-${modal}`}
        role="dialog"
        aria-modal="true"
        aria-label={modalTitle(modal)}
      >
        <header>
          <h2>{modalTitle(modal)}</h2>
          <button
            className="pc-icon-button"
            type="button"
            onClick={() => setModal(null)}
            aria-label="Close modal"
          >
            <Icon name="close" />
          </button>
        </header>
        <ModalContent
          balances={balances}
          club={club}
          modal={modal}
          offer={selectedOffer}
          onClose={() => setModal(null)}
          onCreateRound={() => {
            updateRoundStatus('open')
            setModal(null)
          }}
        />
      </section>
    </div>
  )
}

function ModalContent({
  modal,
  club,
  balances,
  offer,
  onClose,
  onCreateRound,
}: {
  modal: ModalKind
  club: ClubState
  balances: AssetBalances
  offer: EscrowOfferView | null
  onClose: () => void
  onCreateRound: () => void
}) {
  if (modal === 'create-round') {
    return <CreateRoundModal club={club} onClose={onClose} onCreateRound={onCreateRound} />
  }
  if (modal === 'fund-to-join') {
    return <FundToJoinModal balances={balances} club={club} onClose={onClose} />
  }
  if (modal === 'create-escrow') {
    return <CreateEscrowModal club={club} onClose={onClose} />
  }
  if (modal === 'execute-trade') {
    return <ExecuteTradeModal club={club} onClose={onClose} />
  }
  if (modal === 'scallop-borrow') {
    return <ScallopBorrowModal onClose={onClose} />
  }
  return <SimpleModalBody club={club} modal={modal} offer={offer} onClose={onClose} />
}

function ModalBody({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <>
      <div className="pc-modal-body">{children}</div>
      <footer className="pc-modal-footer">{footer}</footer>
    </>
  )
}

function CreateRoundModal({
  club,
  onClose,
  onCreateRound,
}: {
  club: ClubState
  onClose: () => void
  onCreateRound: () => void
}) {
  const round = club.activeRound
  return (
    <ModalBody
      footer={
        <>
          <button className="pc-button pc-button-secondary" type="button" onClick={onClose}>
            Save Draft
          </button>
          <button className="pc-button pc-button-primary" type="button" onClick={onCreateRound}>
            Publish Round
          </button>
        </>
      }
    >
      <div className="pc-form-row pc-two-col">
        <SegmentedField label="Oracle" options={['PYTH', 'SWITCHBOARD']} active="PYTH" />
        <InputField label="Asset Pair" value="SUI/USDC" readOnly icon="keyboard_arrow_down" />
      </div>
      <SegmentedField
        label="Direction Thesis"
        options={['UP', 'DOWN', 'RANGE']}
        active={round.direction}
        wide
      />
      <div className="pc-form-row pc-two-col">
        <InputField label="Lower Bound (USDC)" value={String(round.lowerStrike ?? 63800)} />
        <InputField label="Upper Bound (USDC)" value={String(round.upperStrike ?? 65000)} />
        <InputField label="Expiry" value="2026-06-04T12:00" type="datetime-local" />
        <InputField label="Suggested Size (DUSDC)" value={String(round.suggestedDusdc)} />
      </div>
      <label className="pc-field pc-wide">
        <span>Leader Thesis (Optional)</span>
        <textarea defaultValue={round.thesis} rows={3} />
      </label>
    </ModalBody>
  )
}

function FundToJoinModal({
  club,
  balances,
  onClose,
}: {
  club: ClubState
  balances: AssetBalances
  onClose: () => void
}) {
  return (
    <ModalBody
      footer={
        <>
          <button className="pc-button pc-button-secondary" type="button">
            Preview Route
          </button>
          <button className="pc-button pc-button-primary" type="button" onClick={onClose}>
            Continue <Icon name="arrow_forward" />
          </button>
        </>
      }
    >
      <div className="pc-balance-grid pc-wide">
        <MetricBox label="SUI" value={balances.sui.toFixed(2)} />
        <MetricBox label="USDC" value={balances.usdc.toFixed(2)} />
        <MetricBox label="DUSDC" value={balances.dusdc.toFixed(2)} />
      </div>
      <AmountInput
        label="Amount to Fund"
        target={`${club.activeRound.suggestedDusdc}.00 USDC`}
        asset="SUI"
        value="45.2"
      />
    </ModalBody>
  )
}

function CreateEscrowModal({ club, onClose }: { club: ClubState; onClose: () => void }) {
  return (
    <ModalBody
      footer={
        <>
          <button className="pc-button pc-button-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="pc-button pc-button-primary" type="button" onClick={onClose}>
            <Icon name="check_circle" /> Create Offer
          </button>
        </>
      }
    >
      <div className="pc-field pc-wide">
        <span>Offer: 500 DUSDC for USDC</span>
      </div>
      <div className="pc-field pc-wide">
        <span>Round: {club.activeRound.id}</span>
      </div>
      <div className="pc-summary-box pc-wide">
        <span>Exchange Rate</span>
        <strong>1 DUSDC = 0.96 USDC</strong>
      </div>
    </ModalBody>
  )
}

function ExecuteTradeModal({ club, onClose }: { club: ClubState; onClose: () => void }) {
  const round = club.activeRound
  return (
    <ModalBody
      footer={
        <>
          <button className="pc-button pc-button-secondary" type="button" onClick={onClose}>
            Back to Cockpit
          </button>
          <button className="pc-button pc-button-primary" type="button" onClick={onClose}>
            <Icon name="draw" /> Sign &amp; Execute Trade
          </button>
        </>
      }
    >
      <div className="pc-info-card pc-wide">
        <div className="pc-section-title">
          <span>Round Summary</span>
          <b>
            <Icon name="timer" /> {round.expiryMinutes}:00
          </b>
        </div>
        <div className="pc-form-row pc-two-col">
          <MetricBox label="Asset Pair" value="BTC/USDC" />
          <MetricBox label="Direction" value={round.direction} tone="mint" />
        </div>
      </div>
      <div className="pc-form-row pc-two-col">
        <MetricBox label="Max Loss" value={`-${round.suggestedDusdc} DUSDC`} tone="error" />
        <MetricBox
          label="Potential Payout"
          value={`+${formatUsd(round.suggestedDusdc * 2.5)} DUSDC`}
          tone="mint"
        />
      </div>
    </ModalBody>
  )
}

function ScallopBorrowModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalBody
      footer={
        <>
          <button className="pc-button pc-button-secondary" type="button">
            Preview Borrow
          </button>
          <button className="pc-button pc-button-primary" type="button" onClick={onClose}>
            Continue to Wallet <Icon name="arrow_forward" />
          </button>
        </>
      }
    >
      <AmountInput label="Collateral" target="Balance: 12,450 SUI" asset="SUI" value="5000" />
      <AmountInput label="Borrow" target="Max: 2,526 USDC" asset="USDC" value="1500" />
      <div className="pc-form-row pc-two-col">
        <MetricBox label="Health Factor" value="1.85" tone="mint" />
        <MetricBox label="Borrow APY" value="6.45%" />
      </div>
    </ModalBody>
  )
}

function SimpleModalBody({
  modal,
  club,
  offer,
  onClose,
}: {
  modal: ModalKind
  club: ClubState
  offer: EscrowOfferView | null
  onClose: () => void
}) {
  const isFill = modal === 'fill-escrow'
  return (
    <ModalBody
      footer={
        <>
          <button className="pc-button pc-button-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="pc-button pc-button-primary" type="button" onClick={onClose}>
            {isFill ? 'Fill Offer' : 'Claim'}
          </button>
        </>
      }
    >
      {isFill ? (
        <>
          <DataRow label="Offer" value={offer?.id ?? 'Selected offer'} />
          <DataRow
            label="You pay"
            value={offer ? `${formatUsd(offer.wantAmount)} ${offer.wantAsset}` : '-'}
          />
          <DataRow
            label="You receive"
            value={offer ? `${formatUsd(offer.offerAmount)} ${offer.offerAsset}` : '-'}
          />
        </>
      ) : (
        <>
          <DataRow label="Settled round" value={club.history[0]?.id ?? 'ROUND-041'} />
          <DataRow label="Position result" value="Won" tone="mint" />
          <DataRow label="Claimable" value="188.40 DUSDC" />
        </>
      )}
    </ModalBody>
  )
}

/* ─── Tiny modal sub-components ─── */

function DataRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'mint' | 'error'
}) {
  return (
    <div className="pc-data-row">
      <span>{label}</span>
      <strong className={tone ? `pc-tone-${tone}` : ''}>{value}</strong>
    </div>
  )
}

function MetricBox({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'mint' | 'amber' | 'error'
}) {
  return (
    <div className="pc-metric-box">
      <span>{label}</span>
      <strong className={tone ? `pc-tone-${tone}` : ''}>{value}</strong>
    </div>
  )
}

function InputField({
  label,
  value,
  type = 'text',
  readOnly,
  icon,
}: {
  label: string
  value: string
  type?: string
  readOnly?: boolean
  icon?: string
}) {
  return (
    <label className="pc-field">
      <span>{label}</span>
      <div className="pc-input-shell">
        {icon ? <Icon name={icon} /> : null}
        <input defaultValue={value} readOnly={readOnly} type={type} />
      </div>
    </label>
  )
}

function SegmentedField({
  label,
  options,
  active,
  wide,
}: {
  label: string
  options: string[]
  active: string
  wide?: boolean
}) {
  return (
    <div className={`pc-field ${wide ? 'pc-wide' : ''}`}>
      <span>{label}</span>
      <div className="pc-segmented">
        {options.map((option) => (
          <button className={option === active ? 'pc-active' : ''} key={option} type="button">
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function AmountInput({
  label,
  target,
  asset,
  value,
}: {
  label: string
  target: string
  asset: string
  value: string
}) {
  return (
    <div className="pc-field pc-wide">
      <div className="pc-field-line">
        <span>{label}</span>
        <em>{target}</em>
      </div>
      <div className="pc-amount-input">
        <strong>{asset}</strong>
        <input defaultValue={value} type="number" />
        <button type="button">MAX</button>
      </div>
    </div>
  )
}

function modalTitle(modal: ModalKind) {
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

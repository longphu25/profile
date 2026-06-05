import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { recommendFundingRoute } from '../application/recommendFundingRoute'
import { loadClubState, saveClubState } from '../data/localClubStore'
import { subscribeOracle, getSnapshot } from '../infrastructure/deepbookOracleService'
import { OrderFlowChart } from './OrderFlowChart'
import type {
  AssetBalances,
  ClubState,
  EscrowOfferView,
  ModalKind,
  RoundStatus,
} from '../domain/types'
import type { SuiContext, SuiHostAPI } from '../../../src/sui-dashboard/sui-types'

interface PredictClubRootProps {
  host: SuiHostAPI | null
}

const defaultContext: SuiContext = {
  address: null,
  network: 'testnet',
  isConnected: false,
  accounts: [],
}

const mobileTabs = ['clubs', 'predict', 'execution', 'funding', 'account'] as const
type MobileTab = (typeof mobileTabs)[number]

export function PredictClubRoot({ host }: PredictClubRootProps) {
  const [club, setClub] = useState<ClubState>(() => loadClubState())
  const [modal, setModal] = useState<ModalKind | null>(null)
  const [selectedOffer, setSelectedOffer] = useState<EscrowOfferView | null>(null)
  const [context, setContext] = useState<SuiContext>(() => host?.getSuiContext() ?? defaultContext)
  const [mobileTab, setMobileTab] = useState<MobileTab>('clubs')
  const [balances, setBalances] = useState<AssetBalances>({ sui: 0, usdc: 0, dusdc: 0 })

  const oracleSnapshot = useSyncExternalStore(subscribeOracle, getSnapshot)

  useEffect(() => {
    if (!host) return undefined
    setContext(host.getSuiContext())
    return host.onSuiContextChange((ctx) => {
      setContext(ctx)
      if (ctx.isConnected && ctx.address) {
        import('../infrastructure/walletBalanceService').then(({ fetchWalletBalances }) => {
          fetchWalletBalances(ctx.address!)
            .then(setBalances)
            .catch(() => {})
        })
      } else {
        setBalances({ sui: 0, usdc: 0, dusdc: 0 })
      }
    })
  }, [host])

  useEffect(() => {
    saveClubState(club)
  }, [club])

  const round = club.activeRound
  const funding = useMemo(() => recommendFundingRoute(balances, round), [balances, round])
  const isLeader =
    context.isConnected && context.address
      ? club.members.some(
          (m) =>
            m.role === 'leader' &&
            m.wallet.toLowerCase().includes(context.address!.slice(-6).toLowerCase()),
        )
      : false

  const primary = useMemo(() => {
    if (!context.isConnected)
      return { label: 'Connect Wallet', action: () => host?.requestConnect() }
    if (round.status === 'settled')
      return { label: 'Claim Settlement', action: () => setModal('claim-settlement') }
    if (round.status === 'confirmed' || round.status === 'funding') {
      if (balances.dusdc < round.suggestedDusdc) {
        return { label: 'Fund to Join', action: () => setModal('fund-to-join') }
      }
      return { label: 'Execute Trade', action: () => setModal('execute-trade') }
    }
    if (isLeader) return { label: 'Leader Confirm', action: () => updateRoundStatus('confirmed') }
    return { label: 'Accept Signal', action: () => updateRoundStatus('funding') }
  }, [context.isConnected, host, isLeader, round.status, round.suggestedDusdc, balances.dusdc])

  function updateRoundStatus(status: RoundStatus) {
    setClub((current) => ({ ...current, activeRound: { ...current.activeRound, status } }))
  }

  function openFillOffer(offer: EscrowOfferView) {
    setSelectedOffer(offer)
    setModal('fill-escrow')
  }

  return (
    <div className="pc-root pc-root--full">
      <DecisionStrip
        club={club}
        fundingLabel={funding.label}
        onPrimary={primary.action}
        primaryLabel={primary.label}
      />

      <main className="pc-viewport">
        <ClubColumn
          club={club}
          mobileTab={mobileTab}
          onCreateRound={() => setModal('create-round')}
        />
        <PredictionRoom club={club} mobileTab={mobileTab} oraclePrices={oracleSnapshot.prices} />
        <RiskExecutionColumn
          club={club}
          connected={context.isConnected}
          fundingRoute={funding.route}
          mobileTab={mobileTab}
          onPrimary={primary.action}
          primaryLabel={primary.label}
        />
      </main>

      <section className={`pc-bottom ${mobileTab === 'funding' ? 'pc-mobile-show' : ''}`}>
        <FundingRouter onOpenModal={setModal} />
        <EscrowOffers
          offers={club.escrowOffers}
          onCreate={() => setModal('create-escrow')}
          onFill={openFillOffer}
        />
        <RoundHistory club={club} />
      </section>

      <MobileNav active={mobileTab} onChange={setMobileTab} />

      {modal ? (
        <PredictClubModal modal={modal} onClose={() => setModal(null)}>
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
        </PredictClubModal>
      ) : null}
    </div>
  )
}

function DecisionStrip({
  club,
  fundingLabel,
  primaryLabel,
  onPrimary,
}: {
  club: ClubState
  fundingLabel: string
  primaryLabel: string
  onPrimary: () => void
}) {
  const round = club.activeRound
  return (
    <section className="pc-decision-strip">
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
          onClick={onPrimary}
        >
          {primaryLabel}
        </button>
        <span className="pc-funding-note">{fundingLabel}</span>
      </div>
    </section>
  )
}

function ClubColumn({
  club,
  mobileTab,
  onCreateRound,
}: {
  club: ClubState
  mobileTab: MobileTab
  onCreateRound: () => void
}) {
  const visible = mobileTab === 'clubs'
  return (
    <aside className={`pc-column pc-club-column ${visible ? 'pc-mobile-show' : ''}`}>
      <header className="pc-panel-header">
        <div>
          <h2>{club.name}</h2>
          <p>
            <Icon name="military_tech" /> Leader: <span>{club.leaderName}</span>
          </p>
        </div>
        <button
          className="pc-icon-button"
          type="button"
          onClick={onCreateRound}
          aria-label="Create prediction round"
        >
          <Icon name="add" />
        </button>
      </header>
      <div className="pc-member-bar">
        <span>Members ({club.members.length})</span>
        <span>Status</span>
      </div>
      <ul className="pc-member-list">
        {club.members.map((member) => (
          <li key={member.id}>
            <div className="pc-member-id">
              <span>{member.name.charAt(0)}</span>
              <strong>{member.name}</strong>
            </div>
            <em className={`pc-member-state pc-member-state-${member.state}`}>
              {labelize(member.state)}
            </em>
          </li>
        ))}
      </ul>
      <article className="pc-thesis-card">
        <span>Leader Thesis</span>
        <time>12m ago</time>
        <p>{club.activeRound.thesis}</p>
      </article>
    </aside>
  )
}

function PredictionRoom({
  club,
  mobileTab,
  oraclePrices,
}: {
  club: ClubState
  mobileTab: MobileTab
  oraclePrices: import('../infrastructure/deepbookOracleService').OraclePrice[]
}) {
  const round = club.activeRound
  const visible = mobileTab === 'predict'
  return (
    <section className={`pc-column pc-room-column ${visible ? 'pc-mobile-show' : ''}`}>
      <header className="pc-panel-header pc-room-header">
        <h2>
          <Icon name="analytics" /> Prediction Room
        </h2>
        <span>Phase: {round.status}</span>
      </header>
      <div className="pc-room-body">
        <div className="pc-indicator-grid">
          {round.indicators.slice(0, 6).map((indicator) => (
            <article key={indicator.id}>
              <span>{indicator.name}</span>
              <strong className={`pc-tone-${indicator.state}`}>{indicator.value}</strong>
            </article>
          ))}
        </div>
        <div className="pc-chart-shell">
          <OrderFlowChart prices={oraclePrices} />
        </div>
      </div>
    </section>
  )
}

function RiskExecutionColumn({
  club,
  connected,
  fundingRoute,
  mobileTab,
  onPrimary,
  primaryLabel,
}: {
  club: ClubState
  connected: boolean
  fundingRoute: string
  mobileTab: MobileTab
  onPrimary: () => void
  primaryLabel: string
}) {
  const round = club.activeRound
  const visible = mobileTab === 'execution'
  const items = [
    ['Signal Received', true],
    ['Club Consensus', true],
    ['Wallet Connected', connected],
    ['Liquidity Sourced', fundingRoute === 'ready-with-dusdc'],
    ['Funds Escrowed', false],
    ['Contract Signed', false],
  ] as const

  return (
    <aside className={`pc-column pc-risk-column ${visible ? 'pc-mobile-show' : ''}`}>
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
          <DataRow label="Your Max Loss" value={`-${round.suggestedDusdc} DUSDC`} tone="error" />
          <DataRow
            label="Est. Payout"
            value={`+${formatUsd(round.suggestedDusdc * 2.5)} DUSDC`}
            tone="mint"
          />
        </section>
        <div className="pc-execute-box">
          <button
            className="pc-button pc-button-primary pc-button-full"
            type="button"
            onClick={onPrimary}
          >
            {primaryLabel}
          </button>
          <p>Awaiting full escrow funding</p>
        </div>
      </div>
    </aside>
  )
}

function FundingRouter({ onOpenModal }: { onOpenModal: (modal: ModalKind) => void }) {
  const nodes = [
    ['Ready', 'Direct Wallet', 'DUSDC', 'fund-to-join'],
    ['Standby', 'Swap', 'DeepBook', 'fund-to-join'],
    ['Standby', 'Borrow', 'Scallop', 'scallop-borrow'],
    ['Pending', 'Escrow', 'Predict P2P', 'create-escrow'],
  ] as const

  return (
    <section className="pc-bottom-panel pc-funding-panel">
      <header>
        <Icon name="route" />
        <span>Funding Router</span>
      </header>
      <div className="pc-route-strip">
        {nodes.map(([state, label, value, modal], index) => (
          <button
            className={`pc-route-node ${index === 0 ? 'pc-route-active' : ''}`}
            key={`${label}-${value}`}
            type="button"
            onClick={() => onOpenModal(modal)}
          >
            <span>{state}</span>
            <em>{label}</em>
            <strong>{value}</strong>
          </button>
        ))}
      </div>
    </section>
  )
}

function EscrowOffers({
  offers,
  onCreate,
  onFill,
}: {
  offers: EscrowOfferView[]
  onCreate: () => void
  onFill: (offer: EscrowOfferView) => void
}) {
  return (
    <section className="pc-bottom-panel pc-escrow-panel">
      <header>
        <span>P2P Escrow Offers</span>
        <button className="pc-link-button" type="button" onClick={onCreate}>
          Create
        </button>
      </header>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Amount</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => (
            <tr key={offer.id} onClick={() => onFill(offer)}>
              <td>{offer.maker}</td>
              <td>
                {formatUsd(offer.offerAmount)} {offer.offerAsset}
              </td>
              <td>{offer.status === 'open' ? '0.05%' : labelize(offer.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function RoundHistory({ club }: { club: ClubState }) {
  return (
    <section className="pc-bottom-panel pc-history-panel">
      <header>
        <span>Club Round History</span>
      </header>
      <table>
        <thead>
          <tr>
            <th>Round</th>
            <th>Asset</th>
            <th>PnL</th>
          </tr>
        </thead>
        <tbody>
          {club.history.map((row) => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>BTC/USDC</td>
              <td className={row.pnlDusdc >= 0 ? 'pc-positive' : 'pc-negative'}>
                {formatSigned(row.pnlDusdc)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function MobileNav({
  active,
  onChange,
}: {
  active: MobileTab
  onChange: (tab: MobileTab) => void
}) {
  const items: Array<[MobileTab, string, string]> = [
    ['clubs', 'groups', 'Clubs'],
    ['predict', 'query_stats', 'Predict'],
    ['execution', 'bolt', 'Execution'],
    ['funding', 'route', 'Funding'],
    ['account', 'person', 'Account'],
  ]

  return (
    <nav className="pc-mobile-nav" aria-label="Predict Club mobile navigation">
      {items.map(([tab, icon, label]) => (
        <button
          className={active === tab ? 'pc-active' : ''}
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
        >
          <Icon name={icon} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

function PredictClubModal({
  modal,
  children,
  onClose,
}: {
  modal: ModalKind
  children: ReactNode
  onClose: () => void
}) {
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
            onClick={onClose}
            aria-label="Close modal"
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
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
      <div className="pc-form-row pc-two-col">
        <SegmentedField
          label="Confidence"
          options={['LOW', 'MED', 'HIGH']}
          active={round.confidence === 'High' ? 'HIGH' : 'MED'}
        />
        <div className="pc-field">
          <span>Indicators</span>
          <div className="pc-chip-row">
            {round.indicators.slice(0, 4).map((item, index) => (
              <button
                className={index === 0 ? 'pc-chip pc-chip-active' : 'pc-chip'}
                key={item.id}
                type="button"
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      </div>
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
        <MetricBox label="DUSDC" value={balances.dusdc.toFixed(2)} muted={balances.dusdc === 0} />
      </div>
      <div className="pc-field pc-wide">
        <span>Funding Route</span>
        <div className="pc-route-select">
          <RouteChoice icon="swap_horiz" title="Native Swap" note="DeepBook V3" active />
          <RouteChoice icon="account_balance" title="Borrow" note="via Scallop" />
          <RouteChoice icon="route" title="Bridge" note="Wormhole" />
          <RouteChoice icon="lock" title="Escrow" note="Club P2P" />
        </div>
      </div>
      <AmountInput
        label="Amount to Fund"
        target={`${club.activeRound.suggestedDusdc}.00 USDC`}
        asset="SUI"
        value="45.2"
        fiat="$98.45 USD"
      />
      <div className="pc-settings-box pc-wide">
        <DataRow label="Slippage Tolerance" value="0.5%" />
        <DataRow label="Preserve for Gas" value="1.5 SUI" />
      </div>
      <CheckNotice text="I acknowledge the risks associated with multi-hop execution. Slippage or collateral value changes may reduce the funded amount." />
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
      <SwapAssetInput
        label="Offer Asset"
        balance="Bal: 1,245.50 DUSDC"
        asset="DUSDC"
        value="500.00"
      />
      <div className="pc-swap-arrow">
        <Icon name="arrow_downward" />
      </div>
      <SwapAssetInput label="Want Asset" asset="USDC" value="480.00" />
      <div className="pc-form-row pc-two-col">
        <InputField
          label="Recipient (Optional)"
          value=""
          placeholder="0x..."
          icon="account_balance_wallet"
        />
        <InputField label="Round ID (Optional)" value={club.activeRound.id} icon="tag" />
      </div>
      <div className="pc-field pc-wide">
        <span>Expiry Time</span>
        <div className="pc-chip-row">
          {['1H', '4H', '12H', '24H', 'Custom'].map((value) => (
            <button
              className={value === '12H' ? 'pc-chip pc-chip-active' : 'pc-chip'}
              key={value}
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
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
          <MetricBox label="Target Strike" value={`$${formatUsd(round.strike)}`} wide />
        </div>
      </div>
      <div className="pc-info-card pc-wide">
        <DataRow label="Amount" value={`${formatUsd(round.totalPledgedDusdc)} DUSDC`} />
        <DataRow label="PredictManager Status" value="Active/Ready" tone="mint" />
        <DataRow label="Oracle Health" value="Healthy" tone="mint" />
      </div>
      <div className="pc-form-row pc-two-col">
        <MetricBox label="Max Loss" value={`-${round.suggestedDusdc} DUSDC`} tone="error" />
        <MetricBox
          label="Potential Payout"
          value={`+${formatUsd(round.suggestedDusdc * 2.5)} DUSDC`}
          tone="mint"
        />
      </div>
      <div className="pc-info-card pc-wide">
        {['Wallet Connected', 'Sufficient DUSDC Balance', 'Oracle Validated', 'Expiry Safe'].map(
          (item) => (
            <div className="pc-check-ok" key={item}>
              <Icon name="check_circle" />
              <span>{item}</span>
            </div>
          ),
        )}
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
      <AmountInput
        label="Collateral Amount"
        target="Balance: 12,450.00 SUI"
        asset="SUI"
        value="5000.00"
        fiat="$4,210.50"
      />
      <div className="pc-swap-arrow">
        <Icon name="arrow_downward" />
      </div>
      <AmountInput
        label="Borrow Amount"
        target="Max Borrow: 2,526.30 USDC"
        asset="USDC"
        value="1500.00"
      />
      <div className="pc-health-card pc-wide">
        <div className="pc-section-title">
          <span>Est. Health Factor</span>
          <b>1.85 Safe</b>
        </div>
        <div className="pc-health-bar">
          <i />
        </div>
        <div className="pc-health-scale">
          <span>0.0</span>
          <span>1.0</span>
          <span>1.5</span>
          <span>3.0+</span>
        </div>
      </div>
      <div className="pc-form-row pc-three-col">
        <MetricBox label="Oracle Status" value="Healthy" tone="mint" />
        <MetricBox label="Liq. Price" value="$0.42 SUI" tone="amber" />
        <MetricBox label="Borrow APY" value="6.45%" />
      </div>
      <CheckNotice
        text="I understand that my SUI collateral may be liquidated by the protocol if the health factor drops below 1.0."
        warning
      />
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
          <DataRow label="Expiry" value={offer?.expiry ?? '-'} />
        </>
      ) : (
        <>
          <DataRow label="Settled round" value={club.history[0]?.id ?? 'ROUND-041'} />
          <DataRow label="Position result" value="Won" tone="mint" />
          <DataRow label="Claimable amount" value="188.40 DUSDC" />
          <DataRow label="Keeper option" value="Available" />
        </>
      )}
    </ModalBody>
  )
}

function ModalBody({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <>
      <div className="pc-modal-body">{children}</div>
      <footer className="pc-modal-footer">{footer}</footer>
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

function DataRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'mint' | 'amber' | 'error'
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
  muted,
  wide,
}: {
  label: string
  value: string
  tone?: 'mint' | 'amber' | 'error'
  muted?: boolean
  wide?: boolean
}) {
  return (
    <div className={`pc-metric-box ${muted ? 'pc-muted' : ''} ${wide ? 'pc-wide' : ''}`}>
      <span>{label}</span>
      <strong className={tone ? `pc-tone-${tone}` : ''}>{value}</strong>
    </div>
  )
}

function InputField({
  label,
  value,
  type = 'text',
  placeholder,
  readOnly,
  icon,
}: {
  label: string
  value: string
  type?: string
  placeholder?: string
  readOnly?: boolean
  icon?: string
}) {
  return (
    <label className="pc-field">
      <span>{label}</span>
      <div className="pc-input-shell">
        {icon ? <Icon name={icon} /> : null}
        <input defaultValue={value} placeholder={placeholder} readOnly={readOnly} type={type} />
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

function RouteChoice({
  icon,
  title,
  note,
  active = false,
}: {
  icon: string
  title: string
  note: string
  active?: boolean
}) {
  return (
    <label className={active ? 'pc-route-choice pc-active' : 'pc-route-choice'}>
      <input defaultChecked={active} name="funding_route" type="radio" />
      <Icon name={icon} />
      <strong>{title}</strong>
      <span>{note}</span>
    </label>
  )
}

function AmountInput({
  label,
  target,
  asset,
  value,
  fiat,
}: {
  label: string
  target: string
  asset: string
  value: string
  fiat?: string
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
      {fiat ? <small>{fiat}</small> : null}
    </div>
  )
}

function SwapAssetInput({
  label,
  balance,
  asset,
  value,
}: {
  label: string
  balance?: string
  asset: string
  value: string
}) {
  return (
    <div className="pc-field pc-wide">
      <div className="pc-field-line">
        <span>{label}</span>
        {balance ? <em>{balance}</em> : null}
      </div>
      <div className="pc-swap-input">
        <button type="button">
          <b>{asset.charAt(0)}</b>
          {asset}
          <Icon name="expand_more" />
        </button>
        <input defaultValue={value} />
        <button type="button">MAX</button>
      </div>
    </div>
  )
}

function CheckNotice({ text, warning = false }: { text: string; warning?: boolean }) {
  return (
    <label className={`pc-check-notice pc-wide ${warning ? 'pc-warning' : ''}`}>
      <input type="checkbox" />
      <span>{text}</span>
    </label>
  )
}

function Divider() {
  return <i className="pc-divider" />
}

function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {name}
    </span>
  )
}

function modalTitle(modal: ModalKind) {
  return {
    'create-round': 'Create Prediction Round',
    'fund-to-join': 'Fund to Join',
    'create-escrow': 'Create Escrow Offer',
    'fill-escrow': 'Fill Escrow Offer',
    'scallop-borrow': 'Scallop Borrow USDC',
    'execute-trade': 'Execute My Trade',
    'claim-settlement': 'Claim Settlement',
  }[modal]
}

function labelize(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value > 1000 ? 0 : 2,
  }).format(value)
}

function formatSigned(value: number) {
  const formatted = `${value >= 0 ? '+' : ''}${formatUsd(value)}`
  return `${formatted} DUSDC`
}

import { usePredictClub } from './PredictClubContext'
import { formatUsd } from './shared'
import { computePayoutPreview } from '../domain/payoutPreview'
import type { ModalKind } from '../domain/types'
import { demoClubState } from '../domain/fixtures'

export function ModalLayer() {
  const { modal, setModal } = usePredictClub()
  if (!modal) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-md sm:p-lg"
      onClick={() => setModal(null)}
    >
      <div
        className="w-full max-w-2xl bg-surface-container border border-outline-variant rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-md border-b border-outline-variant bg-surface-container-high">
          <h2 className="font-headline text-headline-md text-on-surface">{modalTitle(modal)}</h2>
          <button
            className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            onClick={() => setModal(null)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {/* Body */}
        <div className="p-lg overflow-y-auto flex-1 flex flex-col gap-xl">
          <ModalBodyContent modal={modal} />
        </div>
        {/* Footer */}
        <div className="p-md border-t border-outline-variant bg-surface-container-high flex justify-end gap-md">
          <ModalFooterContent modal={modal} />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════ MODAL BODIES ═══════════════════════ */

function ModalBodyContent({ modal }: { modal: ModalKind }) {
  switch (modal) {
    case 'create-round':
      return <CreateRoundBody />
    case 'fund-to-join':
      return <FundToJoinBody />
    case 'execute-trade':
      return <ExecuteTradeBody />
    case 'create-escrow':
      return <CreateEscrowBody />
    case 'fill-escrow':
      return <FillEscrowBody />
    case 'scallop-borrow':
      return <ScallopBorrowBody />
    case 'claim-settlement':
      return <ClaimSettlementBody />
    default:
      return null
  }
}

/* ─── Create Prediction Round ─── */
function CreateRoundBody() {
  const { club } = usePredictClub()
  const round = club.activeRound
  return (
    <>
      {/* Oracle & Asset */}
      <div className="flex gap-md">
        <div className="flex-1 flex flex-col gap-sm">
          <Label>Oracle</Label>
          <div className="flex rounded bg-surface border border-outline-variant">
            <button
              className="flex-1 py-sm font-data text-data-md bg-secondary-container text-primary-fixed rounded-l border-r border-outline-variant"
              type="button"
            >
              PYTH
            </button>
            <button
              className="flex-1 py-sm font-data text-data-md text-on-surface-variant hover:text-primary transition-colors rounded-r"
              type="button"
            >
              SWITCHBOARD
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-sm">
          <Label>Asset Pair</Label>
          <InputBox value="SUI/USDC" readOnly icon="keyboard_arrow_down" />
        </div>
      </div>
      {/* Direction */}
      <div className="flex flex-col gap-sm">
        <Label>Direction Thesis</Label>
        <div className="flex gap-[1px] bg-outline-variant rounded border border-outline-variant overflow-hidden">
          <button
            className={`flex-1 py-sm font-headline text-headline-md transition-colors ${round.direction === 'UP' ? 'bg-secondary-container text-primary-fixed border-b-2 border-primary-fixed' : 'bg-surface text-primary-fixed-dim hover:bg-surface-bright'}`}
            type="button"
          >
            UP
          </button>
          <button
            className={`flex-1 py-sm font-headline text-headline-md transition-colors ${round.direction === 'DOWN' ? 'bg-secondary-container text-error border-b-2 border-error' : 'bg-surface text-error hover:bg-surface-bright'}`}
            type="button"
          >
            DOWN
          </button>
          <button
            className={`flex-1 py-sm font-headline text-headline-md transition-colors ${round.direction === 'RANGE' ? 'bg-secondary-container text-primary-fixed border-b-2 border-primary-fixed' : 'bg-surface text-on-surface-variant hover:bg-surface-bright'}`}
            type="button"
          >
            RANGE
          </button>
        </div>
      </div>
      {/* Parameters Grid */}
      <div className="grid grid-cols-2 gap-md">
        <InputField
          label="Lower Bound (USDC)"
          value={String(round.lowerStrike ?? round.strike - 200)}
        />
        <InputField label="Upper Bound (USDC)" value={String(round.upperStrike ?? round.strike)} />
        <InputField label="Expiry" value="2026-06-04T14:00" type="datetime-local" />
        <InputField label="Suggested Size (DUSDC)" value={String(round.suggestedDusdc)} />
      </div>
      {/* Leader Thesis */}
      <div className="flex flex-col gap-sm">
        <Label>Leader Thesis (Optional)</Label>
        <div className="rounded border border-outline-variant bg-surface overflow-hidden focus-within:border-primary-fixed-dim focus-within:shadow-[0_0_8px_rgba(0,224,179,0.2)]">
          <textarea
            className="w-full bg-transparent border-none outline-none p-md font-body text-body-sm text-on-surface resize-none"
            placeholder="Explain your rationale..."
            rows={3}
            defaultValue={round.thesis}
          />
        </div>
      </div>
      {/* Confidence & Indicators */}
      <div className="flex gap-md">
        <div className="flex-1 flex flex-col gap-sm">
          <Label>Confidence</Label>
          <div className="flex rounded bg-surface border border-outline-variant overflow-hidden">
            <button
              className="flex-1 py-xs font-data text-data-sm text-on-surface-variant hover:bg-surface-bright border-r border-outline-variant"
              type="button"
            >
              LOW
            </button>
            <button
              className="flex-1 py-xs font-data text-data-sm bg-secondary-container text-primary-fixed border-r border-outline-variant"
              type="button"
            >
              MED
            </button>
            <button
              className="flex-1 py-xs font-data text-data-sm text-on-surface-variant hover:bg-surface-bright"
              type="button"
            >
              HIGH
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-sm">
          <Label>Indicators</Label>
          <div className="flex flex-wrap gap-xs">
            {round.indicators.slice(0, 4).map((ind, i) => (
              <button
                key={ind.id}
                className={`px-sm py-xs border rounded font-data text-data-sm ${i === 0 ? 'border-primary-fixed-dim text-primary-fixed-dim bg-primary-fixed-dim/10' : 'border-outline-variant text-on-surface-variant hover:border-outline'}`}
                type="button"
              >
                {ind.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Fund to Join ─── */
function FundToJoinBody() {
  const { balances, club } = usePredictClub()
  return (
    <>
      {/* Balances */}
      <div className="flex flex-col gap-sm">
        <Label>Available Balances</Label>
        <div className="grid grid-cols-3 gap-xs">
          <BalanceCard label="SUI" value={balances.sui.toFixed(2)} />
          <BalanceCard label="USDC" value={balances.usdc.toFixed(2)} />
          <BalanceCard
            label="DUSDC"
            value={balances.dusdc.toFixed(2)}
            dimmed={balances.dusdc === 0}
          />
        </div>
      </div>
      {/* Funding Route */}
      <div className="flex flex-col gap-sm">
        <div className="flex justify-between items-baseline">
          <Label>Funding Route</Label>
          <span className="font-data text-data-sm text-primary-fixed-dim flex items-center gap-xs">
            <span className="material-symbols-outlined text-[14px]">info</span> Auto-detect
          </span>
        </div>
        <div className="grid grid-cols-2 gap-sm">
          <RouteCard icon="swap_horiz" title="Native Swap" note="DeepBook V3" active />
          <RouteCard icon="account_balance" title="Borrow" note="via Scallop" />
          <RouteCard icon="route" title="Bridge" note="Wormhole" />
          <RouteCard icon="lock" title="Escrow" note="Club P2P" />
        </div>
      </div>
      {/* Amount Input */}
      <div className="flex flex-col gap-sm">
        <div className="flex justify-between items-baseline">
          <Label>Amount to Fund</Label>
          <span className="font-data text-data-sm text-on-surface-variant">
            Target: <span className="text-primary">{club.activeRound.suggestedDusdc}.00 USDC</span>
          </span>
        </div>
        <div className="flex items-center bg-background border border-outline-variant rounded px-md py-sm focus-within:border-primary-fixed-dim focus-within:ring-1 focus-within:ring-primary-fixed-dim/30">
          <div className="flex items-center gap-sm pr-md border-r border-outline-variant mr-md">
            <span className="w-6 h-6 rounded-full bg-[#3898FF] flex items-center justify-center text-[10px] font-bold text-white">
              SUI
            </span>
            <span className="font-label text-label-caps text-on-surface">SUI</span>
          </div>
          <input
            className="w-full bg-transparent border-none outline-none font-data text-data-lg text-primary text-right"
            type="number"
            defaultValue="45.2"
          />
          <button
            className="ml-md font-label text-label-caps text-primary-fixed-dim hover:text-primary-fixed"
            type="button"
          >
            MAX
          </button>
        </div>
        <div className="flex justify-end font-data text-data-sm text-on-surface-variant">
          ≈ $98.45 USD
        </div>
      </div>
      {/* Settings */}
      <div className="bg-surface-container-low border border-outline-variant p-md rounded flex flex-col gap-md">
        <div className="flex items-center justify-between">
          <span className="font-body text-body-sm text-on-surface-variant">Slippage Tolerance</span>
          <div className="flex bg-background border border-outline-variant rounded p-[2px]">
            <button
              className="px-sm py-xs font-data text-data-sm text-on-surface-variant"
              type="button"
            >
              0.1%
            </button>
            <button
              className="px-sm py-xs font-data text-data-sm bg-surface-bright text-primary rounded shadow-sm"
              type="button"
            >
              0.5%
            </button>
            <button
              className="px-sm py-xs font-data text-data-sm text-on-surface-variant"
              type="button"
            >
              1.0%
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between pt-md border-t border-outline-variant">
          <span className="font-body text-body-sm text-on-surface-variant">Preserve for Gas</span>
          <span className="font-data text-data-sm text-primary">1.5 SUI</span>
        </div>
      </div>
      {/* Risk Acknowledgment */}
      <label className="flex items-start gap-md cursor-pointer group">
        <input
          type="checkbox"
          className="mt-1 w-4 h-4 border border-outline-variant rounded-sm bg-background accent-primary-fixed"
        />
        <span className="font-body text-body-sm text-on-surface-variant leading-relaxed group-hover:text-on-surface">
          I acknowledge the risks associated with multi-hop execution. Slippage or collateral value
          changes may reduce the funded amount.
        </span>
      </label>
    </>
  )
}

/* ─── Execute My Trade ─── */
function ExecuteTradeBody() {
  const { club, oracleSnapshot } = usePredictClub()
  const round = club.activeRound
  const payoutPreview = computePayoutPreview({
    direction: round.direction,
    strike: round.strike,
    lowerStrike: round.lowerStrike,
    upperStrike: round.upperStrike,
    amountDusdc: round.suggestedDusdc,
    forward: oracleSnapshot.oracleState?.latest_price?.forward,
    expiry: oracleSnapshot.oracleState?.expiry,
    svi: oracleSnapshot.oracleState?.latest_svi,
  })
  return (
    <>
      {/* Round Summary */}
      <div className="border border-outline-variant bg-surface-container p-sm flex flex-col">
        <div className="font-label text-label-caps text-on-surface-variant mb-xs flex justify-between items-center">
          <span>Round Summary</span>
          <span className="font-data text-data-sm text-primary-fixed-dim flex items-center gap-xs">
            <span className="material-symbols-outlined text-[14px]">timer</span>{' '}
            {round.expiryMinutes}:00
          </span>
        </div>
        <div className="grid grid-cols-2 gap-sm">
          <div>
            <div className="font-label text-label-caps text-on-surface-variant/70 uppercase">
              Asset Pair
            </div>
            <div className="font-data text-data-lg text-on-surface">BTC/USDC</div>
          </div>
          <div>
            <div className="font-label text-label-caps text-on-surface-variant/70 uppercase">
              Direction
            </div>
            <div className="font-data text-data-lg text-primary-fixed-dim flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px]">trending_up</span>{' '}
              {round.direction}
            </div>
          </div>
          <div className="col-span-2 border-t border-outline-variant/50 pt-xs mt-xs flex justify-between items-end">
            <div className="font-label text-label-caps text-on-surface-variant/70 uppercase">
              Target Strike
            </div>
            <div className="font-data text-data-lg text-on-surface">${formatUsd(round.strike)}</div>
          </div>
        </div>
      </div>
      {/* Position Details */}
      <div className="border border-outline-variant bg-surface-container p-sm flex flex-col gap-xs">
        <div className="font-label text-label-caps text-on-surface-variant mb-xs">
          Position Details
        </div>
        <Row label="Amount" value={`${formatUsd(round.totalPledgedDusdc)} DUSDC`} />
        <Row label="PredictManager Status">
          <div className="flex items-center gap-xs border border-primary-fixed-dim/30 bg-primary-fixed-dim/10 px-xs py-[2px] rounded">
            <div className="w-2 h-2 rounded-full bg-primary-fixed-dim animate-pulse" />
            <span className="font-data text-data-sm text-primary-fixed-dim uppercase">
              Active/Ready
            </span>
          </div>
        </Row>
        <Row label="Oracle Health">
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-[14px] text-primary-fixed-dim">
              verified
            </span>
            <span className="font-data text-data-sm uppercase text-on-surface">Healthy</span>
          </div>
        </Row>
      </div>
      {/* Risk Assessment */}
      <div className="flex gap-sm">
        <div className="flex-1 border border-error/30 bg-error/5 p-sm flex flex-col">
          <div className="font-label text-label-caps text-error mb-xs">Max Loss</div>
          <div className="font-data text-data-lg text-error">-{round.suggestedDusdc} DUSDC</div>
        </div>
        <div className="flex-1 border border-primary-fixed-dim/30 bg-primary-fixed-dim/5 p-sm flex flex-col">
          <div className="font-label text-label-caps text-primary-fixed-dim mb-xs">
            Indicative Payout
          </div>
          {payoutPreview.indicativePayout ? (
            <div className="font-data text-data-lg text-primary-fixed-dim">
              +{formatUsd(payoutPreview.indicativePayout)} DUSDC
            </div>
          ) : (
            <div className="font-data text-data-sm text-on-surface-variant">
              {payoutPreview.reason ?? 'Pricing preview unavailable'}
            </div>
          )}
        </div>
      </div>
      {/* Checklist */}
      <div className="border border-outline-variant bg-surface-container p-sm flex flex-col gap-xs">
        <div className="font-label text-label-caps text-on-surface-variant mb-xs">
          Transaction Checklist
        </div>
        {['Wallet Connected', 'Sufficient DUSDC Balance', 'Oracle Validated', 'Expiry Safe'].map(
          (item) => (
            <div
              key={item}
              className="flex items-center gap-sm font-data text-data-sm text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">
                check_circle
              </span>
              {item}
            </div>
          ),
        )}
      </div>
    </>
  )
}

/* ─── Create Escrow Offer ─── */
function CreateEscrowBody() {
  return (
    <>
      {/* Offer Asset */}
      <div className="flex flex-col gap-sm">
        <div className="flex justify-between items-end">
          <Label>Offer Asset</Label>
          <span className="font-data text-data-sm text-on-surface-variant">
            Bal: 1,245.50 DUSDC
          </span>
        </div>
        <SwapInput asset="DUSDC" value="500.00" />
      </div>
      {/* Arrow */}
      <div className="flex justify-center -my-sm relative z-10">
        <div className="bg-surface-container-highest border border-outline-variant rounded-full p-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
        </div>
      </div>
      {/* Want Asset */}
      <div className="flex flex-col gap-sm">
        <Label>Want Asset</Label>
        <SwapInput asset="USDC" value="480.00" />
      </div>
      {/* Optional Fields */}
      <div className="grid grid-cols-2 gap-md">
        <InputField
          label="Recipient (Optional)"
          value=""
          placeholder="0x..."
          icon="account_balance_wallet"
        />
        <InputField label="Round ID (Optional)" value="" placeholder="e.g. 1409" icon="tag" />
      </div>
      {/* Expiry */}
      <div className="flex flex-col gap-sm border-t border-outline-variant/30 pt-sm">
        <Label>Expiry Time</Label>
        <div className="flex flex-wrap gap-sm">
          {['1H', '4H', '12H', '24H', 'Custom'].map((t) => (
            <button
              key={t}
              className={`px-md py-xs rounded-full border font-label text-label-caps transition-colors cursor-pointer ${t === '12H' ? 'border-primary-fixed bg-secondary-container/50 text-primary-fixed' : 'border-outline-variant text-on-surface-variant hover:border-primary-fixed'}`}
              type="button"
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {/* Summary */}
      <div className="bg-surface-container-highest border border-outline-variant rounded-xl p-md flex justify-between items-center">
        <span className="font-body text-body-sm text-on-surface-variant">Exchange Rate</span>
        <span className="font-data text-data-md text-primary-fixed">1 DUSDC = 0.96 USDC</span>
      </div>
    </>
  )
}

/* ─── Fill Escrow ─── */
function FillEscrowBody() {
  const { selectedOffer } = usePredictClub()
  return (
    <>
      <Row label="Offer ID" value={selectedOffer?.id ?? '-'} />
      <Row
        label="You Pay"
        value={
          selectedOffer ? `${formatUsd(selectedOffer.wantAmount)} ${selectedOffer.wantAsset}` : '-'
        }
      />
      <Row
        label="You Receive"
        value={
          selectedOffer
            ? `${formatUsd(selectedOffer.offerAmount)} ${selectedOffer.offerAsset}`
            : '-'
        }
        tone="mint"
      />
      <Row label="Expiry" value={selectedOffer?.expiry ?? '-'} />
    </>
  )
}

/* ─── Scallop Borrow USDC ─── */
function ScallopBorrowBody() {
  return (
    <>
      {/* Collateral Input */}
      <div className="flex flex-col gap-xs">
        <div className="flex justify-between items-center px-xs">
          <Label>Collateral Amount</Label>
          <span className="font-data text-data-sm text-on-surface">Balance: 12,450.00 SUI</span>
        </div>
        <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded px-md py-sm focus-within:border-primary-fixed-dim focus-within:ring-1 focus-within:ring-primary-fixed-dim/30">
          <input
            className="bg-transparent w-full outline-none font-data text-data-lg text-primary"
            defaultValue="5000.00"
          />
          <div className="flex items-center gap-sm ml-2 border-l border-outline-variant pl-sm">
            <button className="font-label text-label-caps text-primary-fixed-dim" type="button">
              MAX
            </button>
            <span className="font-body text-body-base text-on-surface">SUI</span>
          </div>
        </div>
        <span className="font-data text-data-sm text-on-surface-variant px-xs">≈ $4,210.50</span>
      </div>
      {/* Arrow */}
      <div className="flex justify-center -my-sm relative z-10">
        <div className="bg-surface border border-outline-variant rounded-full p-xs text-outline">
          <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
        </div>
      </div>
      {/* Borrow Input */}
      <div className="flex flex-col gap-xs">
        <div className="flex justify-between items-center px-xs">
          <Label>Borrow Amount</Label>
          <span className="font-data text-data-sm text-primary-fixed-dim">Max: 2,526.30 USDC</span>
        </div>
        <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded px-md py-sm focus-within:border-primary-fixed-dim">
          <input
            className="bg-transparent w-full outline-none font-data text-data-lg text-primary"
            defaultValue="1500.00"
          />
          <span className="font-body text-body-base text-on-surface ml-2 border-l border-outline-variant pl-sm">
            USDC
          </span>
        </div>
      </div>
      {/* Health Factor */}
      <div className="flex flex-col gap-sm bg-surface-container-low border border-outline-variant rounded p-md">
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-xs">
            <Label>Est. Health Factor</Label>
            <span className="font-headline text-headline-md text-primary-fixed-dim">1.85</span>
          </div>
          <span className="font-label text-label-caps text-primary-fixed">Safe</span>
        </div>
        {/* Gauge */}
        <div className="relative w-full h-[6px] rounded-full overflow-hidden flex mt-xs">
          <div className="h-full bg-error" style={{ width: '25%' }} />
          <div className="h-full bg-tertiary-container" style={{ width: '25%' }} />
          <div className="h-full bg-primary-fixed-dim/40" style={{ width: '50%' }} />
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_8px_rgba(253,255,252,0.8)]"
            style={{ left: '65%' }}
          />
        </div>
        <div className="flex justify-between font-data text-data-sm text-on-surface-variant/50 text-[10px]">
          <span>0.0</span>
          <span>1.0</span>
          <span>1.5</span>
          <span>3.0+</span>
        </div>
      </div>
      {/* Metrics */}
      <div className="grid grid-cols-3 gap-[1px] bg-outline-variant border border-outline-variant rounded overflow-hidden">
        <MetricCell label="Oracle Status" value="Healthy" tone="mint" pulse />
        <MetricCell label="Liq. Price" value="≈ $0.42 SUI" tone="amber" />
        <MetricCell label="Borrow APY" value="6.45%" />
      </div>
      {/* Warning */}
      <label className="flex items-start gap-sm p-sm border border-tertiary-fixed/30 bg-tertiary-fixed/5 rounded cursor-pointer group">
        <input
          type="checkbox"
          className="mt-[2px] w-4 h-4 border border-tertiary-fixed rounded-sm bg-transparent accent-tertiary-fixed"
        />
        <p className="font-body text-body-sm text-on-surface/90 leading-relaxed">
          I understand that my SUI collateral may be liquidated by the protocol if the health factor
          drops below 1.0.
        </p>
      </label>
    </>
  )
}

/* ─── Claim Settlement ─── */
function ClaimSettlementBody() {
  const { club } = usePredictClub()
  const round = club.activeRound
  const claimable = club.claims.find((claim) => claim.roundId === round.id)
  return (
    <>
      <Row label="Round" value={round.id} />
      <Row label="Result" value="Won" tone="mint" />
      <Row
        label="Claimable Amount"
        value={claimable ? `${formatUsd(claimable.amountDusdc)} DUSDC` : 'Pending settlement'}
        tone="mint"
      />
      <Row label="Keeper Option" value="Available" />
    </>
  )
}

/* ═══════════════════════ MODAL FOOTERS ═══════════════════════ */

function ModalFooterContent({ modal }: { modal: ModalKind }) {
  const { setModal, actions, club, selectedOffer, updateRoundStatus } = usePredictClub()

  switch (modal) {
    case 'create-round':
      return (
        <>
          <SecondaryBtn label="Save Draft" onClick={() => setModal(null)} />
          <PrimaryBtn
            label="Publish Round"
            onClick={() => {
              const round = club.activeRound
              actions.createRound({
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
              actions.publishRound()
            }}
          />
        </>
      )
    case 'fund-to-join':
      return (
        <>
          <SecondaryBtn label="Preview Route" onClick={() => setModal(null)} />
          <PrimaryBtn
            label="Continue"
            onClick={() => {
              actions.pledgeToRound('m2', club.activeRound.suggestedDusdc)
              setModal(null)
            }}
            icon="arrow_forward"
          />
        </>
      )
    case 'execute-trade':
      return (
        <>
          <SecondaryBtn label="Back to Cockpit" onClick={() => setModal(null)} />
          <PrimaryBtn
            label="Sign & Execute Trade"
            onClick={() => actions.executeRound()}
            icon="draw"
          />
        </>
      )
    case 'create-escrow':
      return (
        <>
          <SecondaryBtn label="Cancel" onClick={() => setModal(null)} />
          <PrimaryBtn
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
            icon="check_circle"
          />
        </>
      )
    case 'fill-escrow':
      return (
        <>
          <SecondaryBtn label="Cancel" onClick={() => setModal(null)} />
          <PrimaryBtn
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
          <SecondaryBtn label="Preview Borrow" onClick={() => setModal(null)} />
          <PrimaryBtn
            label="Continue to Wallet"
            onClick={() => setModal(null)}
            icon="arrow_forward"
          />
        </>
      )
    case 'claim-settlement':
      return (
        <>
          <SecondaryBtn label="Close" onClick={() => setModal(null)} />
          <PrimaryBtn
            label="Claim"
            onClick={() => {
              updateRoundStatus('claimed')
              setModal(null)
            }}
          />
        </>
      )
    default:
      return <SecondaryBtn label="Close" onClick={() => setModal(null)} />
  }
}

/* ═══════════════════════ SHARED COMPONENTS ═══════════════════════ */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-label text-label-caps text-on-surface-variant uppercase tracking-wider">
      {children}
    </span>
  )
}

function InputBox({ value, readOnly, icon }: { value: string; readOnly?: boolean; icon?: string }) {
  return (
    <div className="flex items-center bg-surface border border-outline-variant rounded px-md h-9 focus-within:border-primary-fixed-dim focus-within:shadow-[0_0_8px_rgba(0,224,179,0.2)]">
      <input
        className="bg-transparent border-none outline-none font-data text-data-md text-on-surface w-full"
        readOnly={readOnly}
        defaultValue={value}
      />
      {icon && (
        <span className="material-symbols-outlined text-on-surface-variant text-[16px]">
          {icon}
        </span>
      )}
    </div>
  )
}

function InputField({
  label,
  value,
  placeholder,
  type = 'text',
  icon,
}: {
  label: string
  value: string
  placeholder?: string
  type?: string
  icon?: string
}) {
  return (
    <div className="flex flex-col gap-sm">
      <Label>{label}</Label>
      <div className="flex items-center bg-surface border border-outline-variant rounded px-md h-9 focus-within:border-primary-fixed-dim focus-within:shadow-[0_0_8px_rgba(0,224,179,0.2)]">
        {icon && (
          <span className="material-symbols-outlined text-on-surface-variant text-[16px] mr-xs">
            {icon}
          </span>
        )}
        <input
          className="bg-transparent border-none outline-none font-data text-data-md text-on-surface w-full"
          type={type}
          defaultValue={value}
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}

function SwapInput({ asset, value }: { asset: string; value: string }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded flex items-stretch h-[48px] focus-within:border-primary-fixed-dim focus-within:shadow-[0_0_8px_rgba(0,224,179,0.2)]">
      <button
        className="flex items-center gap-sm px-md border-r border-outline-variant bg-surface-container hover:bg-surface-variant rounded-l cursor-pointer"
        type="button"
      >
        <div className="w-4 h-4 rounded-full bg-secondary-container border border-outline-variant flex items-center justify-center text-[8px] font-bold text-on-surface">
          {asset[0]}
        </div>
        <span className="font-data text-data-md text-on-surface">{asset}</span>
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
          expand_more
        </span>
      </button>
      <div className="flex-1 flex items-center pr-md">
        <input
          className="w-full bg-transparent border-none text-right font-data text-data-lg text-on-surface outline-none"
          defaultValue={value}
        />
      </div>
      <button
        className="px-sm font-label text-label-caps text-primary-fixed hover:opacity-80 border-l border-outline-variant/50 cursor-pointer"
        type="button"
      >
        MAX
      </button>
    </div>
  )
}

function Row({
  label,
  value,
  tone,
  children,
}: {
  label: string
  value?: string
  tone?: 'mint' | 'error' | 'amber'
  children?: React.ReactNode
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-body text-body-sm text-on-surface-variant">{label}</span>
      {children ?? (
        <span
          className={`font-data text-data-md ${tone === 'mint' ? 'text-primary-fixed-dim' : tone === 'error' ? 'text-error' : tone === 'amber' ? 'text-tertiary-fixed-dim' : 'text-on-surface'}`}
        >
          {value}
        </span>
      )}
    </div>
  )
}

function BalanceCard({ label, value, dimmed }: { label: string; value: string; dimmed?: boolean }) {
  return (
    <div
      className={`bg-surface p-sm border border-outline-variant rounded flex flex-col items-center justify-center ${dimmed ? 'opacity-50' : ''}`}
    >
      <span className="font-data text-data-sm text-on-surface-variant mb-xs">{label}</span>
      <span className="font-data text-data-md text-primary">{value}</span>
    </div>
  )
}

function RouteCard({
  icon,
  title,
  note,
  active,
}: {
  icon: string
  title: string
  note: string
  active?: boolean
}) {
  return (
    <label
      className={`relative flex flex-col p-md bg-surface border rounded cursor-pointer transition-colors ${active ? 'border-primary-fixed ring-1 ring-primary-fixed shadow-[0_0_8px_rgba(0,224,179,0.15)]' : 'border-outline-variant hover:bg-surface-bright hover:border-outline'}`}
    >
      <input type="radio" name="funding_route" className="sr-only" defaultChecked={active} />
      <div className="flex justify-between items-start mb-sm">
        <span
          className={`material-symbols-outlined ${active ? 'text-primary-fixed-dim' : 'text-on-surface-variant'}`}
        >
          {icon}
        </span>
        <div
          className={`w-3 h-3 rounded-full ${active ? 'bg-primary-fixed' : 'border border-outline-variant'}`}
        />
      </div>
      <span
        className={`font-body text-body-base font-medium ${active ? 'text-primary' : 'text-on-surface-variant'}`}
      >
        {title}
      </span>
      <span className="font-data text-data-sm text-on-surface-variant mt-xs">{note}</span>
    </label>
  )
}

function MetricCell({
  label,
  value,
  tone,
  pulse,
}: {
  label: string
  value: string
  tone?: 'mint' | 'amber'
  pulse?: boolean
}) {
  return (
    <div className="bg-surface-container-low p-sm flex flex-col gap-xs">
      <span className="font-label text-label-caps text-on-surface-variant uppercase">{label}</span>
      <div className="flex items-center gap-xs">
        {pulse && <div className="w-2 h-2 rounded-full bg-primary-fixed-dim animate-pulse" />}
        <span
          className={`font-data text-data-sm ${tone === 'mint' ? 'text-primary-fixed-dim' : tone === 'amber' ? 'text-tertiary-fixed' : 'text-primary'}`}
        >
          {value}
        </span>
      </div>
    </div>
  )
}

function SecondaryBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="px-lg py-sm border border-outline-variant text-primary-fixed-dim font-data text-data-md rounded hover:bg-surface-bright transition-colors cursor-pointer"
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function PrimaryBtn({
  label,
  onClick,
  icon,
}: {
  label: string
  onClick: () => void
  icon?: string
}) {
  return (
    <button
      className="px-lg py-sm bg-primary-fixed-dim text-on-primary-fixed font-data text-data-md rounded hover:bg-primary-container transition-colors shadow-[0_0_10px_rgba(0,224,179,0.2)] cursor-pointer flex items-center gap-sm"
      type="button"
      onClick={onClick}
    >
      {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
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

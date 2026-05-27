/**
 * Shepherd.js tour hook for DeepBook Predict plugin.
 * Provides guided walkthroughs for each major feature.
 *
 * Note: Plugin renders inside Shadow DOM. We use attachTo.element as a function
 * that queries both document and shadow roots to find target elements.
 */

import { useCallback, useRef } from 'react'
import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'

type TourName = 'overview' | 'plpHedge' | 'marginLoop' | 'surface' | 'trade'

const BUTTON_NEXT = {
  text: 'Next →',
  action: function (this: Shepherd.Tour) {
    this.next()
  },
}
const BUTTON_BACK = {
  text: '← Back',
  action: function (this: Shepherd.Tour) {
    this.back()
  },
  secondary: true,
}
const BUTTON_DONE = {
  text: 'Done ✓',
  action: function (this: Shepherd.Tour) {
    this.complete()
  },
}

/**
 * Find an element by selector, searching both document and all shadow roots.
 * Shepherd supports attachTo.element as a function returning an HTMLElement.
 */
function findElement(selector: string): HTMLElement | null | undefined {
  // Try document first
  const el = document.querySelector<HTMLElement>(selector)
  if (el) return el

  // Search inside shadow roots (plugin renders in ShadowContainer)
  const shadows = document.querySelectorAll('[data-shadow-host]')
  for (const host of shadows) {
    const shadow = (host as HTMLElement).shadowRoot
    if (shadow) {
      const found = shadow.querySelector<HTMLElement>(selector)
      if (found) return found
    }
  }

  // Also try generic shadow roots
  const allElements = document.querySelectorAll('*')
  for (const el of allElements) {
    if (el.shadowRoot) {
      const found = el.shadowRoot.querySelector<HTMLElement>(selector)
      if (found) return found
    }
  }

  return undefined // undefined = Shepherd shows tooltip centered (no arrow)
}

/** Helper to create attachTo with shadow DOM support */
function attachTo(
  selector: string,
  on: Shepherd.Step.StepOptionsAttachTo['on'] = 'bottom',
): Shepherd.Step.StepOptionsAttachTo {
  return { element: () => findElement(selector), on }
}

function createTour(): Shepherd.Tour {
  return new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      scrollTo: { behavior: 'smooth', block: 'center' },
      cancelIcon: { enabled: true },
      classes: 'sui-predict-tour',
      modalOverlayOpeningPadding: 4,
      modalOverlayOpeningRadius: 8,
    },
  })
}

/** Add progress indicator to each step */
function withProgress(steps: Shepherd.Step.StepOptions[]): Shepherd.Step.StepOptions[] {
  return steps.map((step, idx) => ({
    ...step,
    when: {
      ...step.when,
      show() {
        const currentStep = Shepherd.activeTour?.getCurrentStep()
        const el = currentStep?.getElement()
        const header = el?.querySelector('.shepherd-header')
        if (header && !header.querySelector('.shepherd-progress')) {
          const progress = document.createElement('span')
          progress.className = 'shepherd-progress'
          progress.style.cssText = 'font-size:11px;color:#64748b;margin-right:auto;'
          progress.textContent = `${idx + 1} / ${steps.length}`
          header.insertBefore(progress, header.querySelector('.shepherd-cancel-icon'))
        }
      },
    },
  }))
}

function getOverviewSteps(): Shepherd.Step.StepOptions[] {
  return withProgress([
    {
      id: 'welcome',
      title: 'Welcome to DeepBook Predict',
      text: 'This dashboard lets you analyze, simulate, and trade on the DeepBook Predict protocol. Let me show you around.',
      buttons: [BUTTON_NEXT],
    },
    {
      id: 'tabs',
      title: 'Navigation Tabs',
      text: '<b>9 tabs</b> organized by function:<br>• <b>Market</b> — Live oracle data<br>• <b>Surface</b> — Volatility smile<br>• <b>Risk</b> — Vault health<br>• <b>Strategy / PLP+Hedge / Loop</b> — Simulations<br>• <b>Arb</b> — Cross-venue analysis<br>• <b>Trade / Vault</b> — On-chain actions',
      attachTo: attachTo('.sui-predict__tabs', 'bottom'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'market-oracles',
      title: 'Oracle List',
      text: 'Click any oracle to select it. The selected oracle is used across Surface, Trade, and Arb tabs. Each oracle tracks BTC with a sub-hour expiry.',
      attachTo: attachTo('.sui-predict__oracle-list', 'right'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'stats',
      title: 'Protocol Stats',
      text: 'Live protocol state: Predict Object ID, Package, quote asset (DUSDC), and number of active oracles.',
      attachTo: attachTo('.sui-predict__stats', 'bottom'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'guide-btn',
      title: 'Context-Sensitive Guide',
      text: 'Click this <b>? Guide</b> button anytime to get a walkthrough for the current tab. Each tab has its own tour.',
      attachTo: attachTo('.sui-predict__btn--guide', 'bottom'),
      buttons: [BUTTON_BACK, BUTTON_DONE],
    },
  ])
}

function getPLPHedgeSteps(): Shepherd.Step.StepOptions[] {
  return withProgress([
    {
      id: 'plp-intro',
      title: 'PLP + Hedge Vault Strategy',
      text: 'This strategy combines <b>PLP yield</b> with <b>crash insurance</b>. You supply DUSDC to earn vault returns, and buy OTM DOWN binaries to cap your downside.',
      buttons: [BUTTON_NEXT],
    },
    {
      id: 'plp-step1',
      title: 'Step 1: Check Vault Health',
      text: 'Go to the <b>Risk</b> tab first. Check the current vault utilization.<br><br>High utilization = more risk → the simulator will auto-increase your hedge ratio.',
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'plp-config',
      title: 'Step 2: Configure Strategy',
      text: 'Set your parameters here:<br>• <b>Capital</b> — total DUSDC to deploy<br>• <b>PLP %</b> — portion earning yield<br>• <b>OTM %</b> — how far below spot for hedges<br>• <b>Hedges</b> — number of DOWN positions<br>• <b>PLP APY</b> — expected vault yield',
      attachTo: attachTo('.sui-predict__form', 'top'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'plp-results',
      title: 'Step 3: Review Results',
      text: 'Check the simulation output:<br>• <b>Net APY</b> — yield after insurance cost<br>• <b>Max Drawdown</b> — hedged vs unhedged<br>• <b>Dynamic Ratio</b> — auto-adjusted by utilization',
      attachTo: attachTo('.sui-predict__stats', 'top'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'plp-hedges',
      title: 'Step 4: Hedge Positions',
      text: 'Each hedge is a DOWN binary at a specific strike:<br>• <b>Strike</b> — price level for insurance<br>• <b>Cost</b> — premium paid<br>• <b>Max Payout</b> — what you receive if BTC crashes below<br>• <b>ITM Prob</b> — likelihood of payout',
      attachTo: attachTo('.sui-predict__table', 'top'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'plp-chart',
      title: 'Step 5: PnL Chart',
      text: 'This shows your net PnL at different BTC price moves:<br>• <b>Green bars</b> — profit scenarios<br>• <b>Red bars</b> — loss scenarios (capped by hedges)<br><br>Compare with unhedged PLP to see the insurance value.',
      attachTo: attachTo('.sui-predict__price-chart', 'top'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'plp-execute',
      title: 'Step 6: Execute',
      text: 'To execute this strategy:<br>1. <b>Vault tab</b> → Supply PLP allocation<br>2. <b>Trade tab</b> → Binary → DOWN → Mint at each hedge strike<br><br>Monitor via Risk tab. Near expiry, Redeem hedges if not needed.',
      buttons: [BUTTON_BACK, BUTTON_DONE],
    },
  ])
}

function getMarginLoopSteps(): Shepherd.Step.StepOptions[] {
  return withProgress([
    {
      id: 'loop-intro',
      title: 'Three-Protocol Margin Loop',
      text: 'Stack 3 Sui DeFi protocols in one composable flow:<br><br><b>iron_bank</b> (deposit) → <b>deepbook_margin</b> (borrow) → <b>predict</b> (trade)<br><br>Settlement payouts repay the loan.',
      buttons: [BUTTON_NEXT],
    },
    {
      id: 'loop-config',
      title: 'Step 1: Configure',
      text: 'Set parameters:<br>• <b>Collateral</b> — initial USDC<br>• <b>LTV</b> — borrow ratio (70% = 1.7× leverage)<br>• <b>Ranges</b> — number of predict positions<br>• <b>Width</b> — price coverage around spot',
      attachTo: attachTo('.sui-predict__form', 'top'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'loop-flow',
      title: 'Step 2: Protocol Flow',
      text: 'The flow visualization shows the 3 steps:<br>1. <b>iron_bank</b>: USDC → USDsui (earning yield)<br>2. <b>deepbook_margin</b>: USDsui collateral → borrow dUSDC<br>3. <b>predict</b>: dUSDC → range positions',
      attachTo: attachTo('.sui-predict__flow', 'top'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'loop-metrics',
      title: 'Step 3: Key Metrics',
      text: '• <b>Leverage</b> — effective multiplier<br>• <b>Best APY</b> — if all ranges settle ITM<br>• <b>Worst APY</b> — if all expire OTM<br>• <b>Liq. Price</b> — where LTV hits 85%<br>• <b>Worst LTV</b> — max LTV under stress',
      attachTo: attachTo('.sui-predict__stats', 'top'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'loop-scenarios',
      title: 'Step 4: Scenario Table',
      text: 'Each row shows what happens at a specific BTC move:<br>• <b>PnL</b> — net profit/loss<br>• <b>LTV</b> — current loan-to-value<br>• <b>Status</b> — SAFE or LIQUIDATED<br><br>If LTV > 85% → close positions immediately.',
      attachTo: attachTo('.sui-predict__table', 'top'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'loop-execute',
      title: 'Step 5: Execute & Monitor',
      text: '<b>Execute:</b><br>1. iron_bank deposit (external)<br>2. deepbook_margin borrow (external)<br>3. Trade tab → Range → Mint positions<br><br><b>Monitor:</b> Watch LTV. If approaching 85%, Redeem ranges early.<br><br><b>Unwind:</b> Collect payouts → repay margin → withdraw iron_bank.',
      buttons: [BUTTON_BACK, BUTTON_DONE],
    },
  ])
}

function getSurfaceSteps(): Shepherd.Step.StepOptions[] {
  return withProgress([
    {
      id: 'surface-intro',
      title: 'Predict Surface Studio',
      text: 'Visualize the implied volatility smile from on-chain SVI parameters. Use this to sanity-check pricing and find arbitrage.',
      buttons: [BUTTON_NEXT],
    },
    {
      id: 'surface-select',
      title: 'Oracle Selector',
      text: "Choose which oracle to analyze. Each has different expiry times. The SVI surface is computed from that oracle's parameters.",
      attachTo: attachTo('.sui-predict__select', 'bottom'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'surface-formula',
      title: 'SVI Formula',
      text: '<code>w(k) = a + b·(ρ·(k−m) + √((k−m)²+σ²))</code><br><code>IV = √(w/T) × 100%</code><br><br>5 parameters model the entire smile. Decoded from on-chain integers.',
      attachTo: attachTo('.sui-predict__formula', 'bottom'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'surface-slider',
      title: 'Time Travel Slider',
      text: 'Drag to replay recent SVI updates (up to 30). Watch how the smile evolves — useful for detecting regime changes or stale feeds.',
      attachTo: attachTo('.sui-predict__slider', 'bottom'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'surface-chart',
      title: 'Volatility Smile',
      text: 'Each bar = IV at a strike price.<br>• <b>Blue bar</b> = ATM (at-the-money)<br>• <b>Red bar</b> = butterfly violation<br>• <b>Purple bars</b> = normal OTM strikes<br><br>Hover for exact values.',
      attachTo: attachTo('.sui-predict__vol-bars', 'top'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'surface-arb',
      title: 'Arbitrage Checker',
      text: 'Flags butterfly violations where IV is too high relative to neighbors (>2% excess). These indicate potential arbitrage opportunities — buy the wings, sell the body.',
      attachTo: attachTo('.sui-predict__badge--green, .sui-predict__badge--red', 'left'),
      buttons: [BUTTON_BACK, BUTTON_DONE],
    },
  ])
}

function getTradeSteps(): Shepherd.Step.StepOptions[] {
  return withProgress([
    {
      id: 'trade-intro',
      title: 'Trading Positions',
      text: 'Mint or redeem binary positions and vertical ranges directly from this dashboard. Requires a connected wallet with DUSDC testnet tokens.',
      buttons: [BUTTON_NEXT],
    },
    {
      id: 'trade-mode',
      title: 'Position Type',
      text: '<b>Binary</b>: UP/DOWN bet on a single strike<br><b>Range</b>: Bet that BTC settles within a band<br><br>Toggle between them here.',
      attachTo: attachTo('.sui-predict__toggle', 'bottom'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'trade-inputs',
      title: 'Trade Parameters',
      text: 'For Binary: set <b>strike</b> + <b>direction</b> (UP/DOWN) + <b>amount</b><br>For Range: set <b>lower strike</b> + <b>upper strike</b> + <b>amount</b><br><br>The oracle spot price is shown as reference.',
      attachTo: attachTo('.sui-predict__form', 'top'),
      buttons: [BUTTON_BACK, BUTTON_NEXT],
    },
    {
      id: 'trade-submit',
      title: 'Submit Transaction',
      text: 'Click the button → wallet popup → sign → TX digest appears on success.<br><br>The position is stored in your PredictManager on-chain. Redeem after settlement for payout.',
      attachTo: attachTo('.sui-predict__btn--full', 'top'),
      buttons: [BUTTON_BACK, BUTTON_DONE],
    },
  ])
}

export function useTour() {
  const tourRef = useRef<Shepherd.Tour | null>(null)

  const startTour = useCallback((name: TourName) => {
    if (tourRef.current) tourRef.current.cancel()

    const tour = createTour()
    tourRef.current = tour

    let steps: Shepherd.Step.StepOptions[]
    switch (name) {
      case 'overview':
        steps = getOverviewSteps()
        break
      case 'plpHedge':
        steps = getPLPHedgeSteps()
        break
      case 'marginLoop':
        steps = getMarginLoopSteps()
        break
      case 'surface':
        steps = getSurfaceSteps()
        break
      case 'trade':
        steps = getTradeSteps()
        break
    }

    tour.addSteps(steps)
    tour.start()
  }, [])

  const cancelTour = useCallback(() => {
    if (tourRef.current) {
      tourRef.current.cancel()
      tourRef.current = null
    }
  }, [])

  return { startTour, cancelTour }
}

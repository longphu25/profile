import type { Transaction } from '@mysten/sui/transactions'
import type { RiskGateInput } from '../domain/riskGate'
import { evaluateRiskGate } from '../domain/riskGate'
import type { Direction } from '../domain/types'
import type { SuiPredictGateway } from './executeTradeplan'

/**
 * Surface Studio direct-submit orchestration (plan 23, S7).
 *
 * The Studio lets a trader click a heatmap cell (a strike x expiry) and mint a
 * personal binary position straight from the surface, without the club-round
 * machinery the cockpit uses. This module is the pure orchestration layer: it
 * derives a direction hint from model edge, builds the risk-gate input for a
 * single solo trade, and runs the gate -> build -> sign pipeline. It owns no
 * React state and no wallet handles, so it is unit-testable end to end.
 *
 * Why not reuse `executeTradeplan`? That carries club/member bookkeeping and
 * mutates a ClubState the Studio does not own. The Studio mints a standalone
 * position, so it shares the gateway + risk gate but skips the club layer.
 */

// The model-vs-contract gap (in win-probability points) below which we offer no
// directional hint. Matches the cockpit's "fair vs contract" edge label band so
// the two surfaces agree on what counts as a real edge.
const DIRECTION_EDGE_EPS = 0.005

/**
 * Suggest a side from model edge: when the SVI fair win-probability for UP sits
 * above the contract-implied probability, the UP side is underpriced (value),
 * and vice versa. Returns null when either side is missing or the gap is within
 * noise - a hint, never advice; the user still picks the side.
 */
export function recommendDirection(
  fairProbability: number | null,
  contractProbability: number | null,
): Direction | null {
  if (fairProbability == null || contractProbability == null) return null
  const diff = fairProbability - contractProbability
  if (Math.abs(diff) < DIRECTION_EDGE_EPS) return null
  return diff > 0 ? 'UP' : 'DOWN'
}

export interface StudioRiskParams {
  /** Oracle expiry timestamp in ms (drives the expiry-safety check). */
  expiryMs: number
  /** Reference clock in ms; defaults to Date.now() (injected in tests). */
  nowMs?: number
  /** The cell's oracle status string from the oracle list ('active' when tradable). */
  oracleStatus: string | null
  /** Feed freshness timestamp in ms (the oracle snapshot's lastUpdateMs). */
  oracleLastUpdateMs: number | null
  /** True when the column carries a usable SVI curve. */
  hasSvi: boolean
  /** True when the column carries a positive forward price. */
  hasForward: boolean
  /** Connected wallet DUSDC balance. */
  memberDusdc: number
  /** The size the user wants to stake. */
  amountDusdc: number
  walletConnected: boolean
  managerReady: boolean
}

/**
 * Build the risk-gate input for one solo Studio trade. `indicators` is empty on
 * purpose: `computeConsensus([])` resolves to 'neutral' (not 'no-trade'), so the
 * signal-bias check passes and the gate reduces to the real safety conditions
 * (oracle live/active, SVI + forward present, expiry safe, balance, wallet,
 * manager). `quoteAvailable` / `vaultAvailable` are deliberately left undefined:
 * the Studio quotes only the ATM band, so most cells have no contract quote, and
 * those checks are warning-severity (they would block execution). The contract
 * itself is the final gate at mint time.
 */
export function buildStudioRiskInput(params: StudioRiskParams): RiskGateInput {
  const now = params.nowMs ?? Date.now()
  const expiryMinutes = Math.max(0, Math.floor((params.expiryMs - now) / 60_000))
  return {
    oracleLastUpdate: params.oracleLastUpdateMs ?? null,
    expiryMinutes,
    memberDusdc: params.memberDusdc,
    suggestedDusdc: params.amountDusdc,
    signalBias: 'neutral',
    indicators: [],
    walletConnected: params.walletConnected,
    predictManagerReady: params.managerReady,
    oracleActive: params.oracleStatus != null ? params.oracleStatus === 'active' : null,
    priceAvailable: params.hasForward,
    sviAvailable: params.hasSvi,
  }
}

export interface StudioTradeParams {
  direction: Direction
  strike: number
  amountDusdc: number
  oracleId: string
  expiryMs: number
  walletAddress: string
  managerId: string
  tickSize: number
  minStrike: number
}

export interface StudioTradeDeps {
  riskInput: RiskGateInput
  gateway: Pick<SuiPredictGateway, 'buildMintTx'>
  signAndExecute: (tx: Transaction) => Promise<{ digest: string }>
  /**
   * Read-only contract pre-flight (devInspect). The heatmap lets a trader click
   * any cell, but the contract only prices strikes near the forward; a strike
   * outside those bounds aborts on-chain (quote_spread_from_fair_price). This
   * runs the same quote path with zero gas and no wallet prompt so a doomed
   * strike is caught before signing. Returns ok:false + a friendly reason when
   * the contract will not quote the strike. Optional so the gate/build/sign core
   * stays testable without a live node.
   */
  preflightQuote?: () => Promise<{ ok: boolean; reason?: string }>
}

export interface StudioTradeResult {
  ok: boolean
  digest?: string
  error?: string
}

/**
 * Run the solo-trade pipeline: risk gate -> build mint PTB -> sign. Returns a
 * flat ok/digest/error result so the ticket UI can render success or the exact
 * blocking reason without throwing.
 */
export async function submitStudioTrade(
  params: StudioTradeParams,
  deps: StudioTradeDeps,
): Promise<StudioTradeResult> {
  const risk = evaluateRiskGate(deps.riskInput)
  if (!risk.canExecute) {
    const reasons = [...risk.blockingReasons, ...risk.warningReasons].map(
      (c) => c.message ?? c.label,
    )
    return { ok: false, error: reasons.join('; ') || 'Risk gate blocked execution' }
  }

  // Contract pre-flight (read-only): the heatmap lets a trader click any cell, but
  // the contract only prices strikes near the forward and aborts on-chain for the
  // rest (quote_spread_from_fair_price). Catch a doomed strike here, with zero gas
  // and no wallet prompt, instead of letting the user sign a reverting mint.
  if (deps.preflightQuote) {
    let pre: { ok: boolean; reason?: string }
    try {
      pre = await deps.preflightQuote()
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Pre-flight failed' }
    }
    if (!pre.ok) {
      return { ok: false, error: pre.reason ?? 'Contract will not price this strike' }
    }
  }

  let tx: Transaction
  try {
    tx = await deps.gateway.buildMintTx({
      walletAddress: params.walletAddress,
      managerId: params.managerId,
      direction: params.direction,
      strike: params.strike,
      amountDusdc: params.amountDusdc,
      oracleId: params.oracleId,
      expiry: params.expiryMs,
      tickSize: params.tickSize,
      minStrike: params.minStrike,
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'PTB build failed' }
  }

  try {
    const result = await deps.signAndExecute(tx)
    return { ok: true, digest: result.digest }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Transaction failed' }
  }
}

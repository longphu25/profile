import { bcs } from '@mysten/sui/bcs'
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc'
import { Transaction } from '@mysten/sui/transactions'
import { computePayoutPreview, type PayoutPreview } from '../domain/payoutPreview'
import type { Direction, PredictionRound } from '../domain/types'
import type { OracleState } from './deepbookOracleService'
import { TESTNET_RPC_URL } from '../../../src/constants/predict-club'

const PREDICT_SERVER = 'https://predict-server.testnet.mystenlabs.com'
const PACKAGE_ID = '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138'
const PREDICT_ID = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a'
const CLOCK_ID = '0x6'
const DUSDC_TYPE =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'
const PLP_TYPE = `${PACKAGE_ID}::plp::PLP`
const DUSDC_DECIMALS = 6
const PRICE_SCALE = 1_000_000_000
const CONTRACT_UNIT = 10n ** BigInt(DUSDC_DECIMALS)
const FALLBACK_SENDER = '0x0000000000000000000000000000000000000000000000000000000000000001'

const client = new SuiJsonRpcClient({ url: TESTNET_RPC_URL, network: 'testnet' })

export interface ContractQuotePreview {
  status: 'ok' | 'unavailable'
  reason?: string
  contractPrice: number | null
  estimatedCost: number | null
  grossIfWin: number | null
  potentialProfit: number | null
  riskReward: number | null
  rewardMultiple: number | null
  mintCostRaw?: string
  redeemPayoutRaw?: string
}

export interface ManagerPosition {
  id: string
  kind: 'binary' | 'range'
  oracleId: string
  expiry: number
  quantity: number
  side?: 'ABOVE' | 'BELOW'
  strike?: number
  lowerStrike?: number
  upperStrike?: number
}

export interface PredictManagerSnapshot {
  id: string
  owner: string
  quoteBalance: number
  positionsSize: number
  rangePositionsSize: number
  positions: ManagerPosition[]
}

export interface VaultSnapshot {
  totalBalance: number
  totalMtm: number
  totalMaxPayout: number
  availableLiquidity: number
  availableWithdrawal: number
  vaultValue: number
  totalPlpSupply: number
  walletPlpBalance: number
  walletLpShare: number
  limiterEnabled: boolean
}

export interface PredictPricingSnapshot {
  fairValue: PayoutPreview
  quote: ContractQuotePreview
  manager: PredictManagerSnapshot | null
  managerReason?: string
  vault: VaultSnapshot | null
  vaultReason?: string
  loading: boolean
  updatedAt: number
}

export interface PredictPricingInput {
  walletAddress: string | null
  managerId: string | null
  oracle: OracleState | null
  round: PredictionRound
}

export const EMPTY_CONTRACT_QUOTE: ContractQuotePreview = {
  status: 'unavailable',
  reason: 'Preview unavailable',
  contractPrice: null,
  estimatedCost: null,
  grossIfWin: null,
  potentialProfit: null,
  riskReward: null,
  rewardMultiple: null,
}

const PRICING_BOUNDS_REASON =
  'Contract quote unavailable because the selected strike is outside the contract pricing bounds. Adjust the strike or select a nearer active oracle.'

export function computeFairValuePreview(round: PredictionRound, oracle: OracleState | null) {
  return computePayoutPreview({
    direction: round.direction,
    strike: round.strike,
    lowerStrike: round.lowerStrike,
    upperStrike: round.upperStrike,
    amountDusdc: round.suggestedDusdc,
    forward: oracle?.latest_price?.forward,
    expiry: oracle?.expiry,
    svi: oracle?.latest_svi,
  })
}

// Module-level cache + in-flight coalescing. Predict Club mounts each panel in
// its own React root with its own provider, so ~9 providers would otherwise
// fire this ~10-RPC bundle independently every oracle tick (429 flooding).
// Sharing by input key collapses them into a single network round-trip.
const PRICING_SNAPSHOT_TTL_MS = 15_000
let pricingCache: { key: string; value: PredictPricingSnapshot; ts: number } | null = null
const pricingInflight = new Map<string, Promise<PredictPricingSnapshot>>()

function pricingInputKey(input: PredictPricingInput): string {
  const r = input.round
  return [
    input.walletAddress ?? '',
    input.managerId ?? '',
    input.oracle?.oracle_id ?? '',
    input.oracle?.latest_price?.forward ?? '',
    r.direction,
    r.strike,
    r.lowerStrike ?? '',
    r.upperStrike ?? '',
    r.expiryMinutes,
    r.suggestedDusdc,
  ].join('|')
}

/**
 * Cached + coalesced pricing snapshot. All callers sharing the same input key
 * within the TTL get the same result; concurrent calls share one in-flight
 * promise. This bounds fullnode load regardless of how many panels mount.
 */
export async function fetchPredictPricingSnapshot(
  input: PredictPricingInput,
): Promise<PredictPricingSnapshot> {
  const key = pricingInputKey(input)
  const now = Date.now()

  if (pricingCache && pricingCache.key === key && now - pricingCache.ts < PRICING_SNAPSHOT_TTL_MS) {
    return pricingCache.value
  }

  const existing = pricingInflight.get(key)
  if (existing) return existing

  const promise = fetchPredictPricingSnapshotUncached(input)
    .then((value) => {
      pricingCache = { key, value, ts: Date.now() }
      return value
    })
    .finally(() => {
      pricingInflight.delete(key)
    })

  pricingInflight.set(key, promise)
  return promise
}

async function fetchPredictPricingSnapshotUncached({
  walletAddress,
  managerId,
  oracle,
  round,
}: PredictPricingInput): Promise<PredictPricingSnapshot> {
  const fairValue = computeFairValuePreview(round, oracle)
  const [quote, manager, vault] = await Promise.all([
    quoteNewPosition({ walletAddress, oracle, round, fairValue }).catch((error) => ({
      ...EMPTY_CONTRACT_QUOTE,
      reason: sanitizeContractQuoteReason(error),
    })),
    walletAddress
      ? fetchManagerSnapshot(walletAddress, managerId).then(
          (snapshot) => ({
            snapshot,
            reason: snapshot ? undefined : 'No PredictManager found for this wallet',
          }),
          (error) => ({
            snapshot: null,
            reason: sanitizeDataUnavailableReason(error, 'PredictManager unavailable'),
          }),
        )
      : Promise.resolve({
          snapshot: null,
          reason: 'Connect wallet to resolve PredictManager',
        }),
    fetchVaultSnapshot(walletAddress).then(
      (snapshot) => ({ snapshot, reason: undefined as string | undefined }),
      (error) => ({
        snapshot: null,
        reason: sanitizeDataUnavailableReason(error, 'Vault liquidity unavailable'),
      }),
    ),
  ])

  return {
    fairValue,
    quote,
    manager: manager.snapshot,
    managerReason: manager.reason,
    vault: vault.snapshot,
    vaultReason: vault.reason,
    loading: false,
    updatedAt: Date.now(),
  }
}

async function quoteNewPosition({
  walletAddress,
  oracle,
  round,
  fairValue,
}: {
  walletAddress: string | null
  oracle: OracleState | null
  round: PredictionRound
  fairValue: PayoutPreview
}): Promise<ContractQuotePreview> {
  if (!oracle) return { ...EMPTY_CONTRACT_QUOTE, reason: 'Oracle state unavailable' }
  if (oracle.status !== 'active') return { ...EMPTY_CONTRACT_QUOTE, reason: 'Oracle is not active' }
  if (!oracle.latest_price || !oracle.latest_svi) {
    return { ...EMPTY_CONTRACT_QUOTE, reason: 'Forward price or SVI unavailable' }
  }
  if (fairValue.degraded) {
    return { ...EMPTY_CONTRACT_QUOTE, reason: fairValue.reason ?? 'SVI pricing unavailable' }
  }
  if (fairValue.reason === 'Probability floored for display') {
    return {
      ...EMPTY_CONTRACT_QUOTE,
      reason: PRICING_BOUNDS_REASON,
      estimatedCost: round.suggestedDusdc,
      grossIfWin: fairValue.grossIfWin,
      potentialProfit: fairValue.potentialProfit,
      riskReward:
        fairValue.potentialProfit !== null && round.suggestedDusdc > 0
          ? fairValue.potentialProfit / round.suggestedDusdc
          : null,
      rewardMultiple: fairValue.rewardMultiple,
    }
  }

  const input = buildQuoteInput(round, oracle)
  const sender = walletAddress ?? FALLBACK_SENDER
  const tx = new Transaction()
  tx.setSender(sender)

  if (input.kind === 'range') {
    const [rangeKey] = tx.moveCall({
      target: `${PACKAGE_ID}::range_key::new`,
      arguments: [
        tx.pure.id(input.oracleId),
        tx.pure.u64(input.expiry),
        tx.pure.u64(input.lowStrike),
        tx.pure.u64(input.highStrike),
      ],
    })
    tx.moveCall({
      target: `${PACKAGE_ID}::predict::get_range_trade_amounts`,
      arguments: [
        tx.object(PREDICT_ID),
        tx.object(input.oracleId),
        rangeKey,
        tx.pure.u64(input.quantity),
        tx.object(CLOCK_ID),
      ],
    })
  } else {
    const [marketKey] = tx.moveCall({
      target: `${PACKAGE_ID}::market_key::new`,
      arguments: [
        tx.pure.id(input.oracleId),
        tx.pure.u64(input.expiry),
        tx.pure.u64(input.strike),
        tx.pure.bool(input.isUp),
      ],
    })
    tx.moveCall({
      target: `${PACKAGE_ID}::predict::get_trade_amounts`,
      arguments: [
        tx.object(PREDICT_ID),
        tx.object(input.oracleId),
        marketKey,
        tx.pure.u64(input.quantity),
        tx.object(CLOCK_ID),
      ],
    })
  }

  const inspected = await client.devInspectTransactionBlock({ sender, transactionBlock: tx })
  const values = inspected.results?.[1]?.returnValues
  if (!values || values.length < 2) {
    return {
      ...EMPTY_CONTRACT_QUOTE,
      reason: sanitizeContractQuoteReason(
        inspected.error ?? 'Contract quote return values unavailable',
      ),
      estimatedCost: round.suggestedDusdc,
      grossIfWin: fairValue.grossIfWin,
      potentialProfit: fairValue.potentialProfit,
      riskReward:
        fairValue.potentialProfit !== null && round.suggestedDusdc > 0
          ? fairValue.potentialProfit / round.suggestedDusdc
          : null,
      rewardMultiple: fairValue.rewardMultiple,
    }
  }

  const mintCost = parseU64ReturnValue(values[0][0])
  const redeemPayout = parseU64ReturnValue(values[1][0])
  const grossIfWin = input.quantity
  const potentialProfit = grossIfWin > mintCost ? grossIfWin - mintCost : 0n
  const contracts = Number(input.quantity / CONTRACT_UNIT)
  const estimatedCost = fromDusdc(mintCost)
  const grossIfWinDusdc = fromDusdc(grossIfWin)
  const potentialProfitDusdc = fromDusdc(potentialProfit)

  return {
    status: inspected.error ? 'unavailable' : 'ok',
    reason: inspected.error ? sanitizeContractQuoteReason(inspected.error) : undefined,
    contractPrice: contracts > 0 ? estimatedCost / contracts : null,
    estimatedCost,
    grossIfWin: grossIfWinDusdc,
    potentialProfit: potentialProfitDusdc,
    riskReward: estimatedCost > 0 ? potentialProfitDusdc / estimatedCost : null,
    rewardMultiple: estimatedCost > 0 ? grossIfWinDusdc / estimatedCost : null,
    mintCostRaw: mintCost.toString(),
    redeemPayoutRaw: redeemPayout.toString(),
  }
}

export interface StrikeQuote {
  /** Contract-implied win probability (cost per contract; each contract pays 1 on win). */
  impliedProbability: number | null
  /** DUSDC mint cost for the sampled quantity. */
  estimatedCost: number | null
  reason?: string
}

const STRIKE_QUOTE_CONTRACTS = 10

/**
 * Per-strike binary contract quote for the mispricing ladder (plan 23, S3).
 *
 * Runs the same devInspect `predict::get_trade_amounts` path as the cockpit quote,
 * but for an arbitrary (oracle, expiry, strike, side) rather than the active round.
 * The contract returns the mint cost for `quantity` contracts; cost-per-contract IS
 * the contract-implied win probability (each contract pays 1 DUSDC on win). One
 * devInspect round-trip per call - the caller (volSurfaceService) bounds and caches.
 */
export async function quoteBinaryStrike(params: {
  oracleId: string
  expiry: number
  strikeUsd: number
  isUp: boolean
  tickSize?: number
  minStrike?: number
  walletAddress?: string | null
}): Promise<StrikeQuote> {
  const tickSize = params.tickSize ?? PRICE_SCALE
  const minStrike = params.minStrike ?? 0
  const strike = snapStrike(params.strikeUsd, tickSize, minStrike)
  const quantity = BigInt(STRIKE_QUOTE_CONTRACTS) * CONTRACT_UNIT
  const sender = params.walletAddress ?? FALLBACK_SENDER

  const tx = new Transaction()
  tx.setSender(sender)
  const [marketKey] = tx.moveCall({
    target: `${PACKAGE_ID}::market_key::new`,
    arguments: [
      tx.pure.id(params.oracleId),
      tx.pure.u64(params.expiry),
      tx.pure.u64(strike),
      tx.pure.bool(params.isUp),
    ],
  })
  tx.moveCall({
    target: `${PACKAGE_ID}::predict::get_trade_amounts`,
    arguments: [
      tx.object(PREDICT_ID),
      tx.object(params.oracleId),
      marketKey,
      tx.pure.u64(quantity),
      tx.object(CLOCK_ID),
    ],
  })

  try {
    const inspected = await client.devInspectTransactionBlock({ sender, transactionBlock: tx })
    const values = inspected.results?.[1]?.returnValues
    if (!values || values.length < 1) {
      return {
        impliedProbability: null,
        estimatedCost: null,
        reason: sanitizeContractQuoteReason(inspected.error ?? 'No return values'),
      }
    }
    const mintCost = parseU64ReturnValue(values[0][0])
    const estimatedCost = fromDusdc(mintCost)
    const impliedProbability = estimatedCost / STRIKE_QUOTE_CONTRACTS
    return {
      impliedProbability: Number.isFinite(impliedProbability) ? impliedProbability : null,
      estimatedCost,
    }
  } catch (error) {
    return {
      impliedProbability: null,
      estimatedCost: null,
      reason: sanitizeContractQuoteReason(error),
    }
  }
}

export function sanitizeContractQuoteReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if (!raw || raw === 'undefined' || raw === 'null') return 'Contract quote unavailable'
  if (
    raw.includes('pricing_config::quote_spread_from_fair_price') ||
    raw.includes('quote_spread_from_fair_price')
  ) {
    return PRICING_BOUNDS_REASON
  }
  if (raw.includes('MoveAbort') || raw.includes('ExecutionError') || raw.length > 240) {
    return 'Contract quote unavailable from devInspect. Use the SVI preview and retry with a nearer strike or active oracle.'
  }
  return raw
}

export const MINTABLE_BOUNDS_REASON =
  'This strike is too deep in or out of the money for the contract to mint right now. Pick a strike nearer the current price.'

/**
 * Map a mint failure (a devInspect abort or a rejected sign) to a friendly,
 * actionable message. The two contract guards a Studio strike can trip are the
 * pricing-bounds abort (quote_spread_from_fair_price) and the ask-band
 * mintability abort (assert_mintable_ask); both reduce to "pick a nearer strike".
 * Wallet rejections and balance shortfalls get their own plain phrasing. Anything
 * else falls back to a clean line rather than a raw MoveAbort dump.
 */
export function sanitizeMintError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if (!raw || raw === 'undefined' || raw === 'null') return 'Mint failed, please try again.'
  if (raw.includes('assert_mintable_ask') || raw.includes('mintable_ask')) {
    return MINTABLE_BOUNDS_REASON
  }
  if (raw.includes('quote_spread_from_fair_price')) return PRICING_BOUNDS_REASON
  const lower = raw.toLowerCase()
  if (lower.includes('rejected') || lower.includes('user denied') || lower.includes('cancelled')) {
    return 'You rejected the transaction in your wallet.'
  }
  if (lower.includes('insufficient')) return 'Not enough balance to mint this position.'
  if (raw.includes('MoveAbort') || raw.includes('ExecutionError') || raw.length > 200) {
    return 'The contract rejected this mint. Try a strike nearer the current price or a different expiry.'
  }
  return raw
}

/**
 * Map a claim failure (a devInspect abort or a rejected sign) to a friendly,
 * actionable message. The contract guards a Studio claim can trip are: the position
 * has not settled yet (the round is still live, so there is nothing to claim), the
 * position lost (no payout to claim), or it was already claimed. Wallet rejections
 * get their own phrasing. Anything else falls back to a clean line rather than a raw
 * MoveAbort dump. The exact guard names mirror the predict module's claim path.
 */
export function sanitizeClaimError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if (!raw || raw === 'undefined' || raw === 'null') return 'Nothing to claim on this position.'
  const lower = raw.toLowerCase()
  if (
    raw.includes('not_settled') ||
    raw.includes('not_expired') ||
    raw.includes('assert_settled')
  ) {
    return 'Not settled yet - this position is still live.'
  }
  if (raw.includes('already_claimed') || raw.includes('assert_claimable')) {
    return 'Already claimed.'
  }
  if (
    raw.includes('zero_payout') ||
    raw.includes('no_payout') ||
    raw.includes('nothing_to_claim')
  ) {
    return 'This position lost - nothing to claim.'
  }
  if (lower.includes('rejected') || lower.includes('user denied') || lower.includes('cancelled')) {
    return 'You rejected the transaction in your wallet.'
  }
  if (raw.includes('MoveAbort') || raw.includes('ExecutionError') || raw.length > 200) {
    return 'This position lost or has already been claimed.'
  }
  return raw
}

function sanitizeDataUnavailableReason(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if (!raw || raw === 'undefined' || raw === 'null') return fallback
  if (raw.includes('429') || raw.toLowerCase().includes('too many requests')) {
    return `${fallback}: Sui RPC rate limit reached`
  }
  if (raw.includes('Failed to fetch') || raw.includes('NetworkError')) {
    return `${fallback}: network request failed`
  }
  if (raw.length > 160 || raw.includes('ExecutionError') || raw.includes('MoveAbort')) {
    return fallback
  }
  return raw
}

function buildQuoteInput(round: PredictionRound, oracle: OracleState) {
  const tickSize = oracle.tick_size ?? PRICE_SCALE
  const minStrike = oracle.min_strike ?? 0
  const quantity = BigInt(Math.max(1, Math.round(round.suggestedDusdc))) * CONTRACT_UNIT
  const expiry = oracle.expiry
  const oracleId = oracle.oracle_id

  if (round.direction === 'RANGE') {
    return {
      kind: 'range' as const,
      oracleId,
      expiry,
      lowStrike: snapStrike(round.lowerStrike ?? round.strike, tickSize, minStrike),
      highStrike: snapStrike(round.upperStrike ?? round.strike, tickSize, minStrike),
      quantity,
    }
  }

  return {
    kind: 'binary' as const,
    oracleId,
    expiry,
    isUp: round.direction === 'UP',
    strike: snapStrike(round.strike, tickSize, minStrike),
    quantity,
  }
}

async function fetchManagerSnapshot(
  walletAddress: string,
  preferredManagerId: string | null,
): Promise<PredictManagerSnapshot | null> {
  const managerId = preferredManagerId ?? (await fetchLatestManagerId(walletAddress))
  if (!managerId) return null

  const object = await client.getObject({ id: managerId, options: { showContent: true } })
  const content = object.data?.content
  if (!content || content.dataType !== 'moveObject') return null
  const fields = content.fields as any
  const positionsTableId = fields.positions?.fields?.id?.id
  const rangePositionsTableId = fields.range_positions?.fields?.id?.id
  const balanceTableId = fields.balance_manager?.fields?.balances?.fields?.id?.id
  const positions = [
    ...(positionsTableId ? await fetchBinaryPositions(positionsTableId).catch(() => []) : []),
    ...(rangePositionsTableId
      ? await fetchRangePositions(rangePositionsTableId).catch(() => [])
      : []),
  ]
  const quoteBalance = await readManagerQuoteBalance(balanceTableId).catch(() => 0n)

  return {
    id: managerId,
    owner: String(fields.owner ?? walletAddress),
    quoteBalance: fromDusdc(quoteBalance),
    positionsSize: Number(fields.positions?.fields?.size ?? 0),
    rangePositionsSize: Number(fields.range_positions?.fields?.size ?? 0),
    positions,
  }
}

/**
 * The trader's binary positions in their PredictManager, read straight from chain.
 * The Studio's positions drawer needs only the binary (UP/DOWN) leg, so this reuses
 * the manager snapshot read (binary + range + balances) and keeps just the binary
 * positions - the chain stays the source of truth, not the localStorage mint hint.
 * Returns an empty array when no manager exists or the read fails.
 */
export async function fetchManagerBinaryPositions(
  walletAddress: string,
  managerId: string | null,
): Promise<ManagerPosition[]> {
  const snapshot = await fetchManagerSnapshot(walletAddress, managerId).catch(() => null)
  return snapshot?.positions.filter((p) => p.kind === 'binary') ?? []
}

async function fetchLatestManagerId(walletAddress: string): Promise<string | null> {
  const res = await fetch(`${PREDICT_SERVER}/managers?owner=${encodeURIComponent(walletAddress)}`)
  if (!res.ok) return null
  const managers = await res.json()
  if (!Array.isArray(managers)) return null
  const found = managers
    .filter((manager) => manager.owner?.toLowerCase() === walletAddress.toLowerCase())
    .sort((left, right) =>
      right.checkpoint === left.checkpoint
        ? right.tx_index - left.tx_index
        : right.checkpoint - left.checkpoint,
    )[0]
  return found?.manager_id ?? null
}

async function fetchBinaryPositions(tableId: string): Promise<ManagerPosition[]> {
  const fields = await fetchAllDynamicFields(tableId)
  const objects = await Promise.all(
    fields.map((field: DynamicFieldInfo) =>
      client.getObject({ id: field.objectId, options: { showContent: true } }),
    ),
  )
  return objects
    .map((object: any): ManagerPosition | null => {
      const content = object.data?.content
      if (!content || content.dataType !== 'moveObject') return null
      const fields = content.fields as any
      const quantity = BigInt(fields.value ?? 0)
      if (quantity <= 0n) return null
      const name = fields.name?.fields
      return {
        id: object.data?.objectId ?? '',
        kind: 'binary' as const,
        oracleId: String(name?.oracle_id ?? ''),
        expiry: Number(name?.expiry ?? 0),
        side: name?.direction === 0 ? ('ABOVE' as const) : ('BELOW' as const),
        strike: Number(name?.strike ?? 0) / PRICE_SCALE,
        quantity: fromDusdc(quantity),
      }
    })
    .filter((position: ManagerPosition | null): position is ManagerPosition => Boolean(position))
}

async function fetchRangePositions(tableId: string): Promise<ManagerPosition[]> {
  const fields = await fetchAllDynamicFields(tableId)
  const objects = await Promise.all(
    fields.map((field: DynamicFieldInfo) =>
      client.getObject({ id: field.objectId, options: { showContent: true } }),
    ),
  )
  return objects
    .map((object: any): ManagerPosition | null => {
      const content = object.data?.content
      if (!content || content.dataType !== 'moveObject') return null
      const fields = content.fields as any
      const quantity = BigInt(fields.value ?? 0)
      if (quantity <= 0n) return null
      const name = fields.name?.fields
      const low = Number(name?.low_strike ?? name?.lower_strike ?? name?.strike_low ?? 0)
      const high = Number(name?.high_strike ?? name?.upper_strike ?? name?.strike_high ?? 0)
      return {
        id: object.data?.objectId ?? '',
        kind: 'range' as const,
        oracleId: String(name?.oracle_id ?? ''),
        expiry: Number(name?.expiry ?? 0),
        lowerStrike: low / PRICE_SCALE,
        upperStrike: high / PRICE_SCALE,
        quantity: fromDusdc(quantity),
      }
    })
    .filter((position: ManagerPosition | null): position is ManagerPosition => Boolean(position))
}

async function fetchVaultSnapshot(walletAddress: string | null): Promise<VaultSnapshot> {
  const [predictObject, walletPlpBalance, availableWithdrawal] = await Promise.all([
    client.getObject({ id: PREDICT_ID, options: { showContent: true } }),
    walletAddress ? client.getBalance({ owner: walletAddress, coinType: PLP_TYPE }) : null,
    fetchAvailableWithdrawal(walletAddress ?? FALLBACK_SENDER).catch(() => null),
  ])
  const content = predictObject.data?.content
  if (!content || content.dataType !== 'moveObject') {
    throw new Error('Predict vault object unavailable')
  }
  const fields = content.fields as any
  const vault = fields.vault?.fields
  const limiter = fields.withdrawal_limiter?.fields
  const totalBalance = BigInt(vault?.balance ?? 0)
  const totalMtm = BigInt(vault?.total_mtm ?? 0)
  const totalMaxPayout = BigInt(vault?.total_max_payout ?? 0)
  const totalPlpSupply = BigInt(fields.treasury_cap?.fields?.total_supply?.fields?.value ?? 0)
  const availableLiquidity = totalBalance > totalMaxPayout ? totalBalance - totalMaxPayout : 0n
  const cappedWithdrawal =
    availableWithdrawal === null
      ? availableLiquidity
      : availableWithdrawal > availableLiquidity
        ? availableLiquidity
        : availableWithdrawal
  const walletPlp = BigInt(walletPlpBalance?.totalBalance ?? 0)

  return {
    totalBalance: fromDusdc(totalBalance),
    totalMtm: fromDusdc(totalMtm),
    totalMaxPayout: fromDusdc(totalMaxPayout),
    availableLiquidity: fromDusdc(availableLiquidity),
    availableWithdrawal: fromDusdc(cappedWithdrawal),
    vaultValue: fromDusdc(totalBalance - totalMtm),
    totalPlpSupply: fromDusdc(totalPlpSupply),
    walletPlpBalance: fromDusdc(walletPlp),
    walletLpShare: totalPlpSupply > 0n ? Number(walletPlp) / Number(totalPlpSupply) : 0,
    limiterEnabled: Boolean(limiter?.enabled),
  }
}

async function fetchAvailableWithdrawal(sender: string): Promise<bigint> {
  const tx = new Transaction()
  tx.setSender(sender)
  tx.moveCall({
    target: `${PACKAGE_ID}::predict::available_withdrawal`,
    arguments: [tx.object(PREDICT_ID), tx.object(CLOCK_ID)],
  })
  const inspected = await client.devInspectTransactionBlock({ sender, transactionBlock: tx })
  const value = inspected.results?.[0]?.returnValues?.[0]?.[0]
  if (!value) throw new Error(inspected.error ?? 'Available withdrawal unavailable')
  return parseU64ReturnValue(value)
}

async function readManagerQuoteBalance(balanceTableId: string | undefined): Promise<bigint> {
  if (!balanceTableId) return 0n
  const fields = await client.getDynamicFields({ parentId: balanceTableId })
  const quoteBalanceField = fields.data.find(
    (field: DynamicFieldInfo) =>
      field.objectType.includes('::balance::Balance<') && field.objectType.includes(DUSDC_TYPE),
  )
  if (!quoteBalanceField) return 0n
  const object = await client.getObject({
    id: quoteBalanceField.objectId,
    options: { showContent: true },
  })
  const content = object.data?.content
  if (!content || content.dataType !== 'moveObject') return 0n
  return BigInt((content.fields as any).value ?? 0)
}

interface DynamicFieldInfo {
  objectId: string
  objectType: string
}

async function fetchAllDynamicFields(parentId: string): Promise<DynamicFieldInfo[]> {
  const fields: DynamicFieldInfo[] = []
  let cursor: string | null | undefined
  do {
    const page = await client.getDynamicFields({ parentId, cursor })
    fields.push(...page.data)
    cursor = page.hasNextPage ? page.nextCursor : null
  } while (cursor)
  return fields
}

function parseU64ReturnValue(bytes: number[]): bigint {
  return BigInt(bcs.u64().parse(Uint8Array.from(bytes)))
}

function snapStrike(usd: number, tickSize: number, minStrike: number): number {
  const raw = Math.round(usd * PRICE_SCALE)
  if (tickSize <= 0) return Math.max(raw, minStrike)
  const offset = Math.max(raw - minStrike, 0)
  return minStrike + Math.round(offset / tickSize) * tickSize
}

function fromDusdc(value: bigint): number {
  return Number(value) / 10 ** DUSDC_DECIMALS
}

export function describeDirection(direction: Direction): 'ABOVE' | 'BELOW' | 'RANGE' {
  if (direction === 'UP') return 'ABOVE'
  if (direction === 'DOWN') return 'BELOW'
  return 'RANGE'
}

#!/usr/bin/env node
import { bcs } from '@mysten/sui/bcs'
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc'
import { Transaction } from '@mysten/sui/transactions'

const DEFAULT_WALLET = '0x70b56e23fff713cc617cc8e14f3c947e9ee9ced42547fcd952b69df4bee32f70'
const DEFAULT_ORACLE = '0x80a29fb22b1bbc300e3ee8d53a4fbe8aa25b2567cba291fb58053a791c78d951'

const PREDICT_SERVER = 'https://predict-server.testnet.mystenlabs.com'
const PACKAGE_ID = '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138'
const PREDICT_ID = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a'
const CLOCK_ID = '0x6'
const DUSDC_TYPE =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'
const PLP_TYPE = `${PACKAGE_ID}::plp::PLP`
const DUSDC_DECIMALS = 6n
const PLP_DECIMALS = 6n
const PRICE_SCALE = 1_000_000_000
const CONTRACT_UNIT = 10n ** DUSDC_DECIMALS

const TARGETS = {
  availableWithdrawal: `${PACKAGE_ID}::predict::available_withdrawal`,
  marketKeyNew: `${PACKAGE_ID}::market_key::new`,
  rangeKeyNew: `${PACKAGE_ID}::range_key::new`,
  getTradeAmounts: `${PACKAGE_ID}::predict::get_trade_amounts`,
  getRangeTradeAmounts: `${PACKAGE_ID}::predict::get_range_trade_amounts`,
}

const args = parseArgs(process.argv.slice(2))
const wallet = args.wallet ?? DEFAULT_WALLET
const oracleId = args.oracle ?? DEFAULT_ORACLE
const side = (args.side ?? 'above').toLowerCase()
const strikeUsd = Number(args.strike ?? 59_000)
const lowStrikeUsd = Number(args.lowStrike ?? args.low ?? 58_000)
const highStrikeUsd = Number(args.highStrike ?? args.high ?? 62_000)
const contracts = BigInt(args.contracts ?? args.quantity ?? 100)
const network = args.network ?? 'testnet'

const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(network), network })

main().catch((error) => {
  console.error(`\nProbe failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})

async function main() {
  console.log('Predict Club probe')
  console.log('==================')
  console.log(`Network: ${network}`)
  console.log(`Wallet:  ${wallet}`)
  console.log(`Oracle:  ${oracleId}`)
  console.log(`Side:    ${side}`)
  console.log(`Size:    ${contracts.toString()} contract(s)`)

  const [walletBalances, managers, oracleState, vaultState, lpActivity] = await Promise.all([
    fetchWalletBalances(wallet),
    fetchManagers(wallet),
    fetchOracleState(oracleId),
    fetchVaultState(wallet),
    fetchLpActivity(),
  ])

  printBalances(walletBalances)

  const manager = managers[0] ?? null
  printManagers(managers)

  let managerObject = null
  if (manager) {
    managerObject = await readManagerObject(manager.manager_id)
    printManagerObject(managerObject)
  }

  printOracleState(oracleState)
  printVaultState(vaultState, walletBalances, lpActivity)

  const quoteInput = buildQuoteInput(oracleState)
  console.log('\nNew Position input')
  console.log('------------------')
  console.log(JSON.stringify(formatQuoteInput(quoteInput), null, 2))

  const fair = computeFairValuePreview(oracleState, quoteInput)
  if (fair) {
    console.log('\nSVI fair-value preview')
    console.log('----------------------')
    console.log(JSON.stringify(fair, null, 2))
  } else {
    console.log('\nSVI fair-value preview')
    console.log('----------------------')
    console.log('Preview unavailable: missing forward/SVI or invalid strike range.')
  }

  console.log('\nContract devInspect quote')
  console.log('-------------------------')
  try {
    const quote = await quoteNewPosition(quoteInput, wallet)
    console.log(JSON.stringify(quote, null, 2))
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          status: 'unavailable',
          reason: error instanceof Error ? error.message : String(error),
          note: 'This is read-only devInspect. If it fails, check oracle status, expiry, strike bounds, and Move target signature.',
        },
        null,
        2,
      ),
    )
  }
}

function parseArgs(input) {
  const result = {}
  for (let index = 0; index < input.length; index += 1) {
    const item = input[index]
    if (!item.startsWith('--')) continue
    const [rawKey, inlineValue] = item.slice(2).split('=')
    const value = inlineValue ?? input[index + 1]
    if (inlineValue === undefined) index += 1
    result[rawKey] = value
  }
  return result
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.json()
}

async function fetchManagers(owner) {
  const data = await fetchJson(`${PREDICT_SERVER}/managers?owner=${encodeURIComponent(owner)}`)
  if (!Array.isArray(data)) return []
  return data
    .filter((manager) => manager.owner?.toLowerCase() === owner.toLowerCase())
    .sort((left, right) => {
      if (right.checkpoint === left.checkpoint) return right.tx_index - left.tx_index
      return right.checkpoint - left.checkpoint
    })
}

async function fetchOracleState(id) {
  return fetchJson(`${PREDICT_SERVER}/oracles/${id}/state`)
}

async function fetchWalletBalances(owner) {
  const [sui, dusdc, plp] = await Promise.all([
    client.getBalance({ owner }),
    client.getBalance({ owner, coinType: DUSDC_TYPE }),
    client.getBalance({ owner, coinType: PLP_TYPE }),
  ])
  return { sui: BigInt(sui.totalBalance), dusdc: BigInt(dusdc.totalBalance), plp: BigInt(plp.totalBalance) }
}

async function fetchVaultState(sender) {
  const [predictObject, limiterAvailable] = await Promise.all([
    client.getObject({ id: PREDICT_ID, options: { showContent: true } }),
    fetchAvailableWithdrawal(sender).catch(() => null),
  ])
  const content = predictObject.data?.content
  if (!content || content.dataType !== 'moveObject') {
    throw new Error(`Predict object content unavailable for ${PREDICT_ID}`)
  }

  const fields = content.fields
  const vault = fields.vault?.fields
  const treasuryCap = fields.treasury_cap?.fields
  const limiter = fields.withdrawal_limiter?.fields

  const totalBalance = BigInt(vault?.balance ?? 0)
  const totalMtm = BigInt(vault?.total_mtm ?? 0)
  const totalMaxPayout = BigInt(vault?.total_max_payout ?? 0)
  const availableLiquidity = totalBalance > totalMaxPayout ? totalBalance - totalMaxPayout : 0n
  const availableWithdrawal =
    limiterAvailable === null
      ? availableLiquidity
      : limiterAvailable > availableLiquidity
        ? availableLiquidity
        : limiterAvailable

  return {
    acceptedQuoteType: DUSDC_TYPE,
    availableLiquidity,
    availableWithdrawal,
    limiterAvailable: BigInt(limiter?.available ?? 0),
    limiterCapacity: BigInt(limiter?.capacity ?? 0),
    limiterEnabled: Boolean(limiter?.enabled),
    totalBalance,
    totalMaxPayout,
    totalMtm,
    totalPlpSupply: BigInt(treasuryCap?.total_supply?.fields?.value ?? 0),
    vaultValue: totalBalance - totalMtm,
  }
}

async function fetchAvailableWithdrawal(sender) {
  const tx = new Transaction()
  tx.setSender(sender)
  tx.moveCall({
    target: TARGETS.availableWithdrawal,
    arguments: [tx.object(PREDICT_ID), tx.object(CLOCK_ID)],
  })
  const inspected = await client.devInspectTransactionBlock({ sender, transactionBlock: tx })
  const value = inspected.results?.[0]?.returnValues?.[0]?.[0]
  if (!value) throw new Error(inspected.error ?? 'Unable to read available withdrawal')
  return parseU64ReturnValue(value)
}

async function fetchLpActivity() {
  const [suppliesResponse, withdrawalsResponse] = await Promise.all([
    fetch(`${PREDICT_SERVER}/lp/supplies`),
    fetch(`${PREDICT_SERVER}/lp/withdrawals`),
  ])
  const [supplies, withdrawals] = await Promise.all([
    suppliesResponse.ok ? suppliesResponse.json() : [],
    withdrawalsResponse.ok ? withdrawalsResponse.json() : [],
  ])
  return {
    supplies: Array.isArray(supplies) ? supplies : [],
    withdrawals: Array.isArray(withdrawals) ? withdrawals : [],
  }
}

async function readManagerObject(managerId) {
  const object = await client.getObject({ id: managerId, options: { showContent: true } })
  const content = object.data?.content
  if (!content || content.dataType !== 'moveObject') {
    throw new Error(`PredictManager object content unavailable for ${managerId}`)
  }
  const fields = content.fields
  const positionsSize = Number(fields.positions?.fields?.size ?? 0)
  const rangePositionsSize = Number(fields.range_positions?.fields?.size ?? 0)
  const quoteBalance = await readManagerQuoteBalance(fields.balance_manager?.fields?.balances?.fields?.id?.id)
  return {
    id: managerId,
    owner: fields.owner,
    balanceManagerId: fields.balance_manager?.fields?.id?.id,
    positionsTableId: fields.positions?.fields?.id?.id,
    positionsSize,
    rangePositionsTableId: fields.range_positions?.fields?.id?.id,
    rangePositionsSize,
    quoteBalance,
  }
}

async function readManagerQuoteBalance(balanceTableId) {
  if (!balanceTableId) return 0n
  const fields = await client.getDynamicFields({ parentId: balanceTableId })
  const quoteBalanceField = fields.data.find(
    (field) =>
      field.objectType.includes('::balance::Balance<') && field.objectType.includes(DUSDC_TYPE),
  )
  if (!quoteBalanceField) return 0n
  const object = await client.getObject({
    id: quoteBalanceField.objectId,
    options: { showContent: true },
  })
  const content = object.data?.content
  if (!content || content.dataType !== 'moveObject') return 0n
  return BigInt(content.fields.value ?? 0)
}

function buildQuoteInput(state) {
  const oracle = state.oracle
  const tickSize = Number(oracle.tick_size ?? PRICE_SCALE)
  const minStrike = Number(oracle.min_strike ?? 0)
  const expiry = Number(oracle.expiry)
  const quantity = contracts * CONTRACT_UNIT

  if (side === 'range') {
    return {
      kind: 'range',
      oracleId,
      expiry,
      lowStrike: snapStrike(lowStrikeUsd, tickSize, minStrike),
      highStrike: snapStrike(highStrikeUsd, tickSize, minStrike),
      quantity,
      tickSize,
      minStrike,
    }
  }

  return {
    kind: 'binary',
    oracleId,
    expiry,
    isUp: side !== 'below' && side !== 'down',
    strike: snapStrike(strikeUsd, tickSize, minStrike),
    quantity,
    tickSize,
    minStrike,
  }
}

function snapStrike(usd, tickSize, minStrike) {
  const raw = Math.round(usd * PRICE_SCALE)
  if (tickSize <= 0) return Math.max(raw, minStrike)
  const offset = Math.max(raw - minStrike, 0)
  return minStrike + Math.round(offset / tickSize) * tickSize
}

async function quoteNewPosition(input, sender) {
  const tx = new Transaction()
  tx.setSender(sender)

  if (input.kind === 'range') {
    const [rangeKey] = tx.moveCall({
      target: TARGETS.rangeKeyNew,
      arguments: [
        tx.pure.id(input.oracleId),
        tx.pure.u64(input.expiry),
        tx.pure.u64(input.lowStrike),
        tx.pure.u64(input.highStrike),
      ],
    })
    tx.moveCall({
      target: TARGETS.getRangeTradeAmounts,
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
      target: TARGETS.marketKeyNew,
      arguments: [
        tx.pure.id(input.oracleId),
        tx.pure.u64(input.expiry),
        tx.pure.u64(input.strike),
        tx.pure.bool(input.isUp),
      ],
    })
    tx.moveCall({
      target: TARGETS.getTradeAmounts,
      arguments: [
        tx.object(PREDICT_ID),
        tx.object(input.oracleId),
        marketKey,
        tx.pure.u64(input.quantity),
        tx.object(CLOCK_ID),
      ],
    })
  }

  const inspected = await client.devInspectTransactionBlock({
    sender,
    transactionBlock: tx,
  })

  const values = inspected.results?.[1]?.returnValues
  if (!values || values.length < 2) {
    throw new Error(inspected.error ?? 'Unable to read trade amount preview return values')
  }

  const mintCost = parseU64ReturnValue(values[0][0])
  const redeemPayout = parseU64ReturnValue(values[1][0])
  const grossIfWin = input.quantity
  const potentialProfit = grossIfWin > mintCost ? grossIfWin - mintCost : 0n
  const contractCount = Number(input.quantity / CONTRACT_UNIT)

  return {
    status: inspected.error ? 'error' : 'ok',
    error: inspected.error ?? null,
    mintCostRaw: mintCost.toString(),
    mintCostDusdc: formatDusdc(mintCost),
    redeemPayoutRaw: redeemPayout.toString(),
    redeemPayoutDusdc: formatDusdc(redeemPayout),
    contractPriceDusdc: contractCount > 0 ? Number(formatDusdcNumber(mintCost)) / contractCount : null,
    grossIfWinDusdc: formatDusdc(grossIfWin),
    potentialProfitDusdc: formatDusdc(potentialProfit),
    riskReward:
      mintCost > 0n ? Number(formatDusdcNumber(potentialProfit)) / Number(formatDusdcNumber(mintCost)) : null,
  }
}

function parseU64ReturnValue(bytes) {
  return BigInt(bcs.u64().parse(Uint8Array.from(bytes)))
}

function computeFairValuePreview(state, input) {
  const price = state.latest_price
  const svi = state.latest_svi
  if (!price || !svi || Number(price.forward) <= 0) return null

  if (input.kind === 'range') {
    const low = computeAboveFair(Number(price.forward), Number(input.lowStrike), svi)
    const high = computeAboveFair(Number(price.forward), Number(input.highStrike), svi)
    if (low === null || high === null) return null
    const probability = Math.max(0, low - high)
    return formatFairValue(probability)
  }

  const above = computeAboveFair(Number(price.forward), Number(input.strike), svi)
  if (above === null) return null
  const probability = input.isUp ? above : 1 - above
  return formatFairValue(probability)
}

function computeAboveFair(forward, strike, svi) {
  if (forward <= 0 || strike <= 0) return null
  const a = Number(svi.a) / PRICE_SCALE
  const b = Number(svi.b) / PRICE_SCALE
  const rho = signed(Number(svi.rho), Boolean(svi.rho_negative)) / PRICE_SCALE
  const m = signed(Number(svi.m), Boolean(svi.m_negative)) / PRICE_SCALE
  const sigma = Number(svi.sigma) / PRICE_SCALE
  const k = Math.log(strike / forward)
  const d = k - m
  const totalVariance = Math.max(a + b * (rho * d + Math.sqrt(d * d + sigma * sigma)), 2 ** -52)
  const impliedVol = Math.sqrt(totalVariance)
  const d2 = -((k + totalVariance / 2) / impliedVol)
  return normalCdf(d2)
}

function signed(value, negative) {
  return negative ? -value : value
}

function normalCdf(x) {
  return (1 + erf(x / Math.SQRT2)) / 2
}

function erf(x) {
  const sign = x < 0 ? -1 : 1
  const abs = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * abs)
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-abs * abs))
  return sign * y
}

function formatFairValue(probability) {
  const cappedProbability = Math.max(0, Math.min(1, probability))
  const grossIfWin = Number(contracts)
  const fairCost = cappedProbability * grossIfWin
  return {
    probability: cappedProbability,
    probabilityPercent: `${(cappedProbability * 100).toFixed(2)}%`,
    fairContractPriceDusdc: cappedProbability,
    fairEstimatedCostDusdc: fairCost,
    fairPotentialProfitDusdc: grossIfWin - fairCost,
    fairRiskReward: fairCost > 0 ? (grossIfWin - fairCost) / fairCost : null,
  }
}

function printBalances(balances) {
  console.log('\nWallet balances')
  console.log('---------------')
  console.log(`SUI:   ${formatToken(balances.sui, 9n)}`)
  console.log(`DUSDC: ${formatDusdc(balances.dusdc)}`)
  console.log(`PLP:   ${formatToken(balances.plp, PLP_DECIMALS)}`)
}

function printManagers(managers) {
  console.log('\nPredict managers')
  console.log('----------------')
  if (managers.length === 0) {
    console.log('No PredictManager found for this wallet.')
    return
  }
  for (const manager of managers) {
    console.log(
      `${manager.manager_id} owner=${manager.owner} checkpoint=${manager.checkpoint} tx=${manager.tx_index}`,
    )
  }
}

function printManagerObject(manager) {
  console.log('\nLatest manager object')
  console.log('---------------------')
  console.log(JSON.stringify(toPrintable(manager), null, 2))
}

function printOracleState(state) {
  const oracle = state.oracle
  console.log('\nOracle state')
  console.log('------------')
  console.log(
    JSON.stringify(
      {
        oracle_id: oracle.oracle_id,
        status: oracle.status,
        expiry: new Date(Number(oracle.expiry)).toISOString(),
        min_strike: oracle.min_strike,
        tick_size: oracle.tick_size,
        settlement_price: oracle.settlement_price,
        spot: state.latest_price?.spot,
        forward: state.latest_price?.forward,
        latest_svi: state.latest_svi
          ? {
              a: state.latest_svi.a,
              b: state.latest_svi.b,
              rho: `${state.latest_svi.rho_negative ? '-' : ''}${state.latest_svi.rho}`,
              m: `${state.latest_svi.m_negative ? '-' : ''}${state.latest_svi.m}`,
              sigma: state.latest_svi.sigma,
              timestamp: state.latest_svi.onchain_timestamp,
            }
          : null,
      },
      null,
      2,
    ),
  )
}

function printVaultState(vault, walletBalances, lpActivity) {
  const lpShare =
    vault.totalPlpSupply > 0n ? Number(walletBalances.plp) / Number(vault.totalPlpSupply) : 0
  const latestSupply = lpActivity.supplies[0] ?? null
  const latestWithdrawal = lpActivity.withdrawals[0] ?? null

  console.log('\nVault state')
  console.log('-----------')
  console.log(
    JSON.stringify(
      toPrintable({
        acceptedQuoteType: vault.acceptedQuoteType,
        totalBalanceDusdc: formatDusdc(vault.totalBalance),
        estimatedOpenPositionPayoutDusdc: formatDusdc(vault.totalMtm),
        totalMaxPayoutDusdc: formatDusdc(vault.totalMaxPayout),
        availableLiquidityDusdc: formatDusdc(vault.availableLiquidity),
        availableWithdrawalDusdc: formatDusdc(vault.availableWithdrawal),
        vaultValueDusdc: formatDusdc(vault.vaultValue),
        totalPlpSupply: formatToken(vault.totalPlpSupply, PLP_DECIMALS),
        walletPlpBalance: formatToken(walletBalances.plp, PLP_DECIMALS),
        walletLpShare: `${(lpShare * 100).toFixed(lpShare > 0 && lpShare < 0.01 ? 4 : 2)}%`,
        withdrawalLimiter: {
          enabled: vault.limiterEnabled,
          availableDusdc: formatDusdc(vault.limiterAvailable),
          capacityDusdc: formatDusdc(vault.limiterCapacity),
        },
        lpActivity: {
          suppliesCount: lpActivity.supplies.length,
          withdrawalsCount: lpActivity.withdrawals.length,
          latestSupply: latestSupply
            ? {
                amountDusdc: formatDusdc(BigInt(latestSupply.amount ?? 0)),
                sharesMinted: formatToken(BigInt(latestSupply.shares_minted ?? 0), PLP_DECIMALS),
                wallet: latestSupply.supplier,
                checkpoint: latestSupply.checkpoint,
              }
            : null,
          latestWithdrawal: latestWithdrawal
            ? {
                amountDusdc: formatDusdc(BigInt(latestWithdrawal.amount ?? 0)),
                sharesBurned: formatToken(BigInt(latestWithdrawal.shares_burned ?? 0), PLP_DECIMALS),
                wallet: latestWithdrawal.withdrawer,
                checkpoint: latestWithdrawal.checkpoint,
              }
            : null,
        },
      }),
      null,
      2,
    ),
  )
}

function formatQuoteInput(input) {
  if (input.kind === 'range') {
    return {
      kind: input.kind,
      oracleId: input.oracleId,
      expiry: input.expiry,
      lowStrikeRaw: input.lowStrike,
      lowStrikeUsd: input.lowStrike / PRICE_SCALE,
      highStrikeRaw: input.highStrike,
      highStrikeUsd: input.highStrike / PRICE_SCALE,
      quantityRaw: input.quantity.toString(),
      contracts: (input.quantity / CONTRACT_UNIT).toString(),
    }
  }
  return {
    kind: input.kind,
    oracleId: input.oracleId,
    expiry: input.expiry,
    side: input.isUp ? 'ABOVE' : 'BELOW',
    strikeRaw: input.strike,
    strikeUsd: input.strike / PRICE_SCALE,
    quantityRaw: input.quantity.toString(),
    contracts: (input.quantity / CONTRACT_UNIT).toString(),
  }
}

function formatDusdc(value) {
  return formatToken(value, DUSDC_DECIMALS)
}

function formatDusdcNumber(value) {
  return Number(formatDusdc(value))
}

function formatToken(value, decimals) {
  const scale = 10n ** decimals
  const whole = value / scale
  const fraction = (value % scale).toString().padStart(Number(decimals), '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

function toPrintable(value) {
  return JSON.parse(
    JSON.stringify(value, (_, nested) => (typeof nested === 'bigint' ? nested.toString() : nested)),
  )
}

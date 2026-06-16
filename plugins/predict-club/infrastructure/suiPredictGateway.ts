import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc'
import { Transaction } from '@mysten/sui/transactions'
import { parseToUnits } from '@mysten/sui/utils'
import type { Direction } from '../domain/types'
import { TESTNET_RPC_URL } from '../../../src/constants/predict-club'
import { sanitizeClaimError, sanitizeMintError } from './deepbookPredictPricingService'
import { cachedGet } from './rpcCache'

const PREDICT_SERVER = 'https://predict-server.testnet.mystenlabs.com'
// Manager registry rarely changes within a session — cache the list 20s.
const MANAGERS_TTL_MS = 20_000
const PREDICT_ID = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a'
const PREDICT_PACKAGE = '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138'
const CLOCK_ID = '0x6'
const DUSDC_TYPE =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'
const DUSDC_DECIMALS = 6
const STRIKE_SCALE = 1e9

const client = new SuiJsonRpcClient({ url: TESTNET_RPC_URL, network: 'testnet' })

export interface SuiPredictGateway {
  buildMintTx(params: {
    walletAddress: string
    managerId: string
    direction: Direction
    strike: number
    amountDusdc: number
    oracleId: string
    expiry: number
    tickSize: number
    minStrike: number
  }): Promise<Transaction>

  buildMintRangeTx(params: {
    walletAddress: string
    managerId: string
    lowerStrike: number
    upperStrike: number
    amountDusdc: number
    oracleId: string
    expiry: number
    tickSize: number
    minStrike: number
  }): Promise<Transaction>

  buildClaimTx(params: {
    walletAddress: string
    managerId: string
    oracleId: string
    expiry: number
    strike: number
    isUp: boolean
    tickSize: number
    minStrike: number
  }): Promise<Transaction>

  buildCreateManagerTx(walletAddress: string): Transaction

  /** Fetch the manager ID owned by this wallet, or null if none. */
  fetchManagerId(walletAddress: string): Promise<string | null>

  /**
   * Read-only pre-flight that runs the REAL mint PTB through devInspect (zero gas,
   * no wallet prompt). Unlike the pricing read (`get_trade_amounts`), this exercises
   * `predict::mint` and so trips the same mint-time guards a live mint would -
   * notably `assert_mintable_ask` (abort 7), which the pricing read never runs. A
   * far in/out-of-the-money strike thus fails here, before the user is asked to sign.
   * Returns ok:false + a friendly reason when the simulated mint aborts.
   */
  simulateMintBinary(params: {
    walletAddress: string
    managerId: string
    direction: Direction
    strike: number
    amountDusdc: number
    oracleId: string
    expiry: number
    tickSize: number
    minStrike: number
  }): Promise<{ ok: boolean; reason?: string }>

  /**
   * Read-only pre-flight that runs the REAL claim PTB through devInspect (zero gas,
   * no wallet prompt). The contract decides whether a position can be claimed - it
   * is settled, the trader won, and it has not been claimed yet. Simulating the real
   * `predict::claim` lets the drawer offer a Claim button only when the chain agrees,
   * instead of guessing from a settlement price the UI does not authoritatively hold.
   * Returns ok:false + a friendly reason when the simulated claim aborts.
   */
  simulateClaim(params: {
    walletAddress: string
    managerId: string
    oracleId: string
    expiry: number
    strike: number
    isUp: boolean
    tickSize: number
    minStrike: number
  }): Promise<{ ok: boolean; reason?: string }>
}

// ── helpers ───────────────────────────────────────────────────────────────────

function snapStrike(usd: number, tickSize: number, minStrike: number): number {
  const raw = Math.floor(usd * STRIKE_SCALE)
  if (tickSize <= 0) return Math.max(raw, minStrike)
  const offset = Math.max(raw - minStrike, 0)
  return minStrike + Math.round(offset / tickSize) * tickSize
}

// Convert a human DUSDC amount to base units with exact bigint math. Float scaling
// (Math.floor(amount * 1e6)) can underpay - 0.07 * 1e6 lands at 69999.99... and floors
// to 69999. parseToUnits parses a decimal string with no floating point. toFixed clamps
// to DUSDC_DECIMALS first so a float like 0.30000000000000004 cannot trip parseToUnits'
// "too many decimal places" guard.
export function dusdcToUnits(amountDusdc: number): bigint {
  return parseToUnits(amountDusdc.toFixed(DUSDC_DECIMALS), DUSDC_DECIMALS)
}

async function fetchDusdcCoins(
  walletAddress: string,
): Promise<{ coinObjectId: string; balance: string }[]> {
  const res = await fetch(TESTNET_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getCoins',
      params: [walletAddress, DUSDC_TYPE, null, 50],
    }),
  })
  const data = (await res.json()) as {
    result?: { data: { coinObjectId: string; balance: string }[] }
  }
  return data.result?.data ?? []
}

function mergeDusdcAndSplit(tx: Transaction, coins: { coinObjectId: string }[], amountRaw: bigint) {
  const primary = coins[0].coinObjectId
  if (coins.length > 1) {
    tx.mergeCoins(
      tx.object(primary),
      coins.slice(1).map((c) => tx.object(c.coinObjectId)),
    )
  }
  const [depositCoin] = tx.splitCoins(tx.object(primary), [tx.pure.u64(amountRaw)])
  return depositCoin
}

interface BinaryMintParams {
  walletAddress: string
  managerId: string
  direction: Direction
  strike: number
  amountDusdc: number
  oracleId: string
  expiry: number
  tickSize: number
  minStrike: number
}

interface BinaryClaimParams {
  walletAddress: string
  managerId: string
  oracleId: string
  expiry: number
  strike: number
  isUp: boolean
  tickSize: number
  minStrike: number
}

// The single source of truth for the binary claim PTB. Both the real claim
// (buildClaimTx -> sign) and the read-only pre-flight (simulateClaim -> devInspect)
// compose it through here, so the simulated transaction is byte-for-byte the one the
// wallet signs - only devInspect vs execute differs. That is what makes the
// pre-flight trustworthy: it runs predict::claim and trips the same settle/payout
// guards a live claim would, before the user is asked to sign.
function composeClaimTx(params: BinaryClaimParams): Transaction {
  const { walletAddress, managerId, oracleId, expiry, strike, isUp, tickSize, minStrike } = params

  const strikeRaw = snapStrike(strike, tickSize, minStrike)
  const tx = new Transaction()
  tx.setSender(walletAddress)

  const [marketKey] = tx.moveCall({
    target: `${PREDICT_PACKAGE}::market_key::${isUp ? 'up' : 'down'}`,
    arguments: [tx.pure.id(oracleId), tx.pure.u64(expiry), tx.pure.u64(strikeRaw)],
  })

  tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict::claim`,
    typeArguments: [DUSDC_TYPE],
    arguments: [
      tx.object(PREDICT_ID),
      tx.object(managerId),
      tx.object(oracleId),
      marketKey,
      tx.object(CLOCK_ID),
    ],
  })

  return tx
}

// The single source of truth for the binary mint PTB. Both the real mint
// (buildMintTx -> sign) and the read-only pre-flight (simulateMintBinary ->
// devInspect) compose it through here, so the simulated transaction is byte-for-byte
// the one the wallet signs - the only difference is devInspect vs execute. That is
// what makes the pre-flight trustworthy: it runs predict::mint and trips the same
// assert_mintable_ask guard a live mint would.
async function composeBinaryMintTx(params: BinaryMintParams): Promise<Transaction> {
  const {
    walletAddress,
    managerId,
    direction,
    strike,
    amountDusdc,
    oracleId,
    expiry,
    tickSize,
    minStrike,
  } = params

  const amountRaw = dusdcToUnits(amountDusdc)
  const strikeRaw = snapStrike(strike, tickSize, minStrike)
  const coins = await fetchDusdcCoins(walletAddress)
  if (coins.length === 0) throw new Error('No DUSDC coins found in wallet')

  const tx = new Transaction()
  tx.setSender(walletAddress)

  const depositCoin = mergeDusdcAndSplit(tx, coins, amountRaw)

  // Deposit into manager
  tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict_manager::deposit`,
    typeArguments: [DUSDC_TYPE],
    arguments: [tx.object(managerId), depositCoin],
  })

  // Build market key
  const isUp = direction === 'UP'
  const [marketKey] = tx.moveCall({
    target: `${PREDICT_PACKAGE}::market_key::${isUp ? 'up' : 'down'}`,
    arguments: [tx.pure.id(oracleId), tx.pure.u64(expiry), tx.pure.u64(strikeRaw)],
  })

  // Mint
  tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict::mint`,
    typeArguments: [DUSDC_TYPE],
    arguments: [
      tx.object(PREDICT_ID),
      tx.object(managerId),
      tx.object(oracleId),
      marketKey,
      tx.pure.u64(amountRaw),
      tx.object(CLOCK_ID),
    ],
  })

  return tx
}

// ── factory ───────────────────────────────────────────────────────────────────

export function createSuiPredictGateway(): SuiPredictGateway {
  return {
    buildCreateManagerTx(walletAddress) {
      const tx = new Transaction()
      tx.setSender(walletAddress)
      tx.moveCall({ target: `${PREDICT_PACKAGE}::predict::create_manager` })
      return tx
    },

    async fetchManagerId(walletAddress) {
      try {
        const managers = await cachedGet<unknown>(`${PREDICT_SERVER}/managers`, MANAGERS_TTL_MS)
        if (!Array.isArray(managers)) return null
        const found = managers.find(
          (m: any) => m.owner?.toLowerCase() === walletAddress.toLowerCase(),
        )
        return found?.manager_id ?? null
      } catch {
        return null
      }
    },

    async buildMintTx(params) {
      return composeBinaryMintTx(params)
    },

    async simulateMintBinary(params) {
      // Read-only pre-flight: build the exact mint PTB and devInspect it, so the
      // contract runs predict::mint -> assert_mintable_ask with zero gas and no
      // wallet prompt. The pricing read (get_trade_amounts) skips that guard, which
      // is why a far-from-ATM strike could pass the old pre-flight and still abort
      // at sign time (assert_mintable_ask, code 7). Simulating the real mint closes
      // that gap. Any build error (e.g. no DUSDC coins) is reported as not-ok too.
      let tx: Transaction
      try {
        tx = await composeBinaryMintTx(params)
      } catch (error) {
        return { ok: false, reason: sanitizeMintError(error) }
      }
      try {
        const inspected = await client.devInspectTransactionBlock({
          sender: params.walletAddress,
          transactionBlock: tx,
        })
        if (inspected.error) return { ok: false, reason: sanitizeMintError(inspected.error) }
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: sanitizeMintError(error) }
      }
    },

    async buildMintRangeTx(params) {
      const {
        walletAddress,
        managerId,
        lowerStrike,
        upperStrike,
        amountDusdc,
        oracleId,
        expiry,
        tickSize,
        minStrike,
      } = params

      const amountRaw = dusdcToUnits(amountDusdc)
      const lowerRaw = snapStrike(lowerStrike, tickSize, minStrike)
      const upperRaw = snapStrike(upperStrike, tickSize, minStrike)
      const coins = await fetchDusdcCoins(walletAddress)
      if (coins.length === 0) throw new Error('No DUSDC coins found in wallet')

      const tx = new Transaction()
      tx.setSender(walletAddress)

      const depositCoin = mergeDusdcAndSplit(tx, coins, amountRaw)

      tx.moveCall({
        target: `${PREDICT_PACKAGE}::predict_manager::deposit`,
        typeArguments: [DUSDC_TYPE],
        arguments: [tx.object(managerId), depositCoin],
      })

      const [rangeKey] = tx.moveCall({
        target: `${PREDICT_PACKAGE}::range_key::new`,
        arguments: [
          tx.pure.id(oracleId),
          tx.pure.u64(expiry),
          tx.pure.u64(lowerRaw),
          tx.pure.u64(upperRaw),
        ],
      })

      tx.moveCall({
        target: `${PREDICT_PACKAGE}::predict::mint_range`,
        typeArguments: [DUSDC_TYPE],
        arguments: [
          tx.object(PREDICT_ID),
          tx.object(managerId),
          tx.object(oracleId),
          rangeKey,
          tx.pure.u64(amountRaw),
          tx.object.clock(),
        ],
      })

      return tx
    },

    async buildClaimTx(params) {
      return composeClaimTx(params)
    },

    async simulateClaim(params) {
      // Read-only pre-flight: build the exact claim PTB and devInspect it, so the
      // contract runs predict::claim with zero gas and no wallet prompt. The contract
      // is the source of truth on whether a position can be claimed (settled + won +
      // not yet claimed); this surfaces that verdict before the user signs, so a
      // losing / unsettled / already-claimed position shows a reason instead of a
      // doomed on-chain claim. Any build error is reported as not-ok too.
      let tx: Transaction
      try {
        tx = composeClaimTx(params)
      } catch (error) {
        return { ok: false, reason: sanitizeClaimError(error) }
      }
      try {
        const inspected = await client.devInspectTransactionBlock({
          sender: params.walletAddress,
          transactionBlock: tx,
        })
        if (inspected.error) return { ok: false, reason: sanitizeClaimError(inspected.error) }
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: sanitizeClaimError(error) }
      }
    },
  }
}

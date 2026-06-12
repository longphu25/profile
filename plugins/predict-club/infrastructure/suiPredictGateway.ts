import { Transaction } from '@mysten/sui/transactions'
import type { Direction } from '../domain/types'
import { TESTNET_RPC_URL } from '../../../src/constants/predict-club'
import { cachedGet } from './rpcCache'

const PREDICT_SERVER = 'https://predict-server.testnet.mystenlabs.com'
// Manager registry rarely changes within a session — cache the list 20s.
const MANAGERS_TTL_MS = 20_000
const PREDICT_ID = '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a'
const PREDICT_PACKAGE = '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138'
const DUSDC_TYPE =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'
const DUSDC_DECIMALS = 6
const STRIKE_SCALE = 1e9

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
}

// ── helpers ───────────────────────────────────────────────────────────────────

function snapStrike(usd: number, tickSize: number, minStrike: number): number {
  const raw = Math.floor(usd * STRIKE_SCALE)
  if (tickSize <= 0) return Math.max(raw, minStrike)
  const offset = Math.max(raw - minStrike, 0)
  return minStrike + Math.round(offset / tickSize) * tickSize
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

function mergeDusdcAndSplit(tx: Transaction, coins: { coinObjectId: string }[], amountRaw: number) {
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

      const amountRaw = Math.floor(amountDusdc * 10 ** DUSDC_DECIMALS)
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
          tx.object.clock(),
        ],
      })

      return tx
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

      const amountRaw = Math.floor(amountDusdc * 10 ** DUSDC_DECIMALS)
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
      const { walletAddress, managerId, oracleId, expiry, strike, isUp, tickSize, minStrike } =
        params

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
          tx.object.clock(),
        ],
      })

      return tx
    },
  }
}

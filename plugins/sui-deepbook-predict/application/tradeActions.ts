import { Transaction } from '@mysten/sui/transactions'
import { PREDICT_PACKAGE, PREDICT_ID, DUSDC_TYPE, DUSDC_DECIMALS } from '../domain/constants'
import { snapStrikeRaw, usdToStrikeRaw } from '../domain/strike'

interface TradeParams {
  walletAddress: string
  managerId: string
  oracleId: string
  expiry: number
  minStrike: number
  tickSize: number
  action: 'mint' | 'redeem'
  mode: 'binary' | 'range'
  amount: number
  strike?: number
  isUp?: boolean
  lowerStrike?: number
  upperStrike?: number
}

/** Fetch DUSDC coin objects for the wallet. */
async function fetchDusdcCoins(
  walletAddress: string,
): Promise<{ coinObjectId: string; balance: string }[]> {
  const res = await fetch('https://fullnode.testnet.sui.io:443', {
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
  return data.result?.data || []
}

/** Build a create_manager PTB. */
export function buildCreateManager(walletAddress: string): Transaction {
  const tx = new Transaction()
  tx.setSender(walletAddress)
  tx.moveCall({ target: `${PREDICT_PACKAGE}::predict::create_manager` })
  return tx
}

/** Build a mint/redeem binary or range PTB (with optional deposit). */
export async function buildTradeTx(params: TradeParams): Promise<Transaction> {
  const {
    walletAddress,
    managerId,
    oracleId,
    expiry,
    minStrike,
    tickSize,
    action,
    mode,
    amount,
    strike,
    isUp,
    lowerStrike,
    upperStrike,
  } = params

  const amountRaw = Math.floor(amount * 10 ** DUSDC_DECIMALS)
  const snap = (usd: number) => snapStrikeRaw(usdToStrikeRaw(usd), tickSize, minStrike)

  const tx = new Transaction()
  tx.setSender(walletAddress)

  if (action === 'mint') {
    const coins = await fetchDusdcCoins(walletAddress)
    if (coins.length === 0) throw new Error('No DUSDC coins found in wallet.')

    const primaryCoin = coins[0].coinObjectId
    if (coins.length > 1) {
      tx.mergeCoins(
        tx.object(primaryCoin),
        coins.slice(1).map((c) => tx.object(c.coinObjectId)),
      )
    }
    const [depositCoin] = tx.splitCoins(tx.object(primaryCoin), [tx.pure.u64(amountRaw)])
    tx.moveCall({
      target: `${PREDICT_PACKAGE}::predict_manager::deposit`,
      typeArguments: [DUSDC_TYPE],
      arguments: [tx.object(managerId), depositCoin],
    })
  }

  if (mode === 'binary') {
    const strikeRaw = snap(strike!)
    const keyFn = isUp ? 'up' : 'down'
    const [marketKey] = tx.moveCall({
      target: `${PREDICT_PACKAGE}::market_key::${keyFn}`,
      arguments: [tx.pure.id(oracleId), tx.pure.u64(expiry), tx.pure.u64(strikeRaw)],
    })
    tx.moveCall({
      target: `${PREDICT_PACKAGE}::predict::${action === 'mint' ? 'mint' : 'redeem'}`,
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
  } else {
    const lowerRaw = snap(lowerStrike!)
    const upperRaw = snap(upperStrike!)
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
      target: `${PREDICT_PACKAGE}::predict::${action === 'mint' ? 'mint_range' : 'redeem_range'}`,
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
  }

  return tx
}

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import {
  DeepBookClient,
  mainnetCoins,
  mainnetPools,
  mainnetPackageIds,
  testnetCoins,
  testnetPools,
  testnetPackageIds,
} from '@mysten/deepbook-v3'
import { RPC } from './types'

export type Network = 'mainnet' | 'testnet'

export function makeClient(net: Network): SuiGrpcClient {
  return new SuiGrpcClient({ network: net, baseUrl: RPC[net] })
}

/** Create a DeepBookClient with no managers (for swaps, queries) */
export function makeSwapDb(addr: string, net: Network): DeepBookClient {
  return new DeepBookClient({ client: makeClient(net), address: addr, network: net })
}

/** Create a DeepBookClient with a margin manager configured */
export function makeMarginDb(
  addr: string,
  mmId: string,
  poolKey: string,
  net: Network,
): DeepBookClient {
  return new DeepBookClient({
    client: makeClient(net),
    address: addr,
    network: net,
    coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
    pools: net === 'mainnet' ? mainnetPools : testnetPools,
    marginManagers: { main: { address: mmId, poolKey } },
  })
}

/** Create a DeepBookClient with a balance manager configured */
export function makeBalanceDb(addr: string, bmId: string, net: Network): DeepBookClient {
  return new DeepBookClient({
    client: makeClient(net),
    address: addr,
    network: net,
    coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
    pools: net === 'mainnet' ? mainnetPools : testnetPools,
    packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
    balanceManagers: { main: { address: bmId } },
  })
}

/** Create a plain DeepBookClient with packageIds (for BM operations) */
export function makePlainDb(addr: string, net: Network): DeepBookClient {
  return new DeepBookClient({
    client: makeClient(net),
    address: addr,
    network: net,
    coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
    pools: net === 'mainnet' ? mainnetPools : testnetPools,
    packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
  })
}

/** Sign and execute a transaction, wait for propagation */
export async function signAndExecute(
  kp: Ed25519Keypair,
  tx: Transaction,
  net: string,
): Promise<Record<string, unknown>> {
  const client = makeClient(net as Network)
  tx.setSender(kp.getPublicKey().toSuiAddress())
  const built = await tx.build({ client })
  const sig = await kp.signTransaction(built)
  const res = await client.executeTransaction({
    transaction: built,
    signatures: [sig.signature],
    include: { effects: true },
  })
  const inner =
    (res as Record<string, unknown>).Transaction ??
    (res as Record<string, unknown>).FailedTransaction ??
    res
  const data = inner as Record<string, unknown>
  if ((res as Record<string, unknown>).$kind === 'FailedTransaction') {
    throw new Error(
      `Transaction failed: ${JSON.stringify((data.status as Record<string, unknown>)?.error ?? 'unknown')}`,
    )
  }
  await new Promise((r) => setTimeout(r, 1500))
  return data
}

/** Build a swap: spend quote → receive base */
export function buildSwapBuy(
  db: DeepBookClient,
  poolKey: string,
  quoteAmount: number,
  owner: string,
  tx: Transaction,
) {
  const [baseCoin, quoteCoin, deepCoin] = db.deepBook.swapExactQuoteForBase({
    poolKey,
    amount: quoteAmount,
    deepAmount: 0,
    minOut: 0,
  })(tx)
  tx.transferObjects([baseCoin, quoteCoin, deepCoin], owner)
}

/** Build a swap: spend base → receive quote */
export function buildSwapSell(
  db: DeepBookClient,
  poolKey: string,
  baseAmount: number,
  owner: string,
  tx: Transaction,
) {
  const [baseCoin, quoteCoin, deepCoin] = db.deepBook.swapExactBaseForQuote({
    poolKey,
    amount: baseAmount,
    deepAmount: 0,
    minOut: 0,
  })(tx)
  tx.transferObjects([baseCoin, quoteCoin, deepCoin], owner)
}

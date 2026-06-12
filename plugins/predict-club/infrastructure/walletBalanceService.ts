import type { AssetBalances } from '../domain/types'
import { cachedRpc } from './rpcCache'
import { TESTNET_RPC_URL } from '../../../src/constants/predict-club'

const DUSDC_TYPE =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'
const SUI_TYPE = '0x2::sui::SUI'
const DUSDC_DECIMALS = 6
const SUI_DECIMALS = 9
const RPC = TESTNET_RPC_URL

// Balances change slowly relative to render cadence — cache 10s.
const BALANCE_TTL_MS = 10_000

async function getBalance(address: string, coinType: string): Promise<number> {
  try {
    const data = await cachedRpc<{ result?: { totalBalance?: string } }>(
      RPC,
      'suix_getBalance',
      [address, coinType],
      BALANCE_TTL_MS,
    )
    return Number(data?.result?.totalBalance ?? 0)
  } catch {
    return 0
  }
}

export async function fetchWalletBalances(address: string): Promise<AssetBalances> {
  const [suiRaw, dusdcRaw] = await Promise.all([
    getBalance(address, SUI_TYPE),
    getBalance(address, DUSDC_TYPE),
  ])
  return {
    sui: suiRaw / 10 ** SUI_DECIMALS,
    usdc: 0,
    dusdc: dusdcRaw / 10 ** DUSDC_DECIMALS,
  }
}

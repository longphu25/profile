import type { AssetBalances } from '../domain/types'

const DUSDC_TYPE =
  '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC'
const SUI_TYPE = '0x2::sui::SUI'
const DUSDC_DECIMALS = 6
const SUI_DECIMALS = 9
const RPC = 'https://fullnode.testnet.sui.io:443'

async function getBalance(address: string, coinType: string): Promise<number> {
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'suix_getBalance',
        params: [address, coinType],
      }),
    })
    const data = await res.json()
    const raw = Number(data?.result?.totalBalance ?? 0)
    return raw
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

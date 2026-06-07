import {
  CLUB_ESCROW_MARKET_ID,
} from '../../../src/constants/predict-club'
import type { EscrowOfferView } from '../domain/types'

const RPC = 'https://fullnode.testnet.sui.io:443'

interface RpcResult {
  result?: { data: Array<{ data?: { objectId: string; content?: { fields?: any } } }> }
}

/**
 * Fetch open escrow offers from on-chain market dynamic fields.
 * Returns offers formatted for UI display.
 */
export async function fetchOnChainOffers(): Promise<EscrowOfferView[]> {
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'suix_getDynamicFields',
        params: [CLUB_ESCROW_MARKET_ID, null, 50],
      }),
    })
    const data = (await res.json()) as { result?: { data: Array<{ objectId: string; name: any }> } }
    if (!data.result?.data?.length) return []

    // Fetch each offer object
    const objectIds = data.result.data.map((d) => d.objectId)
    const objRes = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'sui_multiGetObjects',
        params: [objectIds, { showContent: true }],
      }),
    })
    const objData = (await objRes.json()) as RpcResult

    const offers: EscrowOfferView[] = (objData.result?.data ?? [])
      .filter((o) => o.data?.content?.fields)
      .map((o) => {
        const f = o.data!.content!.fields
        return {
          id: o.data!.objectId,
          maker: shortenAddress(f.maker ?? f.creator ?? ''),
          offerAsset: extractAssetName(f.offer_type ?? ''),
          wantAsset: extractAssetName(f.want_type ?? ''),
          offerAmount: Number(f.offer_balance ?? 0) / 1e6,
          wantAmount: Number(f.want_amount ?? 0) / 1e6,
          expiry: `epoch ${f.expires_at ?? '?'}`,
          status: 'open' as const,
        }
      })

    return offers
  } catch {
    return []
  }
}

function shortenAddress(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function extractAssetName(typeStr: string): 'DUSDC' | 'USDC' {
  if (typeStr.includes('dusdc')) return 'DUSDC'
  return 'USDC'
}

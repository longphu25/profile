import { CLUB_ESCROW_MARKET_ID, TESTNET_RPC_URL } from '../../../src/constants/predict-club'
import type { EscrowOfferView } from '../domain/types'
import { cachedRpc, invalidateRpc } from './rpcCache'

const RPC = TESTNET_RPC_URL

// Escrow offers refresh on a slow cadence — cache 12s.
const ESCROW_TTL_MS = 12_000

/** Invalidate cached escrow queries (call after creating/filling an offer). */
export function invalidateEscrowCache(): void {
  invalidateRpc('suix_getDynamicFields')
  invalidateRpc('sui_multiGetObjects')
}

interface RpcResult {
  result?: { data: Array<{ data?: { objectId: string; content?: { fields?: any } } }> }
}

/**
 * Fetch open escrow offers from on-chain market dynamic fields.
 * Returns offers formatted for UI display.
 */
export async function fetchOnChainOffers(): Promise<EscrowOfferView[]> {
  try {
    const data = await cachedRpc<{ result?: { data: Array<{ objectId: string; name: any }> } }>(
      RPC,
      'suix_getDynamicFields',
      [CLUB_ESCROW_MARKET_ID, null, 50],
      ESCROW_TTL_MS,
    )
    if (!data.result?.data?.length) return []

    // Fetch each offer object
    const objectIds = data.result.data.map((d) => d.objectId)
    const objData = await cachedRpc<RpcResult>(
      RPC,
      'sui_multiGetObjects',
      [objectIds, { showContent: true }],
      ESCROW_TTL_MS,
    )

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

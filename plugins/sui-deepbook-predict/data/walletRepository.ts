const TESTNET_FULLNODE = 'https://fullnode.testnet.sui.io:443'

export async function getCoinObjects(owner: string, coinType: string, limit = 50) {
  const res = await fetch(TESTNET_FULLNODE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getCoins',
      params: [owner, coinType, null, limit],
    }),
  })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data?.result?.data) ? data.result.data : []
}

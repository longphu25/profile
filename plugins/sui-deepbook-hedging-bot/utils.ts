import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography'

export function formatUsd(v: number): string {
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(2)}K`
  return `$${v.toFixed(2)}`
}

export function formatOBPrice(v: number): string {
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (v >= 1) return v.toFixed(4)
  if (v >= 0.001) return v.toFixed(5)
  return v.toFixed(8)
}

export function formatQty(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toFixed(2)
}

export function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

export function randRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function keypairFromSecret(secret: string): Ed25519Keypair | null {
  try {
    const trimmed = secret.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('suiprivkey')) {
      const { secretKey } = decodeSuiPrivateKey(trimmed)
      return Ed25519Keypair.fromSecretKey(secretKey)
    }
    const bytes = Uint8Array.from(
      atob(trimmed)
        .split('')
        .map((c) => c.charCodeAt(0)),
    )
    const secret32 = bytes.length > 32 ? bytes.slice(1, 33) : bytes.slice(0, 32)
    return Ed25519Keypair.fromSecretKey(secret32)
  } catch {
    return null
  }
}

/** Parse balance from suix_getAllBalances response */
export function findBal(
  res: { result?: { coinType: string; totalBalance: string }[] },
  coinSymbol: string,
  decimals: number,
): number {
  const coins = res.result ?? []
  const match = coins.find((c) =>
    c.coinType.toLowerCase().includes(`::${coinSymbol.toLowerCase()}::`),
  )
  return match ? parseInt(match.totalBalance, 10) / 10 ** decimals : 0
}

/** Fetch all balances for an address */
export async function fetchAllBalances(
  rpcUrl: string,
  addr: string,
): Promise<{ result?: { coinType: string; totalBalance: string }[] }> {
  return fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'suix_getAllBalances', params: [addr] }),
  }).then((r) => r.json())
}

// Voting plugin constants and helpers

export const VOTING_STORAGE_KEY = 'seal-voting-sessions'

/** Seal on-chain decryption package (testnet) */
export const SEAL_ONCHAIN_PKG = '0x4016869413374eaa71df2a043d1660ed7bc927ab7962831f8b07efbc7efdb2c3'

export interface SessionInfo {
  objectId: string
  admin: string
  topic: string
  options: string[]
  eligibleVoters: string[]
  votersSubmitted: string[]
  encryptedBallots: string[] // hex-encoded
  isClosed: boolean
}

export function shortenAddr(addr: string, n = 6): string {
  if (addr.length <= n * 2 + 2) return addr
  return `${addr.slice(0, n + 2)}…${addr.slice(-n)}`
}

/** Fetch a VotingSession object via JSON-RPC */
export async function fetchSession(rpcUrl: string, objectId: string): Promise<SessionInfo | null> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sui_getObject',
      params: [objectId, { showContent: true, showType: true }],
    }),
  })
  const json = await res.json()
  const content = json.result?.data?.content
  if (!content || !('fields' in content)) return null
  const f = content.fields as Record<string, unknown>
  return {
    objectId,
    admin: String(f.admin ?? ''),
    topic: decodeBytes(f.topic),
    options: Array.isArray(f.options) ? (f.options as unknown[]).map(decodeBytes) : [],
    eligibleVoters: Array.isArray(f.eligible_voters) ? (f.eligible_voters as string[]) : [],
    votersSubmitted: Array.isArray(f.voters_submitted) ? (f.voters_submitted as string[]) : [],
    encryptedBallots: Array.isArray(f.encrypted_ballots) ? (f.encrypted_ballots as string[]) : [],
    isClosed: Boolean(f.is_closed),
  }
}

function decodeBytes(v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return new TextDecoder().decode(new Uint8Array(v))
  return String(v ?? '')
}

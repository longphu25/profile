// Predict Club on-chain constants (Testnet)
// Published: 2026-06-07 checkpoint 345441024

export const PREDICT_CLUB_PACKAGE_ID =
  '0x269bdb57cbf02c46a7fe0a72e33c53b36203272d0e029557fca75d4462a96613'

export const CLUB_ESCROW_MARKET_ID =
  '0xb6f225294072afd25255b3215e89876af6221e5e4a3b5c485180753dff04eb11'

export const UPGRADE_CAP_ID = '0xa86e967ff1443d908b09214ca34c12d8e006c0229a2603d5edad3caec8ca7ce2'

export const NETWORK = 'testnet' as const

// ── RPC / network endpoints ──────────────────────────────────────────────────
// Public fullnode (fullnode.testnet.sui.io) does NOT send CORS headers and has
// removed WebSocket subscriptions, so direct browser calls fail. Prefer a
// CORS-friendly RPC. Override via VITE_TESTNET_RPC_URL when a proxy is available.
export const TESTNET_RPC_URL: string =
  (import.meta.env.VITE_TESTNET_RPC_URL as string | undefined) ??
  // In dev, route through the Vite proxy to bypass CORS (see vite.config.ts).
  (import.meta.env.DEV ? '/api/sui-testnet' : 'https://fullnode.testnet.sui.io:443')

// WebSocket event subscriptions are unsupported on public fullnodes; gate behind
// an explicit opt-in so we don't spam failed reconnects in the browser console.
export const TESTNET_WS_URL: string | null =
  (import.meta.env.VITE_TESTNET_WS_URL as string | undefined) ?? null

// Shared Seal config — key servers, constants, helpers

export const WALLET_KEY = 'walletProfile'

export type NetworkKey = 'mainnet' | 'testnet'

export const RPC_URLS: Record<NetworkKey, string> = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
}

/** Bootcamp demo package deployed on testnet */
export const SEAL_PACKAGE_ID = '0x2b5472a9002d97045c8448cda76284aa0de81df3ab902fdfc785feaa2c0b4cc0'

/** Decentralized key server (aggregator-backed, 3-of-5 committee) */
export const TESTNET_KEY_SERVERS = [
  {
    objectId: '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98',
    weight: 1,
    aggregatorUrl: 'https://seal-aggregator-testnet.mystenlabs.com',
  },
]

/** Independent Mysten testnet servers (fallback) */
export const TESTNET_KEY_SERVERS_INDEPENDENT = [
  {
    objectId: '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
    weight: 1,
  },
  {
    objectId: '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
    weight: 1,
  },
]

/** Default threshold — 1 for decentralized server */
export const DEFAULT_THRESHOLD = 1

/** Sui Clock object ID */
export const SUI_CLOCK = '0x0000000000000000000000000000000000000000000000000000000000000006'

export function shortenHex(hex: string, n = 6): string {
  if (hex.length <= n * 2 + 2) return hex
  return `${hex.slice(0, n + 2)}…${hex.slice(-n)}`
}

export function formatBytes(b: number): string {
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(2)} KB`
  return `${b} B`
}

// Shared types for wallet-profile plugin

export const NETWORKS = ['mainnet', 'testnet', 'devnet'] as const
export type Network = (typeof NETWORKS)[number]

export const GRPC_URLS: Record<Network, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
}

export const EXPLORER_URLS: Record<Network, string> = {
  mainnet: 'https://suiscan.xyz/mainnet',
  testnet: 'https://suiscan.xyz/testnet',
  devnet: 'https://suiscan.xyz/devnet',
}

export interface TokenBalance {
  coinType: string
  symbol: string
  balance: string
  decimals: number
  usdValue?: number
}

export interface WalletProfile {
  address: string
  suinsName: string | null
  network: Network
  balances: TokenBalance[]
}

// Shared data key — other plugins read this to get wallet context
export const SHARED_KEY = 'walletProfile'

export function formatBalance(balance: string, decimals = 9): string {
  const val = Number(balance) / 10 ** decimals
  if (val === 0) return '0'
  if (val < 0.0001) return '<0.0001'
  return val.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

export function shortenAddress(addr: string): string {
  if (addr.length <= 16) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

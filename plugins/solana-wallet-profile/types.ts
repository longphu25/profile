// Shared types for solana-wallet-profile plugin

export const SOLANA_NETWORKS = ['devnet', 'testnet', 'mainnet-beta'] as const
export type SolanaNetwork = (typeof SOLANA_NETWORKS)[number]

export const SOLANA_RPC_URLS: Record<SolanaNetwork, string> = {
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
}

export const SOLANA_EXPLORER_URLS: Record<SolanaNetwork, string> = {
  devnet: 'https://explorer.solana.com?cluster=devnet',
  testnet: 'https://explorer.solana.com?cluster=testnet',
  'mainnet-beta': 'https://explorer.solana.com',
}

export interface SolanaTokenBalance {
  mint: string
  symbol: string
  balance: string
  decimals: number
}

export interface SolanaWalletProfile {
  address: string
  network: SolanaNetwork
  balances: SolanaTokenBalance[]
  walletName?: string
  walletIcon?: string
}

export const SOLANA_SHARED_KEY = 'solanaWalletProfile'

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export function getSolanaExplorerAccountUrl(address: string, network: SolanaNetwork): string {
  const base = 'https://explorer.solana.com'
  const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`
  return `${base}/address/${address}${cluster}`
}

export function formatLamports(lamports: string | number, decimals = 9): string {
  const val = Number(lamports) / 10 ** decimals
  if (val === 0) return '0'
  if (val < 0.0001) return '< 0.0001'
  return val.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

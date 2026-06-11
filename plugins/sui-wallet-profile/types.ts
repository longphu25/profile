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
  walletName?: string
  walletIcon?: string
  accounts?: WalletAccount[]
}

// Shared data key — other plugins read this to get wallet context
export const SHARED_KEY = 'walletProfile'
export const PREDICT_CLUB_WALLET_PROFILE_KEY = 'predictClubWalletProfile'

export interface WalletAccount {
  address: string
  walletName?: string
  walletIcon?: string
}

export interface PredictClubWalletProfile {
  manager?: {
    id: string | null
    status?: string
    quoteBalance?: number | null
  } | null
  balances?: {
    sui?: number
    usdc?: number
    dusdc?: number
  } | null
  binaryPositions?: number | null
  rangePositions?: number | null
  positions?: Array<{
    id: string
    kind: 'binary' | 'range'
    oracleId?: string
    quantity?: number
    side?: 'ABOVE' | 'BELOW'
    strike?: number
    lowerStrike?: number
    upperStrike?: number
  }>
  vault?: {
    availableLiquidity?: number | null
    totalMaxPayout?: number | null
    totalMtm?: number | null
    availableWithdrawal?: number | null
    walletPlpBalance?: number | null
    walletLpShare?: number | null
  } | null
}

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

export function isFullSuiAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address)
}

export function getSuiScanAccountUrl(address: string, network: Network = 'testnet'): string {
  return `${EXPLORER_URLS[network]}/account/${address}`
}

export function getSuiScanObjectUrl(objectId: string, network: Network = 'testnet'): string {
  return `${EXPLORER_URLS[network]}/object/${objectId}`
}

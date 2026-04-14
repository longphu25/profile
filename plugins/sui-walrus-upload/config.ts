// Shared types and config for walrus-upload plugin

import { TESTNET_WALRUS_PACKAGE_CONFIG } from '@mysten/walrus'

export type NetworkKey = 'mainnet' | 'testnet'
export type UploadMode = 'publisher' | 'direct'

export interface NetConfig {
  rpc: string
  aggregator: string
  uploadRelay: string
  walType: string
}

export const NET_CONFIG: Record<NetworkKey, NetConfig> = {
  mainnet: {
    rpc: 'https://fullnode.mainnet.sui.io:443',
    aggregator: 'https://aggregator.walrus-mainnet.walrus.space',
    uploadRelay: 'https://upload-relay.mainnet.walrus.space',
    walType: '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL',
  },
  testnet: {
    rpc: 'https://fullnode.testnet.sui.io:443',
    aggregator: 'https://aggregator.walrus-testnet.walrus.space',
    uploadRelay: 'https://upload-relay.testnet.walrus.space',
    walType: '0x9ef7676a9f81937a52ae4b2af8d511a28a0b080477c0c2db40b0ab8882240d76::wal::WAL',
  },
}

export { TESTNET_WALRUS_PACKAGE_CONFIG }

export interface Publisher {
  url: string
  operator: string
}

// Well-known testnet publishers (from docs.wal.app/operators.json)
export const TESTNET_PUBLISHERS: Publisher[] = [
  { url: 'https://publisher.walrus-testnet.walrus.space', operator: 'Mysten Labs' },
  { url: 'https://publisher.walrus-testnet.h2o-nodes.com', operator: 'H2O Nodes' },
  { url: 'https://publisher.testnet.walrus.atalma.io', operator: 'atalma.io' },
  { url: 'https://publisher.walrus-01.tududes.com', operator: 'TuDudes' },
  { url: 'https://publisher.walrus.banansen.dev', operator: 'Nansen' },
  { url: 'https://sui-walrus-testnet-publisher.bwarelabs.com', operator: 'Alchemy Validators' },
  { url: 'https://testnet-publisher-walrus.kiliglab.io', operator: 'KiligLab' },
  { url: 'https://testnet-publisher.walrus.graphyte.dev', operator: 'Graphyte Labs' },
  { url: 'https://suiftly-testnet-pub.mhax.io', operator: 'Suiftly' },
  { url: 'https://sm1-walrus-testnet-publisher.stakesquid.com', operator: 'StakeSquid' },
]

// Mainnet has no public publishers
export const MAINNET_PUBLISHERS: Publisher[] = []

export interface UploadResult {
  blobId: string
  url: string
  size: number
  fileName: string
  mode: UploadMode
  publisher?: string
}

export const WALLET_KEY = 'walletProfile'

export const PRICE_PER_UNIT_EPOCH = 0.5
export const BYTES_PER_UNIT = 1024 * 1024

export function estimateCost(fileSize: number, ep: number) {
  const units = Math.max(1, Math.ceil(fileSize / BYTES_PER_UNIT))
  const storage = units * PRICE_PER_UNIT_EPOCH * ep
  return { units, storage, total: storage + 0.01 }
}

export function formatSize(b: number): string {
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(2)} KB`
  return `${b} B`
}

export function fileIcon(type: string): string {
  if (type.startsWith('image/')) return '🖼️'
  if (type.startsWith('video/')) return '🎬'
  if (type.startsWith('audio/')) return '🎵'
  if (type.includes('pdf')) return '📄'
  return '📁'
}

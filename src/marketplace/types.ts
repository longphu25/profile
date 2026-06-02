// Marketplace & Site Builder type definitions

/** Plugin metadata for the marketplace registry */
export interface PluginMeta {
  /** Unique plugin identifier (matches folder name) */
  id: string
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** Category for filtering */
  category: PluginCategory
  /** Tags for search */
  tags: string[]
  /** Author info */
  author: string
  /** Version string */
  version: string
  /** Icon — Lucide icon name */
  icon: string
  /** Whether plugin requires Sui wallet connection */
  requiresSui: boolean
  /** Preview image URL (optional) */
  preview?: string
  /** Default size in grid units */
  defaultSize: { w: number; h: number }
}

export type PluginCategory =
  | 'wallet'
  | 'defi'
  | 'social'
  | 'utility'
  | 'privacy'
  | 'analytics'
  | 'storage'
  | 'prediction'

export const CATEGORY_LABELS: Record<PluginCategory, string> = {
  wallet: 'Wallet',
  defi: 'DeFi',
  social: 'Social',
  utility: 'Utility',
  privacy: 'Privacy',
  analytics: 'Analytics',
  storage: 'Storage',
  prediction: 'Prediction',
}

/** A plugin instance placed on a site builder page */
export interface PlacedPlugin {
  /** Unique instance ID */
  instanceId: string
  /** Plugin ID from registry */
  pluginId: string
  /** Position order in the layout */
  order: number
  /** User config for this instance */
  config: Record<string, unknown>
}

/** Site builder page state */
export interface SitePage {
  /** Page title */
  title: string
  /** Page slug for URL */
  slug: string
  /** Theme */
  theme: 'light' | 'dark'
  /** Placed plugins in order */
  plugins: PlacedPlugin[]
}

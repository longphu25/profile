import type { NavGroup } from './nav'

export interface DeepBookPluginDef {
  id: string
  name: string
  label: string
  src: string
  styleUrl: string
  group: NavGroup
  status: 'live' | 'simulated' | 'coming-soon'
}

const pluginPath = (name: string) =>
  import.meta.env.DEV
    ? `${import.meta.env.BASE_URL}plugins/${name}/plugin.tsx`
    : `${import.meta.env.BASE_URL}assets/plugins/${name}.js`

export const DEEPBOOK_PLUGINS: DeepBookPluginDef[] = [
  {
    id: 'predict',
    name: 'SuiDeepBookPredict',
    label: 'Predict',
    src: pluginPath('sui-deepbook-predict'),
    styleUrl: '/plugins/sui-deepbook-predict/style.css',
    group: 'predict',
    status: 'live',
  },
  {
    id: 'swap',
    name: 'SuiSwap',
    label: 'Swap',
    src: pluginPath('sui-swap'),
    styleUrl: '/plugins/sui-swap/style.css',
    group: 'trade',
    status: 'live',
  },
  {
    id: 'orderbook',
    name: 'SuiDeepBookOrderbook',
    label: 'Orderbook',
    src: pluginPath('sui-deepbook-orderbook'),
    styleUrl: '/plugins/sui-deepbook-orderbook/style.css',
    group: 'trade',
    status: 'live',
  },
  {
    id: 'portfolio',
    name: 'SuiDeepBookPortfolio',
    label: 'Portfolio',
    src: pluginPath('sui-deepbook-portfolio'),
    styleUrl: '/plugins/sui-deepbook-portfolio/style.css',
    group: 'portfolio',
    status: 'live',
  },
  {
    id: 'margin',
    name: 'SuiMarginManager',
    label: 'Margin',
    src: pluginPath('sui-margin-manager'),
    styleUrl: '/plugins/sui-margin-manager/style.css',
    group: 'portfolio',
    status: 'live',
  },
  {
    id: 'abyss-vault',
    name: 'AbyssVault',
    label: 'Abyss Vault',
    src: pluginPath('abyss-vault'),
    styleUrl: '/plugins/abyss-vault/style.css',
    group: 'earn',
    status: 'live',
  },
  {
    id: 'hedging-bot',
    name: 'SuiDeepBookHedgingBot',
    label: 'Hedging Bot',
    src: pluginPath('sui-deepbook-hedging-bot'),
    styleUrl: '/plugins/sui-deepbook-hedging-bot/style.css',
    group: 'bots',
    status: 'live',
  },
  {
    id: 'hedging-monitor',
    name: 'SuiHedgingMonitor',
    label: 'Bot Monitor',
    src: pluginPath('sui-hedging-monitor'),
    styleUrl: '/plugins/sui-hedging-monitor/style.css',
    group: 'bots',
    status: 'live',
  },
  {
    id: 'analysis',
    name: 'SuiDeepBookAnalysis',
    label: 'Analysis',
    src: pluginPath('sui-deepbook-analysis'),
    styleUrl: '/plugins/sui-deepbook-analysis/style.css',
    group: 'advanced',
    status: 'live',
  },
  {
    id: 'pool-explorer',
    name: 'SuiPoolExplorer',
    label: 'Pool Explorer',
    src: pluginPath('sui-pool-explorer'),
    styleUrl: '/plugins/sui-pool-explorer/style.css',
    group: 'advanced',
    status: 'live',
  },
  {
    id: 'price-feed',
    name: 'SuiPriceFeed',
    label: 'Price Feed',
    src: pluginPath('sui-price-feed'),
    styleUrl: '/plugins/sui-price-feed/style.css',
    group: 'advanced',
    status: 'live',
  },
]

export function getGroupPlugins(group: NavGroup): DeepBookPluginDef[] {
  return DEEPBOOK_PLUGINS.filter((plugin) => plugin.group === group)
}

export function getPluginById(id: string): DeepBookPluginDef | undefined {
  return DEEPBOOK_PLUGINS.find((plugin) => plugin.id === id)
}

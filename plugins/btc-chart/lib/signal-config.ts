// BTC Chart — Signal & Trade Setup configuration (indicator selection + presets)

/** All available feature keys used by the ML signal and Trade Setup engine. */
export const ALL_FEATURES = [
  'NWE_pos',
  'Price>NWE_mid',
  'Price>MA50',
  'Price>MA200',
  'MA50>MA200',
  'RSI',
  'MACD_hist',
  'MACD_acc',
  'Mom5',
  'VolSpike',
  'ADX',
  'StochRSI',
  'OBV',
  'VWAP',
  'Divergence',
] as const

export type FeatureKey = (typeof ALL_FEATURES)[number]

/** Which features are enabled for the ML signal and trade setup. */
export type SignalConfig = Record<FeatureKey, boolean>

/** A named preset: a subset of features grouped by strategy style. */
export interface SignalPreset {
  id: string
  name: string
  description: string
  features: FeatureKey[]
}

/** Default ML features for Lux zone + SMC structure Trade Setup stack. */
export const LUX_SMC_SIGNAL_PRESET: SignalPreset = {
  id: 'luxSmc',
  name: 'Lux + SMC',
  description: 'Lux NWE band + RSI/Vol; SMC votes from chart layer',
  features: ['NWE_pos', 'Price>NWE_mid', 'RSI', 'VolSpike'],
}

/** Presets for quick selection. */
export const SIGNAL_PRESETS: SignalPreset[] = [
  LUX_SMC_SIGNAL_PRESET,
  {
    id: 'all',
    name: 'Full (All)',
    description: 'Tat ca chi bao, do chinh xac cao nhat',
    features: [...ALL_FEATURES],
  },
  {
    id: 'trend',
    name: 'Trend Following',
    description: 'MA, ADX, MACD: bat xu huong manh',
    features: ['Price>MA50', 'Price>MA200', 'MA50>MA200', 'ADX', 'MACD_hist', 'MACD_acc', 'Mom5'],
  },
  {
    id: 'reversal',
    name: 'Mean Reversion',
    description: 'RSI, Stoch, Bollinger, Divergence: bat dao chieu',
    features: ['NWE_pos', 'Price>NWE_mid', 'RSI', 'StochRSI', 'Divergence', 'OBV'],
  },
  {
    id: 'scalp',
    name: 'Scalping M1',
    description: 'VWAP, Vol, Mom: giao dich ngan',
    features: ['VWAP', 'VolSpike', 'Mom5', 'RSI', 'StochRSI'],
  },
  {
    id: 'volume',
    name: 'Volume Flow',
    description: 'OBV, VWAP, Vol Spike: theo dong tien',
    features: ['OBV', 'VWAP', 'VolSpike', 'ADX', 'Mom5'],
  },
  {
    id: 'momentum',
    name: 'Momentum',
    description: 'RSI, MACD, Mom, Stoch: do luc day',
    features: ['RSI', 'MACD_hist', 'MACD_acc', 'Mom5', 'StochRSI', 'ADX'],
  },
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Chi MA + RSI + ADX: it nhieu, chac',
    features: ['Price>MA50', 'MA50>MA200', 'RSI', 'ADX'],
  },
]

/** Preset groups for the signal config panel (strategy style). */
export const SIGNAL_PRESET_GROUPS: ReadonlyArray<{
  readonly label: string
  readonly presetIds: readonly string[]
}> = [
  { label: 'Tổng hợp', presetIds: ['luxSmc', 'all', 'conservative'] },
  { label: 'Xu hướng', presetIds: ['trend', 'momentum'] },
  { label: 'Đảo chiều', presetIds: ['reversal'] },
  { label: 'Scalp & Dòng tiền', presetIds: ['scalp', 'volume'] },
]

/** Resolve a preset id from {@link SIGNAL_PRESET_GROUPS}. */
export function lookupSignalPreset(presetId: string): SignalPreset | undefined {
  return SIGNAL_PRESETS.find((p) => p.id === presetId)
}

/** Human-readable labels for features. */
export const FEATURE_NAMES: Record<FeatureKey, string> = {
  NWE_pos: 'Band Position',
  'Price>NWE_mid': 'Price > NWE Mid',
  'Price>MA50': 'Price > MA50',
  'Price>MA200': 'Price > MA200',
  'MA50>MA200': 'MA50 / MA200 Cross',
  RSI: 'RSI (14)',
  MACD_hist: 'MACD Histogram',
  MACD_acc: 'MACD Acceleration',
  Mom5: 'Momentum (5)',
  VolSpike: 'Volume Spike',
  ADX: 'ADX / DMI',
  StochRSI: 'Stochastic RSI',
  OBV: 'On-Balance Volume',
  VWAP: 'VWAP',
  Divergence: 'RSI Divergence',
}

/** Category groupings for visual display. */
export const FEATURE_GROUPS: { label: string; keys: FeatureKey[] }[] = [
  { label: 'Trend', keys: ['Price>MA50', 'Price>MA200', 'MA50>MA200', 'ADX'] },
  { label: 'Momentum', keys: ['RSI', 'MACD_hist', 'MACD_acc', 'Mom5', 'StochRSI'] },
  { label: 'Volume', keys: ['OBV', 'VWAP', 'VolSpike'] },
  { label: 'Band/Reversal', keys: ['NWE_pos', 'Price>NWE_mid', 'Divergence'] },
]

/** Build a SignalConfig from a preset. */
export function configFromPreset(preset: SignalPreset): SignalConfig {
  const cfg = Object.fromEntries(ALL_FEATURES.map((k) => [k, false])) as SignalConfig
  for (const k of preset.features) cfg[k] = true
  return cfg
}

/** Default signal config for new sessions (Lux band + light ML; SMC votes via layer). */
export const DEFAULT_SIGNAL_CONFIG: SignalConfig = configFromPreset(LUX_SMC_SIGNAL_PRESET)

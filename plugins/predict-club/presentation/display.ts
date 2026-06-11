export type SuiScanTarget = 'account' | 'object'

export function formatCompactDusdc(
  value: number | null | undefined,
  options?: { signed?: boolean },
) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'

  const abs = Math.abs(value)
  const sign = options?.signed && value > 0 ? '+' : value < 0 ? '-' : ''
  const compact =
    abs >= 1_000_000_000
      ? `${(abs / 1_000_000_000).toLocaleString('en-US', {
          maximumFractionDigits: 2,
          minimumFractionDigits: abs < 10_000_000_000 ? 2 : 0,
        })}B`
      : abs >= 1_000_000
        ? `${(abs / 1_000_000).toLocaleString('en-US', {
            maximumFractionDigits: 2,
            minimumFractionDigits: abs < 10_000_000 ? 2 : 0,
          })}M`
        : abs >= 1_000
          ? abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
          : abs.toLocaleString('en-US', { maximumFractionDigits: 2 })

  return `${sign}${compact}`
}

export function formatProbabilityLabel(
  probability: number | null | undefined,
  options?: { degraded?: boolean; reason?: string },
) {
  if (options?.reason === 'Probability floored for display') return '<0.1%'
  if (options?.degraded || probability === null || probability === undefined) return '—'
  if (!Number.isFinite(probability) || probability <= 0) return '—'
  return `${(probability * 100).toLocaleString('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}%`
}

export function shortenSuiAddress(value: string, head = 6, tail = 4) {
  if (value.length <= head + tail + 3) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

export function getSuiScanUrl(value: string, target: SuiScanTarget = 'object') {
  const segment = target === 'account' ? 'account' : 'object'
  return `https://suiscan.xyz/testnet/${segment}/${value}`
}

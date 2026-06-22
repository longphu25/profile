// BTC Chart — number/price/time formatters (pure).

/** Price formatter: thousands separators above 10k, 5 decimals below 1. */
export const fmtP = (n: number): string =>
  n >= 10000
    ? n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : n < 1
      ? n.toFixed(5)
      : n.toFixed(2)

/** Compact volume formatter (K / M / B). */
export const fmtV = (n: number): string =>
  n >= 1e9
    ? (n / 1e9).toFixed(2) + 'B'
    : n >= 1e6
      ? (n / 1e6).toFixed(2) + 'M'
      : n >= 1e3
        ? (n / 1e3).toFixed(1) + 'K'
        : n.toFixed(0)

export const tsNow = (): string => new Date().toLocaleTimeString('vi-VN')

export function formatPriceShort(n: number) {
  return n >= 10000
    ? n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : n < 1
      ? n.toFixed(5)
      : n.toFixed(2)
}

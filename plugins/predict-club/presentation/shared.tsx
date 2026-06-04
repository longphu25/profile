/** Shared tiny components used across panels */

export function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {name}
    </span>
  )
}

export function labelize(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value > 1000 ? 0 : 2,
  }).format(value)
}

export function formatSigned(value: number) {
  return `${value >= 0 ? '+' : ''}${formatUsd(value)} DUSDC`
}

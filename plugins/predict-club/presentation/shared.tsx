/** Shared tiny components used across panels */

import { useState, useEffect, useCallback } from 'react'
import { formatCompactDusdc, getSuiScanUrl, shortenSuiAddress, type SuiScanTarget } from './display'

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

export { formatCompactDusdc, getSuiScanUrl, shortenSuiAddress }

export function formatSigned(value: number) {
  return `${value >= 0 ? '+' : ''}${formatUsd(value)} DUSDC`
}

/** Truncate a wallet address to first 6 + last 4 chars */
export function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function AddressControl({
  value,
  target = 'object',
  label,
  className = '',
}: {
  value: string
  target?: SuiScanTarget
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const href = getSuiScanUrl(value, target)

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1 min-w-0 font-data text-data-sm tabular-nums ${className}`}
      title={value}
    >
      <button
        type="button"
        className="min-w-0 truncate text-primary-fixed-dim hover:text-primary transition-colors"
        onClick={copyValue}
        aria-label={`Copy ${label ?? target}`}
      >
        {shortenSuiAddress(value)}
      </button>
      <button
        type="button"
        className="material-symbols-outlined text-[14px] text-on-surface-variant hover:text-primary-fixed-dim transition-colors"
        onClick={copyValue}
        aria-label={`Copy full ${label ?? target}`}
      >
        {copied ? 'check' : 'content_copy'}
      </button>
      <a
        className="material-symbols-outlined text-[14px] text-on-surface-variant hover:text-primary-fixed-dim transition-colors"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`View ${label ?? target} on SuiScan`}
      >
        open_in_new
      </a>
    </span>
  )
}

/** Classify a wallet error message into a user-friendly message */
export function classifyWalletError(error: string): string {
  const lower = error.toLowerCase()
  if (lower.includes('rejected') || lower.includes('cancelled') || lower.includes('denied')) {
    return 'Transaction cancelled by user'
  }
  if (lower.includes('network') || lower.includes('mismatch')) {
    return 'Network mismatch — please switch to Sui Testnet'
  }
  if (lower.includes('insufficient') || lower.includes('balance')) {
    return 'Insufficient balance for transaction'
  }
  if (lower.includes('failed')) {
    return `Transaction failed: ${error}`
  }
  return error || 'Unknown wallet error'
}

/** Toast notification hook for displaying transient error/success messages */
export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const showError = useCallback((message: string) => {
    setToast({ message, type: 'error' })
  }, [])

  const showSuccess = useCallback((message: string) => {
    setToast({ message, type: 'success' })
  }, [])

  return { toast, showError, showSuccess, dismiss: () => setToast(null) }
}

/** Toast notification display component */
export function ToastNotification({
  message,
  type,
  onDismiss,
}: {
  message: string
  type: 'error' | 'success'
  onDismiss: () => void
}) {
  const bgClass =
    type === 'error'
      ? 'bg-error-container text-on-error-container'
      : 'bg-primary-container text-on-primary-container'
  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-sm px-md py-sm rounded-lg shadow-lg ${bgClass} animate-slide-up`}
    >
      <Icon name={type === 'error' ? 'error' : 'check_circle'} />
      <span className="text-body-md">{message}</span>
      <button
        type="button"
        className="cursor-pointer opacity-70 hover:opacity-100"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        <Icon name="close" />
      </button>
    </div>
  )
}

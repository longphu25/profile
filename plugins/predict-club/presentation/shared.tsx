/** Shared tiny components used across panels */

import { useState, useEffect, useCallback } from 'react'

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

/** Truncate a wallet address to first 6 + last 4 chars */
export function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
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

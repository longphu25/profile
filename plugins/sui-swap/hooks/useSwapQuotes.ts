import { useState, useEffect, useRef, useCallback } from 'react'
import type { QuoteParams, RouteQuote, DexId } from '../lib/types'
import { withTimeout } from '../lib/utils'
import { defaultRouter } from '../lib/router'

const DEBOUNCE_MS = 300

/**
 * useSwapQuotes — streaming quote hook.
 *
 * Fetches quotes from all registered adapters in parallel.
 * Renders results incrementally as each adapter responds.
 * Follows Interface Segregation: consumers only see QuoteResult shape.
 */
export function useSwapQuotes(params: QuoteParams | null) {
  const [quotes, setQuotes] = useState<RouteQuote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runIdRef = useRef(0)

  const fetchQuotes = useCallback((p: QuoteParams) => {
    const runId = ++runIdRef.current
    setLoading(true)
    setError(null)
    setQuotes([])

    const adapters = defaultRouter['adapters'] as Array<{
      id: DexId
      timeout: number
      supportsPair: (from: string, to: string, network: 'mainnet' | 'testnet') => boolean
      fetchQuote: (params: QuoteParams) => Promise<RouteQuote>
    }>

    const eligible = adapters.filter((a) => a.supportsPair(p.fromToken, p.toToken, p.network))

    const promises = eligible.map((adapter) =>
      withTimeout(adapter.fetchQuote(p), adapter.timeout)
        .then((quote) => {
          if (runIdRef.current !== runId) return
          setQuotes((prev) => [...prev, quote].sort((a, b) => b.outputAmount - a.outputAmount))
        })
        .catch(() => {}),
    )

    Promise.allSettled(promises).then(() => {
      if (runIdRef.current !== runId) return
      setLoading(false)
      setQuotes((prev) => {
        if (prev.length === 0) setError('No routes found. Try a different pair or amount.')
        return prev
      })
    })
  }, [])

  useEffect(() => {
    if (!params || !params.amount || params.amount <= 0) {
      setQuotes([])
      setLoading(false)
      setError(null)
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchQuotes(params), DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [params?.fromToken, params?.toToken, params?.amount, params?.network, fetchQuotes])

  const bestDex: DexId | null = quotes.length > 0 ? quotes[0].dex : null

  return { quotes, loading, error, bestDex }
}

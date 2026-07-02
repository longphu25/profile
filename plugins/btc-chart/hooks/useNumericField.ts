// BTC Chart — draft string state for numeric inputs (mobile-friendly editing).

import { useCallback, useEffect, useState } from 'react'
import { isNumericDraft } from '../lib/numeric-field'

export interface UseNumericFieldOptions {
  readonly value: number
  readonly onChange: (value: number) => void
  readonly format?: (value: number) => string
  readonly parse: (raw: string, fallback: number) => number
}

/**
 * Keeps a local draft string so users can clear and retype on mobile.
 * Commits parsed value on blur; reverts invalid drafts to the last good value.
 */
export function useNumericField({
  value,
  onChange,
  format = String,
  parse,
}: UseNumericFieldOptions) {
  const [draft, setDraft] = useState(() => format(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(format(value))
  }, [value, focused, format])

  const onInputChange = useCallback((raw: string) => {
    if (!isNumericDraft(raw)) return
    setDraft(raw)
  }, [])

  const commit = useCallback(() => {
    const next = parse(draft, value)
    onChange(next)
    setDraft(format(next))
  }, [draft, value, onChange, parse, format])

  const onFocus = useCallback(() => setFocused(true), [])

  const onBlur = useCallback(() => {
    setFocused(false)
    commit()
  }, [commit])

  return { draft, onInputChange, onFocus, onBlur }
}

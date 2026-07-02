// BTC Chart — mobile-friendly numeric input with Zod-backed commit on blur.

import { useNumericField } from '../hooks/useNumericField'

export interface NumericFieldInputProps {
  readonly id: string
  readonly label?: string
  readonly value: number
  readonly onChange: (value: number) => void
  readonly parse: (raw: string, fallback: number) => number
  readonly format?: (value: number) => string
  readonly className?: string
  readonly inputClassName?: string
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly 'aria-label'?: string
}

/**
 * Text input with inputMode decimal so mobile keyboards work and values can be cleared mid-edit.
 */
export function NumericFieldInput({
  id,
  label,
  value,
  onChange,
  parse,
  format,
  className = 'sb-input-field',
  inputClassName = 'btc-chart__numeric-input',
  min,
  max,
  step,
  'aria-label': ariaLabel,
}: NumericFieldInputProps) {
  const { draft, onInputChange, onFocus, onBlur } = useNumericField({
    value,
    onChange,
    parse,
    format,
  })

  const input = (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="done"
      className={inputClassName}
      value={draft}
      onChange={(e) => onInputChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel ?? label}
    />
  )

  if (!label) return input

  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      {input}
    </div>
  )
}

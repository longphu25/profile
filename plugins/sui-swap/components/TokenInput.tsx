import type { FC } from 'react'

interface TokenInputProps {
  label: string
  amount: string
  onAmountChange?: (value: string) => void
  token: string
  onTokenChange: (token: string) => void
  tokens: string[]
  readOnly?: boolean
  displayValue?: string
}

/** Reusable token input card — SRP: only handles input display + selection */
export const TokenInput: FC<TokenInputProps> = ({
  label,
  amount,
  onAmountChange,
  token,
  onTokenChange,
  tokens,
  readOnly,
  displayValue,
}) => (
  <div className="sui-swap__card">
    <div className="sui-swap__card-label">{label}</div>
    <div className="sui-swap__card-row">
      {readOnly ? (
        <div className="sui-swap__amount-output">{displayValue || '0.0'}</div>
      ) : (
        <input
          className="sui-swap__amount-input"
          type="number"
          placeholder="0.0"
          value={amount}
          onChange={(e) => onAmountChange?.(e.target.value)}
        />
      )}
      <select
        className="sui-swap__token-select"
        value={token}
        onChange={(e) => onTokenChange(e.target.value)}
      >
        {tokens.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  </div>
)

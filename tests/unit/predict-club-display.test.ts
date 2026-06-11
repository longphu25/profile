import { describe, expect, test } from 'bun:test'
import {
  formatCompactDusdc,
  formatProbabilityLabel,
  getSuiScanUrl,
  shortenSuiAddress,
} from '../../plugins/predict-club/presentation/display'

describe('Predict Club display formatting', () => {
  test('does not show missing probability as 0.0%', () => {
    expect(formatProbabilityLabel(null)).toBe('—')
    expect(formatProbabilityLabel(0)).toBe('—')
    expect(formatProbabilityLabel(undefined, { degraded: true })).toBe('—')
  })

  test('keeps floored probability explicit', () => {
    expect(formatProbabilityLabel(0.00001, { reason: 'Probability floored for display' })).toBe(
      '<0.1%',
    )
  })

  test('formats large DUSDC values compactly', () => {
    expect(formatCompactDusdc(17_307_956_939.05)).toBe('17.31B')
    expect(formatCompactDusdc(265.25, { signed: true })).toBe('+265.25')
    expect(formatCompactDusdc(null)).toBe('—')
  })

  test('builds SuiScan testnet links for account and object ids', () => {
    const id = `0x${'1'.repeat(64)}`
    expect(shortenSuiAddress(id)).toBe('0x1111…1111')
    expect(getSuiScanUrl(id, 'account')).toBe(`https://suiscan.xyz/testnet/account/${id}`)
    expect(getSuiScanUrl(id, 'object')).toBe(`https://suiscan.xyz/testnet/object/${id}`)
  })
})

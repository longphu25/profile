import { describe, expect, test } from 'bun:test'
import { sanitizeContractQuoteReason } from '../../plugins/predict-club/infrastructure/deepbookPredictPricingService'

describe('Predict Club contract quote messaging', () => {
  test('hides raw pricing_config MoveAbort details from user-facing quote reason', () => {
    const reason = sanitizeContractQuoteReason(
      'ExecutionError: MoveAbort pricing_config::quote_spread_from_fair_price at offset 17',
    )

    expect(reason).toContain('selected strike is outside the contract pricing bounds')
    expect(reason).not.toContain('ExecutionError')
    expect(reason).not.toContain('MoveAbort')
    expect(reason).not.toContain('offset 17')
  })

  test('collapses long devInspect errors to a short fallback reason', () => {
    const reason = sanitizeContractQuoteReason(`ExecutionError: ${'x'.repeat(300)}`)

    expect(reason).toBe(
      'Contract quote unavailable from devInspect. Use the SVI preview and retry with a nearer strike or active oracle.',
    )
  })
})

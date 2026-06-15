import { describe, expect, test } from 'bun:test'
import {
  classifyPosition,
  positionKey,
  positionMoneyness,
  positionSideLabel,
  positionStrikeUsd,
} from '../../plugins/predict-club/domain/studioPositions'
import { sanitizeClaimError } from '../../plugins/predict-club/infrastructure/deepbookPredictPricingService'
import type { ManagerPosition } from '../../plugins/predict-club/infrastructure/deepbookPredictPricingService'

const NOW = 1_700_000_000_000
const MINUTE_MS = 60_000

// A binary position fixture; individual tests override the one field they exercise.
function binaryPosition(overrides: Partial<ManagerPosition> = {}): ManagerPosition {
  return {
    id: '0xpos',
    kind: 'binary',
    oracleId: '0xoracle',
    expiry: NOW + 30 * MINUTE_MS,
    quantity: 10,
    side: 'ABOVE',
    strike: 65_000,
    ...overrides,
  }
}

describe('classifyPosition', () => {
  test('live while expiry is in the future', () => {
    expect(classifyPosition(binaryPosition({ expiry: NOW + MINUTE_MS }), NOW)).toBe('live')
  })

  test('expired once expiry has passed', () => {
    expect(classifyPosition(binaryPosition({ expiry: NOW - MINUTE_MS }), NOW)).toBe('expired')
  })

  test('expired exactly at the boundary (expiry == now is not still live)', () => {
    expect(classifyPosition(binaryPosition({ expiry: NOW }), NOW)).toBe('expired')
  })
})

describe('positionSideLabel', () => {
  test('ABOVE maps to UP', () => {
    expect(positionSideLabel(binaryPosition({ side: 'ABOVE' }))).toBe('UP')
  })

  test('BELOW maps to DOWN', () => {
    expect(positionSideLabel(binaryPosition({ side: 'BELOW' }))).toBe('DOWN')
  })

  test('null when no side (range position)', () => {
    expect(positionSideLabel(binaryPosition({ side: undefined }))).toBeNull()
  })
})

describe('positionStrikeUsd', () => {
  test('returns the strike when finite', () => {
    expect(positionStrikeUsd(binaryPosition({ strike: 65_000 }))).toBe(65_000)
  })

  test('null when strike is absent', () => {
    expect(positionStrikeUsd(binaryPosition({ strike: undefined }))).toBeNull()
  })
})

describe('positionMoneyness', () => {
  test('positive when strike is above the forward', () => {
    expect(positionMoneyness(binaryPosition({ strike: 66_000 }), 60_000)).toBe('+10.0%')
  })

  test('negative when strike is below the forward', () => {
    expect(positionMoneyness(binaryPosition({ strike: 57_000 }), 60_000)).toBe('-5.0%')
  })

  test('null when the forward is missing or non-positive', () => {
    expect(positionMoneyness(binaryPosition(), null)).toBeNull()
    expect(positionMoneyness(binaryPosition(), 0)).toBeNull()
  })

  test('null when the strike is missing', () => {
    expect(positionMoneyness(binaryPosition({ strike: undefined }), 60_000)).toBeNull()
  })
})

describe('positionKey', () => {
  test('is stable across two reads of the same position', () => {
    expect(positionKey(binaryPosition())).toBe(positionKey(binaryPosition()))
  })

  test('differs by side so an UP and DOWN at the same strike never collide', () => {
    const up = positionKey(binaryPosition({ side: 'ABOVE' }))
    const down = positionKey(binaryPosition({ side: 'BELOW' }))
    expect(up).not.toBe(down)
  })

  test('differs by strike', () => {
    const a = positionKey(binaryPosition({ strike: 65_000 }))
    const b = positionKey(binaryPosition({ strike: 66_000 }))
    expect(a).not.toBe(b)
  })
})

describe('sanitizeClaimError', () => {
  test('unsettled abort reads as still live', () => {
    expect(sanitizeClaimError(new Error('MoveAbort ... not_settled'))).toBe(
      'Not settled yet - this position is still live.',
    )
  })

  test('already-claimed abort reads as already claimed', () => {
    expect(sanitizeClaimError(new Error('already_claimed'))).toBe('Already claimed.')
  })

  test('zero-payout abort reads as a loss', () => {
    expect(sanitizeClaimError(new Error('zero_payout'))).toBe(
      'This position lost - nothing to claim.',
    )
  })

  test('wallet rejection reads as a rejection', () => {
    expect(sanitizeClaimError(new Error('User rejected the request'))).toBe(
      'You rejected the transaction in your wallet.',
    )
  })

  test('empty error degrades to a clean fallback', () => {
    expect(sanitizeClaimError(null)).toBe('Nothing to claim on this position.')
  })

  test('an opaque MoveAbort dump degrades to a clean line', () => {
    expect(sanitizeClaimError(new Error('MoveAbort(SomeModule, 9)'))).toBe(
      'This position lost or has already been claimed.',
    )
  })
})

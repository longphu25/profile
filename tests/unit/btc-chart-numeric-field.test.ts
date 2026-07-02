import { describe, expect, test } from 'bun:test'
import {
  isNumericDraft,
  parseBoundedFloat,
  parseBoundedInt,
} from '../../plugins/btc-chart/lib/numeric-field'

describe('numeric-field', () => {
  test('parseBoundedInt accepts in-range values', () => {
    expect(parseBoundedInt('50', 10, 1, 125)).toBe(50)
    expect(parseBoundedInt('125', 10, 1, 125)).toBe(125)
  })

  test('parseBoundedInt reverts empty or invalid drafts', () => {
    expect(parseBoundedInt('', 10, 1, 125)).toBe(10)
    expect(parseBoundedInt('abc', 10, 1, 125)).toBe(10)
    expect(parseBoundedInt('999', 10, 1, 125)).toBe(10)
  })

  test('parseBoundedFloat clamps multiplier range', () => {
    expect(parseBoundedFloat('2.5', 3, 1, 6)).toBe(2.5)
    expect(parseBoundedFloat('9', 3, 1, 6)).toBe(3)
  })

  test('isNumericDraft allows partial typing', () => {
    expect(isNumericDraft('')).toBe(true)
    expect(isNumericDraft('12.')).toBe(true)
    expect(isNumericDraft('12a')).toBe(false)
  })
})
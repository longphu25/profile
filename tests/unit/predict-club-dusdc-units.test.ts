import { describe, expect, test } from 'bun:test'
import { dusdcToUnits } from '../../plugins/predict-club/infrastructure/suiPredictGateway'

// DUSDC has 6 decimals. The write path converts a human amount to base units before
// it goes on chain. The old float scaling (Math.floor(amount * 1e6)) underpaid on
// values that are not exactly representable in binary floating point: 0.07 * 1e6
// evaluates to 69999.99... and floors to 69999, one unit short. dusdcToUnits uses
// exact bigint math (parseToUnits), so these lock the values the contract must see.
describe('Predict Club DUSDC unit scaling', () => {
  test('0.07 is exactly 70000 base units, not the float-underpaid 69999', () => {
    expect(dusdcToUnits(0.07)).toBe(70_000n)
  })

  test('whole and simple decimals are exact', () => {
    expect(dusdcToUnits(1)).toBe(1_000_000n)
    expect(dusdcToUnits(0.5)).toBe(500_000n)
    expect(dusdcToUnits(10.25)).toBe(10_250_000n)
  })

  test('zero maps to zero', () => {
    expect(dusdcToUnits(0)).toBe(0n)
  })

  test('a value with float-representation garbage past 6 dp does not throw', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE-754; toFixed(6) clamps to 0.300000
    // so parseToUnits never trips its "too many decimal places" guard.
    expect(dusdcToUnits(0.1 + 0.2)).toBe(300_000n)
  })

  test('amounts finer than one base unit truncate, never round up past balance', () => {
    // 7 dp input clamps to 6 dp via toFixed; 0.0000004 -> 0.000000 -> 0n.
    expect(dusdcToUnits(0.000_000_4)).toBe(0n)
  })
})

import { STRIKE_SCALE } from './constants'

export interface StrikeRange {
  lowerStrike: number
  higherStrike: number
}

export function usdToStrikeRaw(usd: number): number {
  return Math.floor(usd * STRIKE_SCALE)
}

export function strikeRawToUsd(raw: number): number {
  return raw / STRIKE_SCALE
}

export function snapStrikeRaw(raw: number, tickSize: number, minStrike = 0): number {
  if (tickSize <= 0) return Math.max(raw, minStrike)
  const offset = Math.max(raw - minStrike, 0)
  return minStrike + Math.round(offset / tickSize) * tickSize
}

export function normalizeRange(lowerStrike: number, higherStrike: number): StrikeRange {
  return lowerStrike <= higherStrike
    ? { lowerStrike, higherStrike }
    : { lowerStrike: higherStrike, higherStrike: lowerStrike }
}

export function validateRange(lowerStrike: number, higherStrike: number): string | null {
  if (!Number.isFinite(lowerStrike) || !Number.isFinite(higherStrike))
    return 'Range strikes are invalid'
  if (lowerStrike <= 0 || higherStrike <= 0) return 'Range strikes must be positive'
  if (lowerStrike >= higherStrike) return 'Lower strike must be below higher strike'
  return null
}

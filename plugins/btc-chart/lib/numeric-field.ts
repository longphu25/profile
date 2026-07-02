// BTC Chart — bounded numeric field parsing (Zod) for mobile-friendly inputs.

import { z } from 'zod'

/** Parse a draft string into a bounded integer; revert to fallback when invalid or empty. */
export function parseBoundedInt(raw: string, fallback: number, min: number, max: number): number {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '-' || trimmed === '.') return fallback
  const schema = z.coerce.number().int().min(min).max(max)
  const result = schema.safeParse(trimmed)
  return result.success ? result.data : fallback
}

/** Parse a draft string into a bounded float; revert to fallback when invalid or empty. */
export function parseBoundedFloat(raw: string, fallback: number, min: number, max: number): number {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '-' || trimmed === '.') return fallback
  const schema = z.coerce.number().min(min).max(max)
  const result = schema.safeParse(trimmed)
  return result.success ? result.data : fallback
}

/** True when the draft can stay as-is while the user is still typing. */
export function isNumericDraft(raw: string): boolean {
  return raw === '' || /^-?\d*\.?\d*$/.test(raw)
}

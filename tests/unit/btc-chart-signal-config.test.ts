import { describe, expect, test } from 'bun:test'
import {
  lookupSignalPreset,
  SIGNAL_PRESET_GROUPS,
  SIGNAL_PRESETS,
} from '../../plugins/btc-chart/lib/signal-config'

describe('signal-config presets', () => {
  test('every grouped preset id resolves', () => {
    const groupedIds = SIGNAL_PRESET_GROUPS.flatMap((g) => g.presetIds)
    const unique = new Set(groupedIds)
    expect(unique.size).toBe(groupedIds.length)
    for (const id of groupedIds) {
      expect(lookupSignalPreset(id)).toBeDefined()
    }
  })

  test('all presets appear in exactly one group', () => {
    const grouped = new Set(SIGNAL_PRESET_GROUPS.flatMap((g) => g.presetIds))
    for (const p of SIGNAL_PRESETS) {
      expect(grouped.has(p.id)).toBe(true)
    }
  })
})

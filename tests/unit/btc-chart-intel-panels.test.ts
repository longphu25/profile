import { describe, expect, test } from 'bun:test'
import { WHALE_TRACKER_ENABLED } from '../../plugins/btc-chart/lib/feature-flags'
import { intelPanelMatches, intelVisiblePanelCount } from '../../plugins/btc-chart/lib/intel-panels'

describe('intelPanelMatches', () => {
  test('matches title substring', () => {
    expect(intelPanelMatches('Whale Tracker', ['whale'], 'whale')).toBe(true)
  })

  test('matches keyword alias', () => {
    expect(intelPanelMatches('Open Interest', ['oi', 'interest'], 'oi')).toBe(true)
  })

  test('requires all tokens', () => {
    expect(intelPanelMatches('Volume Spike', ['spike', 'volume'], 'vol spike')).toBe(true)
    expect(intelPanelMatches('Volume Spike', ['spike', 'volume'], 'box flip')).toBe(false)
  })
})

describe('intelVisiblePanelCount', () => {
  test('counts market panels for whale query when whale tracker is enabled', () => {
    expect(intelVisiblePanelCount('market', 'whale')).toBe(WHALE_TRACKER_ENABLED ? 1 : 0)
  })

  test('counts open interest panel for oi query', () => {
    expect(intelVisiblePanelCount('market', 'oi')).toBe(1)
  })
})

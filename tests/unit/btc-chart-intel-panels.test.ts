import { describe, expect, test } from 'bun:test'
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
  test('counts market panels for whale query', () => {
    expect(intelVisiblePanelCount('market', 'whale')).toBe(1)
  })
})

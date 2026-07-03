import { describe, expect, test } from 'bun:test'
import { DEFAULT_CONFIG } from '../../plugins/btc-chart/storage'
import {
  resolvePipelineNeeds,
  shouldDrawTradeSetupOverlay,
} from '../../plugins/btc-chart/lib/pipeline-needs'

describe('pipeline-needs', () => {
  test('trade setup confluence and overlay are independent toggles', () => {
    const vis = {
      ...DEFAULT_CONFIG.vis,
      tradeSetup: true,
      tradeSetupOverlay: false,
    }
    const needs = resolvePipelineNeeds(vis, false)
    expect(needs.tradeSetup).toBe(true)
    expect(shouldDrawTradeSetupOverlay(vis)).toBe(false)
  })

  test('overlay defaults off in DEFAULT_CONFIG', () => {
    expect(DEFAULT_CONFIG.vis.tradeSetupOverlay).toBe(false)
    expect(DEFAULT_CONFIG.vis.tradeSetup).toBe(false)
    expect(shouldDrawTradeSetupOverlay(DEFAULT_CONFIG.vis)).toBe(false)
  })

  test('overlay on does not imply confluence compute', () => {
    const vis = {
      ...DEFAULT_CONFIG.vis,
      tradeSetup: false,
      tradeSetupOverlay: true,
    }
    const needs = resolvePipelineNeeds(vis, false)
    expect(needs.tradeSetup).toBe(false)
    expect(needs.luxNwe).toBe(true)
    expect(shouldDrawTradeSetupOverlay(vis)).toBe(true)
  })
})

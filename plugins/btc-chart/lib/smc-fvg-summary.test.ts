import { describe, expect, test } from 'bun:test'
import { fvgLegendHtml, summarizeFvgs } from './smc-fvg-summary'

describe('summarizeFvgs', () => {
  test('counts bull and bear gaps', () => {
    const s = summarizeFvgs([
      { time: 1, top: 110, bottom: 100, bias: 'bull' },
      { time: 2, top: 90, bottom: 80, bias: 'bear' },
      { time: 3, top: 50, bottom: 50, bias: 'bull' },
    ])
    expect(s).toEqual({ bull: 1, bear: 1, total: 2 })
  })

  test('legend shows none when empty', () => {
    expect(fvgLegendHtml({ bull: 0, bear: 0, total: 0 })).toContain('none')
  })

  test('legend shows counts', () => {
    const html = fvgLegendHtml({ bull: 2, bear: 1, total: 3 })
    expect(html).toContain('FVG')
    expect(html).toContain('2')
    expect(html).toContain('1')
  })
})

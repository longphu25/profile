// BTC Chart — FVG (Fair Value Gap) counts for legend and layer hints.

import type { FVGBox } from '../smc'

export interface FvgSummary {
  readonly bull: number
  readonly bear: number
  readonly total: number
}

/** Count active (unfilled) FVG boxes from SMC compute. */
export function summarizeFvgs(fvgs: readonly FVGBox[]): FvgSummary {
  let bull = 0
  let bear = 0
  for (const f of fvgs) {
    if (f.top === f.bottom) continue
    if (f.bias === 'bull') bull += 1
    else bear += 1
  }
  return { bull, bear, total: bull + bear }
}

/** One-line legend fragment when SMC layer is on. */
export function fvgLegendHtml(summary: FvgSummary): string {
  if (summary.total === 0) {
    return '<span style="color:var(--muted,#888)">FVG: none</span>'
  }
  const parts: string[] = []
  if (summary.bull > 0) {
    parts.push(`<span style="color:#089981">${summary.bull}▲</span>`)
  }
  if (summary.bear > 0) {
    parts.push(`<span style="color:#F23645">${summary.bear}▼</span>`)
  }
  return `<span style="color:var(--text-2,#ccc)">FVG ${parts.join(' ')}</span>`
}

// BTC Chart — schedule fast paint then deferred heavy pipeline work.

import type { ChartRenderContext } from './chart-render-context'
import { scheduleFrame, scheduleIdle } from './idle-schedule'
import { renderChartPipeline, type PipelinePhase } from './chart-render-pipeline'
import type { Candle } from './types'

/** Monotonic token; bump to cancel in-flight scheduled renders. */
export interface RenderGeneration {
  current: number
}

export interface ScheduleChartRenderOptions {
  /** When true (default), heavy indicators run after first paint via idle callback. */
  readonly deferHeavy?: boolean
  /** Force a single synchronous full pipeline pass. */
  readonly phase?: PipelinePhase
}

/**
 * Paint candles + light indicators first, then SMC/ICT/NWE overlays when idle.
 * Cancels stale work when `generation` changes (symbol/interval switch).
 */
export function scheduleChartRender(
  ctx: ChartRenderContext,
  data: Candle[],
  generation: RenderGeneration,
  options?: ScheduleChartRenderOptions,
): void {
  const gen = ++generation.current
  ctx.renderGenRef.current = gen

  const phase = options?.phase
  if (phase === 'all' || options?.deferHeavy === false) {
    renderChartPipeline(ctx, data, 'all', gen)
    return
  }

  scheduleFrame(() => {
    if (gen !== generation.current) return
    renderChartPipeline(ctx, data, 'fast', gen)
    scheduleIdle(
      () => {
        if (gen !== generation.current) return
        renderChartPipeline(ctx, data, 'heavy', gen)
      },
      { timeout: 300 },
    )
  })
}

/** Cancel pending scheduled renders (view change). */
export function bumpRenderGeneration(generation: RenderGeneration): number {
  generation.current += 1
  return generation.current
}

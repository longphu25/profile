import { useState } from 'react'
import { ActionDock } from './ActionDock'
import { ContextRail } from './ContextRail'
import { DockTabs } from './DockTabs'
import { ExposureRail } from './ExposureRail'
import { LifecycleRail } from './LifecycleRail'
import { PriceChart } from './PriceChart'

/**
 * Cockpit layout primitive (C0) for the rebuilt Predict Club pro surface.
 *
 * ONE source of truth for both form factors:
 * - Desktop (lg+): chart is king. A `[minmax(0,1fr)_22rem]` grid puts the chart
 *   zone left (fills) and a persistent docked action rail right. Lifecycle and
 *   context sit as thin bands above the chart; a collapsible dock sits below.
 * - Mobile (<lg): chart hero pinned top, supporting rails stack/scroll beneath,
 *   and an always-visible compact CTA bar is pinned at the bottom (the action
 *   sheet trigger). The docked rail and desktop dock are hidden.
 *
 * C0 fills each zone with a labelled placeholder. Later phases (C1-C6) replace
 * the placeholders with PriceChart, ActionDock, LifecycleRail, ContextRail,
 * ExposureRail, and DockTabs. The structure here is the contract those phases
 * build against, so the grid, breakpoints, and test hooks are intentional.
 */

export function CockpitShell() {
  const [dockOpen, setDockOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div
      data-pc-cockpit
      className="flex h-full min-h-0 flex-col gap-px overflow-x-hidden bg-outline-variant"
    >
      {/* Thin context bands above the chart (C3). */}
      <LifecycleRail className="shrink-0" />
      <ContextRail className="hidden shrink-0 lg:flex" />

      {/* Main: chart-king + docked rail (desktop) / chart hero (mobile). */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-y-auto bg-outline-variant lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden [&>*]:min-h-[16rem] lg:[&>*]:min-h-0">
        <div data-pc-chart className="min-h-0 bg-surface-container-lowest lg:min-h-0">
          <PriceChart />
        </div>
        {/* Mobile context rail sits below the chart hero (desktop has it up top). */}
        <ContextRail className="flex shrink-0 lg:hidden" />
        {/* Desktop rail column: action on top, exposure below (both scroll). */}
        <div className="hidden min-h-0 flex-col gap-px bg-outline-variant lg:flex">
          <ActionDock className="shrink-0" />
          <ExposureRail className="min-h-0 flex-1" />
        </div>
      </div>

      {/* Collapsible dock below the chart (desktop). C5 fills it. */}
      <section
        data-pc-dock
        className="hidden shrink-0 flex-col bg-surface-container lg:flex"
        aria-label="Reference dock"
      >
        <button
          type="button"
          onClick={() => setDockOpen((o) => !o)}
          aria-expanded={dockOpen}
          className="flex items-center justify-between border-t border-outline-variant px-md py-sm font-label text-label-caps uppercase tracking-wider text-on-surface-variant transition-colors hover:text-primary-fixed-dim"
        >
          <span>Funding / Offers / History</span>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            {dockOpen ? 'expand_more' : 'expand_less'}
          </span>
        </button>
        {dockOpen && <DockTabs className="max-h-[40vh]" />}
      </section>

      {/* Mobile: always-visible compact CTA bar that opens the action sheet (C6). */}
      <button
        type="button"
        data-pc-cta-bar
        onClick={() => setSheetOpen(true)}
        aria-expanded={sheetOpen}
        aria-haspopup="dialog"
        className="flex shrink-0 items-center justify-between gap-sm border-t border-outline-variant bg-surface-container-high px-md py-sm pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-left transition-colors hover:bg-surface-bright lg:hidden"
      >
        <span className="flex items-center gap-sm">
          <span
            className="material-symbols-outlined text-[20px] text-primary-fixed-dim"
            aria-hidden="true"
          >
            bolt
          </span>
          <span className="font-label text-label-caps uppercase tracking-wider text-on-surface">
            Trade
          </span>
        </span>
        <span
          className="material-symbols-outlined text-[20px] text-on-surface-variant"
          aria-hidden="true"
        >
          keyboard_arrow_up
        </span>
      </button>

      {/* Mobile action sheet: the docked rail content, surfaced on demand (C6). */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Trade"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div
            data-pc-action-sheet
            className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col gap-px overflow-hidden rounded-t-xl bg-outline-variant pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between bg-surface-container-high px-md py-sm">
              <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
                Trade
              </span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="material-symbols-outlined text-[22px] text-on-surface-variant hover:text-on-surface"
              >
                close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ActionDock />
              <ExposureRail className="mt-px" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

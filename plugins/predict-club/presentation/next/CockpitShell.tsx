import { useState, type ReactNode } from 'react'
import { ActionDock } from './ActionDock'
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

function Zone({
  label,
  hint,
  className = '',
  ...rest
}: {
  label: string
  hint?: string
  className?: string
} & Record<`data-${string}`, string | boolean>) {
  return (
    <div
      className={`flex min-h-0 flex-col items-center justify-center gap-1 bg-surface-container p-md text-center ${className}`}
      {...rest}
    >
      <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant/60">
        {label}
      </span>
      {hint && <span className="font-data text-data-sm text-on-surface-variant/40">{hint}</span>}
    </div>
  )
}

function Band({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & Record<`data-${string}`, string | boolean>) {
  return (
    <div className={`flex items-center bg-surface-container px-md py-sm ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CockpitShell() {
  const [dockOpen, setDockOpen] = useState(false)

  return (
    <div
      data-pc-cockpit
      className="flex h-full min-h-0 flex-col gap-px overflow-x-hidden bg-outline-variant"
    >
      {/* Thin context bands above the chart (C3 fills these). */}
      <Band data-pc-lifecycle className="shrink-0" aria-label="Round lifecycle">
        <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant/50">
          Lifecycle
        </span>
      </Band>
      <Band data-pc-context className="hidden shrink-0 lg:flex" aria-label="Round context">
        <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant/50">
          Context
        </span>
      </Band>

      {/* Main: chart-king + docked rail (desktop) / chart hero (mobile). */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-y-auto bg-outline-variant lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden [&>*]:min-h-[16rem] lg:[&>*]:min-h-0">
        <div data-pc-chart className="min-h-0 bg-surface-container-lowest lg:min-h-0">
          <PriceChart />
        </div>
        <ActionDock className="hidden lg:flex" />
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
        {dockOpen && (
          <div className="max-h-[40vh] overflow-auto px-md pb-md">
            <Zone label="Reference Dock" hint="Funding, offers, history (C5)" />
          </div>
        )}
      </section>

      {/* Mobile: always-visible compact CTA bar pinned at the bottom (C2/C6). */}
      <div
        data-pc-cta-bar
        className="flex shrink-0 items-center justify-between gap-sm border-t border-outline-variant bg-surface-container-high px-md py-sm pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden"
        aria-label="Primary action"
      >
        <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant/60">
          Action Sheet
        </span>
        <span className="font-data text-data-sm text-on-surface-variant/40">C2 / C6</span>
      </div>
    </div>
  )
}

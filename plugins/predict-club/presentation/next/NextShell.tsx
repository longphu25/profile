import { ActionRail } from './ActionRail'
import { BottomDockNext } from './BottomDockNext'
import { DecisionStripNext } from './DecisionStripNext'
import { PanelShell } from './PanelShell'
import { PredictionRoomNext } from './PredictionRoomNext'
import { PrototypeSwitcher, useVariant, type VariantKey } from './PrototypeSwitcher'
import { RiskPanelNext } from './RiskPanelNext'
import { RoundLifecycleStrip } from './RoundLifecycleStrip'
import { VariantA } from './VariantA'
import { VariantB } from './VariantB'
import { VariantC } from './VariantC'

/** Placeholder body for R1 — later phases replace each region with its real
 * panel (ActionRail, RoundLifecycleStrip, DecisionStripNext, …). */
function Placeholder({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="h-full min-h-[64px] flex flex-col items-center justify-center gap-1 text-center">
      <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant/60">
        {label}
      </span>
      {hint && <span className="font-data text-data-sm text-on-surface-variant/40">{hint}</span>}
    </div>
  )
}

const VARIANTS: Record<VariantKey, () => React.JSX.Element> = {
  A: VariantA,
  B: VariantB,
  C: VariantC,
}

/** The redesigned region grid. One source of truth for desktop 3-column and
 * mobile single-column reflow. Regions are separated by a 1px gutter
 * (bg-outline-variant showing through `gap-px`) per the Terminal-First look, so
 * the panels themselves are borderless.
 *
 * THROWAWAY prototype hook: when `?variant=A|B|C` is present, render that
 * redesign candidate full-bleed plus the floating switcher instead of the
 * R1–R8 cockpit. No param → the existing cockpit, untouched. */
export function NextShell() {
  const variant = useVariant()
  if (variant) {
    const Variant = VARIANTS[variant]
    return (
      <div className="h-full min-h-0 overflow-y-auto bg-background">
        <Variant />
        <PrototypeSwitcher current={variant} />
      </div>
    )
  }

  return (
    // R7: desktop is a fixed cockpit (overflow-hidden, fills viewport); mobile
    // scrolls vertically so stacked bands never clip. The action rail + lifecycle
    // stay at the top of the scroll so the next step is always the first thing seen.
    <div className="h-full min-h-0 flex flex-col gap-px bg-outline-variant overflow-y-auto lg:overflow-hidden [padding-bottom:env(safe-area-inset-bottom)]">
      {/* Primary action — R2 (top priority, action-first IA) */}
      <ActionRail className="shrink-0" />

      {/* Round lifecycle — R3 */}
      <RoundLifecycleStrip className="shrink-0" />

      {/* Decision strip — R3 */}
      <DecisionStripNext className="shrink-0" />

      {/* Center context row — R4 / R5. 3-col on desktop, stacked on mobile.
       * min-h on mobile keeps each stacked panel usable; flex-1 only bites at lg. */}
      <div className="grid gap-px bg-outline-variant grid-cols-1 lg:flex-1 lg:min-h-0 lg:grid-cols-[18rem_minmax(0,1fr)_20rem] [&>*]:min-h-[16rem] lg:[&>*]:min-h-0">
        <PanelShell bordered={false} title="Club" icon="groups">
          <Placeholder label="Club Panel" />
        </PanelShell>
        <PredictionRoomNext />
        <RiskPanelNext />
      </div>

      {/* Bottom dock — R6 (collapsible for guided mode) */}
      <BottomDockNext className="shrink-0 lg:max-h-[40vh]" />
    </div>
  )
}

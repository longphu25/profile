import { ActionRail } from './ActionRail'
import { DecisionStripNext } from './DecisionStripNext'
import { PanelShell } from './PanelShell'
import { PredictionRoomNext } from './PredictionRoomNext'
import { RiskPanelNext } from './RiskPanelNext'
import { RoundLifecycleStrip } from './RoundLifecycleStrip'

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

/** The redesigned region grid. One source of truth for desktop 3-column and
 * mobile single-column reflow. Regions are separated by a 1px gutter
 * (bg-outline-variant showing through `gap-px`) per the Terminal-First look, so
 * the panels themselves are borderless. */
export function NextShell() {
  return (
    <div className="h-full min-h-0 flex flex-col gap-px bg-outline-variant overflow-hidden">
      {/* Primary action — R2 (top priority, action-first IA) */}
      <ActionRail className="shrink-0" />

      {/* Round lifecycle — R3 */}
      <RoundLifecycleStrip className="shrink-0" />

      {/* Decision strip — R3 */}
      <DecisionStripNext className="shrink-0" />

      {/* Center context row — R4 / R5. 3-col on desktop, stacked on mobile. */}
      <div className="flex-1 min-h-0 grid gap-px bg-outline-variant grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        <PanelShell bordered={false} title="Club" icon="groups">
          <Placeholder label="Club Panel" />
        </PanelShell>
        <PredictionRoomNext />
        <RiskPanelNext />
      </div>

      {/* Bottom dock — R6 (collapsible for guided mode) */}
      <PanelShell
        bordered={false}
        title="Funding · Offers · History"
        icon="dock_to_bottom"
        collapsible
        className="shrink-0 max-h-[40vh]"
      >
        <Placeholder label="Bottom Dock" hint="R6" />
      </PanelShell>
    </div>
  )
}

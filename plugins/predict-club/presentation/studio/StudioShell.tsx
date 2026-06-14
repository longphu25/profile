import { usePredictClub } from '../usePredictClub'

/**
 * Surface Studio layout primitive (S0) for the decision-support terminal.
 *
 * The Studio is a dedicated surface (its own Vite entry) that reuses the
 * predict-club data layer end to end. Story 22's chart-king cockpit stays
 * untouched; this surface owns the volatility surface view that the king chart
 * cannot host: a strike x expiry IV heatmap, a per-expiry smile slice, and the
 * trader edge panel (mispricing, IV vs realized vol, arb-free health).
 *
 * S0 fills each zone with a labelled placeholder and proves the route mounts,
 * connects a wallet, and reads the shared oracle snapshot. Later phases (S1-S5)
 * replace the placeholders with VolHeatmap, SmileSlice, and EdgePanel. The grid,
 * breakpoints, and test hooks here are the contract those phases build against.
 */

export function StudioShell() {
  const { oracleSnapshot } = usePredictClub()
  const liveOracles = oracleSnapshot.oracles.filter(
    (o) => o.status === 'active' && o.expiry > Date.now(),
  )
  const asset = oracleSnapshot.oracleState?.underlying_asset ?? 'BTC'

  return (
    <div
      data-pc-studio
      className="flex h-full min-h-0 flex-col gap-px overflow-x-hidden bg-outline-variant"
    >
      {/* Thin status band: what surface, how many live expiries, feed health. */}
      <div
        data-pc-studio-status
        className="flex shrink-0 flex-wrap items-center gap-md bg-surface-container-lowest px-md py-sm font-data text-data-sm text-on-surface-variant"
      >
        <span className="flex items-center gap-1">
          <span className="text-primary-fixed-dim">Asset</span>
          <span className="tabular-nums text-on-surface">{asset}</span>
        </span>
        <span className="h-3 w-px bg-outline-variant" />
        <span className="flex items-center gap-1">
          <span className="text-primary-fixed-dim">Live expiries</span>
          <span className="tabular-nums text-on-surface">{liveOracles.length}</span>
        </span>
        <span className="h-3 w-px bg-outline-variant" />
        <span className="flex items-center gap-1">
          <span className="text-primary-fixed-dim">Feed</span>
          <span className={oracleSnapshot.isHealthy ? 'text-primary-fixed-dim' : 'text-error'}>
            {oracleSnapshot.isHealthy ? 'live' : 'stale'}
          </span>
        </span>
      </div>

      {/* Main: heatmap is king (left, fills), smile + edge stack right (S1-S4). */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-y-auto bg-outline-variant lg:grid-cols-[minmax(0,1fr)_24rem] lg:overflow-hidden [&>*]:min-h-[16rem] lg:[&>*]:min-h-0">
        <section
          data-pc-studio-heatmap
          aria-label="Volatility surface"
          className="flex min-h-0 flex-col items-center justify-center gap-sm bg-surface-container-lowest p-lg text-center"
        >
          <span
            className="material-symbols-outlined text-[40px] text-on-surface-variant"
            aria-hidden="true"
          >
            grid_on
          </span>
          <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
            Vol surface heatmap
          </span>
          <span className="max-w-[24rem] font-data text-data-sm text-on-surface-variant">
            Strike x expiry implied-vol matrix lands here in S1, sampled live from the oracle SVI
            params.
          </span>
        </section>

        <div className="flex min-h-0 flex-col gap-px bg-outline-variant">
          <section
            data-pc-studio-smile
            aria-label="Smile slice"
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-sm bg-surface-container-lowest p-md text-center"
          >
            <span
              className="material-symbols-outlined text-[28px] text-on-surface-variant"
              aria-hidden="true"
            >
              show_chart
            </span>
            <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
              Smile slice
            </span>
            <span className="max-w-[20rem] font-data text-data-sm text-on-surface-variant">
              Per-expiry IV smile arrives in S2.
            </span>
          </section>
          <section
            data-pc-studio-edge
            aria-label="Trader edge"
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-sm bg-surface-container-lowest p-md text-center"
          >
            <span
              className="material-symbols-outlined text-[28px] text-on-surface-variant"
              aria-hidden="true"
            >
              bolt
            </span>
            <span className="font-label text-label-caps uppercase tracking-wider text-on-surface-variant">
              Edge panel
            </span>
            <span className="max-w-[20rem] font-data text-data-sm text-on-surface-variant">
              Mispricing, IV vs realized vol, and arb-free health fill in across S2-S4.
            </span>
          </section>
        </div>
      </div>
    </div>
  )
}

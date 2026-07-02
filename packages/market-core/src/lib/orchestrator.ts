import type { ExchangeMarketAdapter } from '../adapters/types'
import type { MarketSnapshot, SymbolRoutingContext } from './types'
import { buildMarketSnapshot } from './normalize'

/**
 * Orchestrator (Facade): parallel venue fetch via adapter strategy, then normalize.
 * Depends on ExchangeMarketAdapter interface only (DIP).
 */
export class MarketSnapshotOrchestrator {
  constructor(private readonly adapters: readonly ExchangeMarketAdapter[]) {}

  /** Collect and aggregate a multi-venue snapshot for one symbol. */
  async collect(ctx: SymbolRoutingContext): Promise<MarketSnapshot> {
    const settled = await Promise.allSettled(
      this.adapters.map((adapter) => adapter.fetchSnapshot(ctx)),
    )

    const venueSnapshots = settled
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<
          Awaited<ReturnType<ExchangeMarketAdapter['fetchSnapshot']>>
        > => r.status === 'fulfilled',
      )
      .map((r) => r.value)
      .filter((v): v is NonNullable<typeof v> => v != null)

    return buildMarketSnapshot(ctx.symbol, Date.now(), venueSnapshots)
  }
}

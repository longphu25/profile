import type { ExchangeVenueSnapshot, SymbolRoutingContext } from '../lib/types'

/**
 * Strategy interface for exchange market data (DIP).
 * Each venue implements one adapter; orchestrator depends on this abstraction.
 */
export interface ExchangeMarketAdapter {
  readonly venue: ExchangeVenueSnapshot['venue']
  /** Fetch funding, OI, mark, and volume for the routed symbol. */
  fetchSnapshot(ctx: SymbolRoutingContext): Promise<ExchangeVenueSnapshot | null>
}

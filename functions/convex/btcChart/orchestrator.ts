import { createDefaultMarketAdapters } from '../../shared/btc-chart/adapters/factory'
import { MarketSnapshotOrchestrator } from '../../shared/btc-chart/lib/orchestrator'

/** Singleton orchestrator wired with default venue adapters (composition root). */
let instance: MarketSnapshotOrchestrator | null = null

export function getMarketSnapshotOrchestrator(): MarketSnapshotOrchestrator {
  if (!instance) {
    instance = new MarketSnapshotOrchestrator(createDefaultMarketAdapters())
  }
  return instance
}

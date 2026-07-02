import { createDefaultMarketAdapters, MarketSnapshotOrchestrator } from '@profile/market-core'

/** Singleton orchestrator wired with default venue adapters (composition root). */
let instance: MarketSnapshotOrchestrator | null = null

export function getMarketSnapshotOrchestrator(): MarketSnapshotOrchestrator {
  if (!instance) {
    instance = new MarketSnapshotOrchestrator(createDefaultMarketAdapters())
  }
  return instance
}

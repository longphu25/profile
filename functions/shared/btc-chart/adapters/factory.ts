import type { ExchangeMarketAdapter } from './types'
import { BinanceMarketAdapter } from './binance'
import { BybitMarketAdapter } from './bybit'
import { MexcMarketAdapter } from './mexc'
import { OkxMarketAdapter } from './okx'

/** Factory: register default venue adapters (OCP: add venues without editing orchestrator). */
export function createDefaultMarketAdapters(): readonly ExchangeMarketAdapter[] {
  return [
    new BinanceMarketAdapter(),
    new BybitMarketAdapter(),
    new OkxMarketAdapter(),
    new MexcMarketAdapter(),
  ]
}

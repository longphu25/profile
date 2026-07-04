// BTC Chart Plugin entry — wires host API to the chart workspace (Shadow DOM scoped).
// External: `lightweight-charts` global from CDN on the host HTML page.

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { initSmcWasm } from './smc-wasm'
import { BtcChartRoot } from './components/BtcChartRoot'

const BtcChartPlugin: Plugin = {
  name: 'BtcChart',
  version: '1.0.0',
  styleUrls: ['/plugins/btc-chart/style.css'],

  init(host: HostAPI) {
    host.registerComponent('BtcChart', BtcChartRoot)
    host.log('BtcChart plugin initialized')
  },

  mount() {
    const warmWasm = () => {
      void initSmcWasm()
    }
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(warmWasm, { timeout: 4000 })
    } else {
      setTimeout(warmWasm, 800)
    }
    console.log('[BtcChart] mounted')
  },

  unmount() {
    console.log('[BtcChart] unmounted')
  },
}

export default BtcChartPlugin

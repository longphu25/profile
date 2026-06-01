// SUI DeepBook Predict Plugin — thin plugin entry.

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { setOracleHookHost } from './hooks/useOracleData'
import { initOracleService, destroyOracleService } from './oracleService'
import { PredictPluginRoot, setPredictPluginHost } from './app/PredictPluginRoot'
import './style.css'

const SuiDeepBookPredictPlugin: Plugin = {
  name: 'SuiDeepBookPredict',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-deepbook-predict/style.css'],

  init(host: HostAPI) {
    if (isSuiHostAPI(host)) {
      setPredictPluginHost(host)
      initOracleService(host)
      setOracleHookHost(host)
    }
    host.registerComponent('SuiDeepBookPredict', PredictPluginRoot)
    host.log('SuiDeepBookPredict initialized')
  },

  mount() {
    console.log('[SuiDeepBookPredict] mounted')
  },

  unmount() {
    destroyOracleService()
    setPredictPluginHost(null)
    console.log('[SuiDeepBookPredict] unmounted')
  },
}

export default SuiDeepBookPredictPlugin

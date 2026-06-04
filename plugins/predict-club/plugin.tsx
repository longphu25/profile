import type { ComponentType } from 'react'
import type { HostAPI, Plugin } from '../../src/plugins/types'
import { isSuiHostAPI, type SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { PredictClubRoot } from './presentation/PredictClubRoot'
import './style.css'

let activeHost: SuiHostAPI | null = null

const PredictClubComponent = (() => <PredictClubRoot host={activeHost} />) as ComponentType<unknown>

const PredictClubPlugin: Plugin = {
  name: 'PredictClub',
  version: '1.0.0',
  styleUrls: ['/plugins/predict-club/style.css'],
  init(host: HostAPI) {
    if (isSuiHostAPI(host)) {
      activeHost = host
    }

    host.registerComponent('PredictClub', PredictClubComponent)
    host.log('PredictClub plugin initialized')
  },
  mount() {
    activeHost?.log('PredictClub mounted')
  },
  unmount() {
    activeHost = null
  },
}

export default PredictClubPlugin

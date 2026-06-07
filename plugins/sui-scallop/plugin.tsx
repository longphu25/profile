import type { ComponentType } from 'react'
import type { HostAPI, Plugin } from '../../src/plugins/types'
import { ScallopBorrowPanel, type ScallopBorrowPanelProps } from './presentation/ScallopBorrowPanel'
import { ScallopHealthBadge } from './presentation/ScallopHealthBadge'
import './style.css'

export type { ScallopBorrowPanelProps }

const SuiScallopPlugin: Plugin = {
  name: 'SuiScallop',
  version: '1.0.0',
  styleUrls: ['/plugins/sui-scallop/style.css'],

  init(host: HostAPI) {
    host.registerComponent('ScallopBorrow', ScallopBorrowPanel as ComponentType<unknown>)
    host.registerComponent('ScallopHealthBadge', ScallopHealthBadge as ComponentType<unknown>)
    host.log('SuiScallop plugin initialized')
  },

  mount() {},

  unmount() {},
}

export default SuiScallopPlugin

// Abyss Vault Plugin - Registers into DeepBook plugin system
// Testnet: DeepBook v3 trading (SUI/DBUSDC)
// Mainnet: Abyss vault supply/withdraw

import type { HostAPI, Plugin } from '../plugins/types'
import { createAbyssVaultGateway, type AbyssVaultGateway } from './abyssVaultGateway'
import type { AbyssNetwork } from './constants'

let gateway: AbyssVaultGateway | null = null

export function getAbyssGateway(): AbyssVaultGateway {
  if (!gateway) throw new Error('Abyss plugin not initialized')
  return gateway
}

const abyssVaultPlugin: Plugin = {
  name: 'abyss-vault',
  version: '1.0.0',

  init(host: HostAPI) {
    const network: AbyssNetwork = 'testnet'
    gateway = createAbyssVaultGateway(network)

    const pools = gateway.getPools()
    const vaults = gateway.getVaults()
    host.log(`[Abyss] ${network} | ${pools.length} pools, ${vaults.length} vaults`)
  },

  unmount() {
    gateway = null
  },
}

export default abyssVaultPlugin

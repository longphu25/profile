// SUI Plugin Loader
// Like the base loader but passes SuiHostAPI instead of base HostAPI

import type { SuiPlugin } from './sui-types'
import { suiHostAPI } from './sui-host'

/** Load a SUI plugin and initialize it with the shared SuiHostAPI */
export async function loadSuiPlugin(url: string): Promise<SuiPlugin> {
  const bustUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
  const module = await import(/* @vite-ignore */ bustUrl)
  const plugin = module.default as SuiPlugin

  if (!plugin.name || !plugin.init) {
    throw new Error(`Invalid SUI plugin at ${url}: missing 'name' or 'init'`)
  }

  plugin.init(suiHostAPI)
  return plugin
}

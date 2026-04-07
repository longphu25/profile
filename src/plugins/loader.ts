// Dynamic Plugin Loader
// Lazy-loads plugins at runtime using dynamic imports

import type { Plugin } from './types'
import { hostAPI } from './host'

/** Load a plugin from a URL or path and initialize it */
export async function loadPlugin(url: string): Promise<Plugin> {
  // Append cache-bust query to force re-execution on reload
  const bustUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
  const module = await import(/* @vite-ignore */ bustUrl)
  const plugin = module.default as Plugin

  if (!plugin.name || !plugin.init) {
    throw new Error(`Invalid plugin at ${url}: missing 'name' or 'init'`)
  }

  plugin.init(hostAPI)
  return plugin
}

/** Load multiple plugins in parallel */
export async function loadPlugins(urls: string[]): Promise<Plugin[]> {
  const results = await Promise.allSettled(urls.map(loadPlugin))

  return results
    .filter((r): r is PromiseFulfilledResult<Plugin> => r.status === 'fulfilled')
    .map((r) => r.value)
}

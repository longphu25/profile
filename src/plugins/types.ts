// Plugin Architecture - Type Contracts
// Defines the interface between host application and plugins

import type { ComponentType } from 'react'

/** The controlled API that the host exposes to plugins */
export interface HostAPI {
  registerComponent: (name: string, component: ComponentType<unknown>) => void
  getComponent: (name: string) => ComponentType<unknown> | undefined
  log: (message: string) => void
}

/** Plugin lifecycle interface - every plugin must implement this */
export interface Plugin {
  name: string
  version: string
  /** Path(s) to CSS files scoped to this plugin (rendered inside Shadow DOM) */
  styleUrls?: string[]
  /** Called once when the plugin is loaded. Receives the host API. */
  init: (host: HostAPI) => void
  /** Called when the plugin's UI becomes visible */
  mount?: () => void
  /** Called on re-renders or state changes */
  update?: () => void
  /** Called when the plugin is removed - clean up resources here */
  unmount?: () => void
}

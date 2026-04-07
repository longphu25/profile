// Host API Implementation
// Provides the controlled interface that plugins interact with

import type { ComponentType } from 'react'
import type { HostAPI } from './types'

const componentRegistry: Record<string, ComponentType<unknown>> = {}

export const hostAPI: HostAPI = {
  registerComponent(name, component) {
    componentRegistry[name] = component
    console.log(`[Plugin] Registered component: ${name}`)
  },

  getComponent(name) {
    return componentRegistry[name]
  },

  log(message) {
    console.log(`[Plugin LOG]: ${message}`)
  },
}

/** Remove a component from the registry */
export function unregisterComponent(name: string): void {
  delete componentRegistry[name]
  console.log(`[Plugin] Unregistered component: ${name}`)
}

/** Get all registered component names */
export function getRegisteredComponents(): string[] {
  return Object.keys(componentRegistry)
}

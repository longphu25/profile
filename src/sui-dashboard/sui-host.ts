// SUI Host API Implementation
// Extends base HostAPI with shared wallet context and cross-plugin data store

import type { ComponentType } from 'react'
import type { SuiHostAPI, SuiContext, SuiContextListener } from './sui-types'

// --- Component registry (same as base host) ---
const componentRegistry: Record<string, ComponentType<unknown>> = {}

// --- Sui context state ---
let currentContext: SuiContext = {
  address: null,
  network: 'mainnet',
  isConnected: false,
  accounts: [],
}

const contextListeners = new Set<SuiContextListener>()

// --- Shared data store ---
const sharedDataStore: Record<string, unknown> = {}
const dataListeners: Record<string, Set<(value: unknown) => void>> = {}

// --- Action callbacks (set by dashboard component) ---
let connectCallback: (() => void) | null = null
let disconnectCallback: (() => void) | null = null
let networkSwitchCallback: ((network: string) => void) | null = null

/** Register dashboard-level action handlers */
export function registerActions(actions: {
  onConnect: () => void
  onDisconnect: () => void
  onNetworkSwitch: (network: string) => void
}) {
  connectCallback = actions.onConnect
  disconnectCallback = actions.onDisconnect
  networkSwitchCallback = actions.onNetworkSwitch
}

/** Update shared context (called by dashboard when wallet/network changes) */
export function updateSuiContext(ctx: Partial<SuiContext>) {
  currentContext = { ...currentContext, ...ctx }
  contextListeners.forEach((listener) => listener(currentContext))
}

/** The SUI Host API instance — passed to all SUI plugins */
export const suiHostAPI: SuiHostAPI = {
  // --- Base HostAPI ---
  registerComponent(name, component) {
    componentRegistry[name] = component
    console.log(`[SuiPlugin] Registered component: ${name}`)
  },

  getComponent(name) {
    return componentRegistry[name]
  },

  log(message) {
    console.log(`[SuiPlugin LOG]: ${message}`)
  },

  // --- Sui Context ---
  getSuiContext() {
    return { ...currentContext }
  },

  onSuiContextChange(listener) {
    contextListeners.add(listener)
    return () => {
      contextListeners.delete(listener)
    }
  },

  requestConnect() {
    connectCallback?.()
  },

  requestDisconnect() {
    disconnectCallback?.()
  },

  requestNetworkSwitch(network) {
    networkSwitchCallback?.(network)
  },

  // --- Shared Data Store ---
  setSharedData(key, value) {
    sharedDataStore[key] = value
    dataListeners[key]?.forEach((listener) => listener(value))
  },

  getSharedData(key) {
    return sharedDataStore[key]
  },

  onSharedDataChange(key, listener) {
    if (!dataListeners[key]) {
      dataListeners[key] = new Set()
    }
    dataListeners[key].add(listener)
    return () => {
      dataListeners[key]?.delete(listener)
    }
  },
}

/** Remove a component from the registry */
export function unregisterSuiComponent(name: string): void {
  delete componentRegistry[name]
  console.log(`[SuiPlugin] Unregistered component: ${name}`)
}

/** Get all registered component names */
export function getRegisteredSuiComponents(): string[] {
  return Object.keys(componentRegistry)
}

/** Clear shared data for a specific key */
export function clearSharedData(key: string): void {
  delete sharedDataStore[key]
}

/** Get all shared data keys */
export function getSharedDataKeys(): string[] {
  return Object.keys(sharedDataStore)
}

// Solana Host API — reuses SuiHostAPI interface for plugin compatibility
// Plugins check isSuiHostAPI() which tests for getSuiContext/shared data methods

import type { ComponentType } from 'react'
import type {
  SuiHostAPI,
  SuiContext,
  SuiContextListener,
  TransactionResult,
  PersonalMessageResult,
} from '../sui-dashboard/sui-types'

const componentRegistry: Record<string, ComponentType<unknown>> = {}

let currentContext: SuiContext = {
  address: null,
  network: 'devnet',
  isConnected: false,
  accounts: [],
}

const contextListeners = new Set<SuiContextListener>()
const sharedDataStore: Record<string, unknown> = {}
const dataListeners: Record<string, Set<(value: unknown) => void>> = {}

export function updateSolanaContext(ctx: Partial<SuiContext>) {
  currentContext = { ...currentContext, ...ctx }
  contextListeners.forEach((l) => l(currentContext))
}

export const solanaHostAPI: SuiHostAPI = {
  registerComponent(name, component) {
    componentRegistry[name] = component
  },
  getComponent(name) {
    return componentRegistry[name]
  },
  log(message) {
    console.log(`[Solana] ${message}`)
  },
  getSuiContext() {
    return { ...currentContext }
  },
  onSuiContextChange(listener) {
    contextListeners.add(listener)
    return () => {
      contextListeners.delete(listener)
    }
  },
  requestConnect() {},
  requestDisconnect() {},
  requestNetworkSwitch() {},
  async signAndExecuteTransaction(): Promise<TransactionResult> {
    throw new Error('Solana dashboard does not support Sui transactions')
  },
  async signPersonalMessage(): Promise<PersonalMessageResult> {
    throw new Error('Solana dashboard does not support Sui message signing')
  },
  registerSigner() {},
  setSharedData(key, value) {
    sharedDataStore[key] = value
    dataListeners[key]?.forEach((l) => l(value))
  },
  getSharedData(key) {
    return sharedDataStore[key]
  },
  onSharedDataChange(key, listener) {
    if (!dataListeners[key]) dataListeners[key] = new Set()
    dataListeners[key].add(listener)
    return () => {
      dataListeners[key]?.delete(listener)
    }
  },
}

export function getRegisteredSolanaComponents(): string[] {
  return Object.keys(componentRegistry)
}

export function unregisterSolanaComponent(name: string): void {
  delete componentRegistry[name]
}

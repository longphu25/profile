import { useState, useEffect } from 'react'
import type { SuiHostAPI } from '../../../src/sui-dashboard/sui-types'

export function useWallet(sharedHost: SuiHostAPI | null) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!sharedHost) return
    const ctx = sharedHost.getSuiContext()
    setWalletAddress(ctx.address)
    setIsConnected(ctx.isConnected)
    return sharedHost.onSuiContextChange((c) => {
      setWalletAddress(c.address)
      setIsConnected(c.isConnected)
    })
  }, [sharedHost])

  return { walletAddress, isConnected }
}

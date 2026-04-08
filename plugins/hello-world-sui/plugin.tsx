// Hello World SUI Plugin
// Requests SUI from faucet (Devnet/Testnet) and displays balance
// Dual-mode: standalone or shared context (auto-fills address from connected wallet)

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { getFaucetHost, requestSuiFromFaucetV2 } from '@mysten/sui/faucet'
import { MIST_PER_SUI } from '@mysten/sui/utils'
import { useState, useEffect } from 'react'
import './style.css'

type Network = 'devnet' | 'testnet'

const NETWORK_URLS: Record<Network, string> = {
  devnet: 'https://fullnode.devnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
}

function mistToSui(mist: string): string {
  const val = Number(mist) / Number(MIST_PER_SUI)
  return val.toFixed(4)
}

// Store reference to SuiHostAPI if available (set during init)
let sharedHost: SuiHostAPI | null = null

function HelloSuiComponent() {
  const [address, setAddress] = useState('')
  const [network, setNetwork] = useState<Network>('devnet')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [balanceBefore, setBalanceBefore] = useState<string | null>(null)
  const [balanceAfter, setBalanceAfter] = useState<string | null>(null)

  // Auto-fill address from shared context if available
  useEffect(() => {
    if (!sharedHost) return
    const ctx = sharedHost.getSuiContext()
    if (ctx.address && !address) {
      setAddress(ctx.address)
    }
    const unsub = sharedHost.onSuiContextChange((newCtx) => {
      if (newCtx.address) setAddress(newCtx.address)
    })
    return unsub
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRequestSui = async () => {
    if (!address.trim()) {
      setStatus('error')
      setMessage('Please enter a SUI address')
      return
    }

    setStatus('loading')
    setMessage('')
    setBalanceBefore(null)
    setBalanceAfter(null)

    try {
      const client = new SuiGrpcClient({
        network,
        baseUrl: NETWORK_URLS[network],
      })

      const before = await client.core.getBalance({ owner: address })
      setBalanceBefore(mistToSui(before.balance.balance))

      const result = await requestSuiFromFaucetV2({
        host: getFaucetHost(network),
        recipient: address,
      })

      if (typeof result.status === 'object' && 'Failure' in result.status) {
        throw new Error(result.status.Failure.internal)
      }

      const after = await client.core.getBalance({ owner: address })
      setBalanceAfter(mistToSui(after.balance.balance))

      setStatus('success')
      setMessage(`Hello, SUI! Received tokens on ${network}.`)
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="sui-plugin">
      <h3 className="sui-plugin__title">🌊 Hello World SUI</h3>
      <p className="sui-plugin__desc">Request SUI from the faucet on Devnet or Testnet.</p>

      <div className="sui-plugin__form">
        <label className="sui-plugin__label">Network</label>
        <select
          className="sui-plugin__select"
          value={network}
          onChange={(e) => setNetwork(e.target.value as Network)}
        >
          <option value="devnet">Devnet</option>
          <option value="testnet">Testnet</option>
        </select>

        <label className="sui-plugin__label">Wallet Address</label>
        <input
          className="sui-plugin__input"
          type="text"
          placeholder="0x..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <button
          className="sui-plugin__btn"
          onClick={handleRequestSui}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Requesting SUI...' : 'Request SUI from Faucet'}
        </button>
      </div>

      {(balanceBefore !== null || balanceAfter !== null) && (
        <div className="sui-plugin__balance">
          {balanceBefore !== null && <div>Balance before: {balanceBefore} SUI</div>}
          {balanceAfter !== null && <div>Balance after: {balanceAfter} SUI</div>}
        </div>
      )}

      {message && (
        <div
          className={`sui-plugin__message sui-plugin__message--${status === 'error' ? 'error' : 'success'}`}
        >
          {message}
        </div>
      )}
    </div>
  )
}

const HelloWorldSuiPlugin: Plugin = {
  name: 'HelloWorldSui',
  version: '1.1.0',
  styleUrls: ['/plugins/hello-world-sui/style.css'],

  init(host: HostAPI) {
    // Store shared host reference if in sui-dashboard mode
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('HelloSui', HelloSuiComponent)
    host.log(
      'HelloWorldSui plugin initialized' + (sharedHost ? ' (shared mode)' : ' (standalone mode)'),
    )
  },

  mount() {
    console.log('[HelloWorldSui] mounted')
  },

  unmount() {
    sharedHost = null
    console.log('[HelloWorldSui] unmounted')
  },
}

export default HelloWorldSuiPlugin

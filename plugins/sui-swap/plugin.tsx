// SUI Swap Plugin v2 — Multi-Route Aggregator
// Architecture: Strategy pattern (DexAdapter) + SRP components + streaming hooks

import type { Plugin, HostAPI } from '../../src/plugins/types'
import { isSuiHostAPI } from '../../src/sui-dashboard/sui-types'
import type { SuiHostAPI } from '../../src/sui-dashboard/sui-types'
import { useState, useEffect, useMemo } from 'react'
import { Transaction } from '@mysten/sui/transactions'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import {
  DeepBookClient,
  mainnetCoins,
  mainnetPools,
  mainnetPackageIds,
  testnetCoins,
  testnetPools,
  testnetPackageIds,
} from '@mysten/deepbook-v3'
import { useSwapQuotes } from './hooks/useSwapQuotes'
import { TokenInput, RouteList, SlippageSelector } from './components'
import type { QuoteParams, DexId } from './lib/types'
import { formatNum } from './lib/utils'
import { initWasm } from './lib/wasm-bridge'
import './style.css'

const RPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
}

const EXPLORER: Record<string, string> = {
  mainnet: 'https://suiscan.xyz/mainnet',
  testnet: 'https://suiscan.xyz/testnet',
}

const SUPPORTED_TOKENS = ['SUI', 'USDC', 'DEEP', 'WAL', 'USDT']

let sharedHost: SuiHostAPI | null = null

/** Factory: create DeepBookClient for on-chain execution */
function createDeepBook(network: 'mainnet' | 'testnet', address: string): DeepBookClient {
  const client = new SuiGrpcClient({ network, baseUrl: RPC_URLS[network] })
  return new DeepBookClient({
    client,
    address,
    network,
    coins: network === 'mainnet' ? mainnetCoins : testnetCoins,
    pools: network === 'mainnet' ? mainnetPools : testnetPools,
    packageIds: network === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
  })
}

/**
 * SwapContent — main swap UI component.
 * Composed from small SRP sub-components.
 * Uses useSwapQuotes hook for streaming multi-route quotes.
 */
function SwapContent() {
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>(() => {
    if (sharedHost) {
      const ctx = sharedHost.getSuiContext()
      if (ctx.network === 'testnet') return 'testnet'
    }
    return 'mainnet'
  })
  const [fromToken, setFromToken] = useState('SUI')
  const [toToken, setToToken] = useState('USDC')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [selectedRoute, setSelectedRoute] = useState<DexId | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [txDigest, setTxDigest] = useState<string | null>(null)
  const [swapError, setSwapError] = useState<string | null>(null)

  const [address, setAddress] = useState<string | null>(
    () => sharedHost?.getSuiContext().address ?? null,
  )
  const [isConnected, setIsConnected] = useState(
    () => sharedHost?.getSuiContext().isConnected ?? false,
  )

  useEffect(() => {
    if (!sharedHost) return
    return sharedHost.onSuiContextChange((ctx) => {
      setAddress(ctx.address)
      setIsConnected(ctx.isConnected)
      if (ctx.network === 'testnet' || ctx.network === 'mainnet') {
        setNetwork(ctx.network as 'mainnet' | 'testnet')
      }
    })
  }, [])

  const amountNum = parseFloat(amount) || 0

  const quoteParams: QuoteParams | null = useMemo(() => {
    if (amountNum <= 0 || fromToken === toToken) return null
    return {
      fromToken,
      toToken,
      amount: amountNum,
      slippage: slippage / 100,
      sender: address,
      network,
    }
  }, [fromToken, toToken, amountNum, slippage, address, network])

  const { quotes, loading, error, bestDex } = useSwapQuotes(quoteParams)

  useEffect(() => {
    if (bestDex && !selectedRoute) setSelectedRoute(bestDex)
  }, [bestDex, selectedRoute])

  const handleFlip = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setAmount('')
    setSelectedRoute(null)
    setTxDigest(null)
    setSwapError(null)
  }

  const resetState = () => {
    setSelectedRoute(null)
    setTxDigest(null)
    setSwapError(null)
  }

  const handleSwap = async () => {
    if (!sharedHost || !selectedRoute || !address) return
    const chosen = quotes.find((q) => q.dex === selectedRoute)
    if (!chosen) return

    setSwapping(true)
    setSwapError(null)
    setTxDigest(null)

    try {
      if (chosen.dex === 'deepbook') {
        await executeDeepBookSwap(chosen.outputAmount)
      } else if (chosen.serializedTx) {
        const tx = Transaction.from(chosen.serializedTx)
        const result = await sharedHost.signAndExecuteTransaction(tx)
        setTxDigest(result.digest)
      } else {
        throw new Error(`${chosen.dexLabel} execution not available for this route`)
      }
    } catch (err: unknown) {
      setSwapError(err instanceof Error ? err.message : 'Swap failed')
    } finally {
      setSwapping(false)
    }
  }

  const executeDeepBookSwap = async (estimatedOutput: number) => {
    if (!address || !sharedHost) return
    const db = createDeepBook(network, address)
    const pools = network === 'mainnet' ? mainnetPools : testnetPools
    const poolKey = `${fromToken}_${toToken}`
    const reverseKey = `${toToken}_${fromToken}`
    const isBase = poolKey in pools
    const actualKey = isBase ? poolKey : reverseKey

    if (!(actualKey in pools)) throw new Error('Pool not found in DeepBook SDK')

    const minOut = estimatedOutput * (1 - slippage / 100)
    const tx = new Transaction()

    if (isBase) {
      const [baseCoin, quoteCoin, deepCoin] = db.deepBook.swapExactBaseForQuote({
        poolKey: actualKey,
        amount: amountNum,
        deepAmount: 0.5,
        minOut,
      })(tx)
      tx.transferObjects([baseCoin, quoteCoin, deepCoin], address)
    } else {
      const [baseCoin, quoteCoin, deepCoin] = db.deepBook.swapExactQuoteForBase({
        poolKey: actualKey,
        amount: amountNum,
        deepAmount: 0.5,
        minOut,
      })(tx)
      tx.transferObjects([baseCoin, quoteCoin, deepCoin], address)
    }

    const result = await sharedHost.signAndExecuteTransaction(tx)
    setTxDigest(result.digest)
  }

  const selectedQuote = quotes.find((q) => q.dex === selectedRoute)
  const outputDisplay = loading
    ? '...'
    : selectedQuote
      ? formatNum(selectedQuote.outputAmount)
      : quotes[0]
        ? formatNum(quotes[0].outputAmount)
        : '0.0'

  return (
    <div className="sui-swap">
      <div className="sui-swap__header">
        <h2 className="sui-swap__title">Swap</h2>
        <p className="sui-swap__desc">Best price across DeepBook · Cetus · Turbos · 7k · Bluefin</p>
      </div>

      <TokenInput
        label="From"
        amount={amount}
        onAmountChange={(v) => {
          setAmount(v)
          resetState()
        }}
        token={fromToken}
        onTokenChange={(t) => {
          setFromToken(t)
          resetState()
        }}
        tokens={SUPPORTED_TOKENS.filter((t) => t !== toToken)}
      />

      <div className="sui-swap__flip">
        <button
          type="button"
          className="sui-swap__flip-btn"
          onClick={handleFlip}
          title="Swap direction"
        >
          ↕
        </button>
      </div>

      <TokenInput
        label="To"
        amount=""
        token={toToken}
        onTokenChange={(t) => {
          setToToken(t)
          resetState()
        }}
        tokens={SUPPORTED_TOKENS.filter((t) => t !== fromToken)}
        readOnly
        displayValue={outputDisplay}
      />

      <SlippageSelector value={slippage} onChange={setSlippage} />

      <RouteList
        quotes={quotes}
        toToken={toToken}
        selectedRoute={selectedRoute}
        bestDex={bestDex}
        loading={loading}
        hasAmount={amountNum > 0}
        onSelectRoute={setSelectedRoute}
      />

      {(error || swapError) && <div className="sui-swap__error">{swapError || error}</div>}

      {txDigest && (
        <div className="sui-swap__success">
          <span>✓ Swap successful</span>
          <a
            href={`${EXPLORER[network]}/tx/${txDigest}`}
            target="_blank"
            rel="noopener noreferrer"
            className="sui-swap__link"
          >
            {txDigest.slice(0, 10)}...{txDigest.slice(-6)}
          </a>
        </div>
      )}

      {!isConnected && sharedHost ? (
        <button
          type="button"
          className="sui-swap__action sui-swap__action--connect"
          onClick={() => sharedHost!.requestConnect()}
        >
          Connect Wallet
        </button>
      ) : (
        <button
          type="button"
          className="sui-swap__action"
          disabled={amountNum <= 0 || quotes.length === 0 || swapping || !selectedRoute}
          onClick={handleSwap}
        >
          {swapping
            ? 'Swapping...'
            : amountNum <= 0
              ? 'Enter amount'
              : `Swap via ${selectedQuote?.dexLabel || 'Best Route'}`}
        </button>
      )}

      <div className="sui-swap__footer">
        Powered by DeepBook · Cetus · Turbos · 7k · Bluefin — Best price routing
      </div>
    </div>
  )
}

const SuiSwapPlugin: Plugin = {
  name: 'SuiSwap',
  version: '2.0.0',
  styleUrls: ['/plugins/sui-swap/style.css'],

  init(host: HostAPI) {
    sharedHost = isSuiHostAPI(host) ? host : null
    host.registerComponent('SuiSwap', SwapContent)
    host.log('SuiSwap v2 — multi-route aggregator (DeepBook + Cetus + Turbos + 7k + Bluefin)')
  },

  mount() {
    initWasm()
    console.log('[SuiSwap] mounted')
  },
  unmount() {
    initWasm()
    sharedHost = null
  },
}

export default SuiSwapPlugin

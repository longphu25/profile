/**
 * Wallet data hooks — balances, manager balances, tx history, pending orders.
 */

import { useCallback, useState } from 'react'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { DeepBookClient, mainnetCoins, mainnetPools, mainnetPackageIds, testnetCoins, testnetPools, testnetPackageIds } from '@mysten/deepbook-v3'
import type { WalletBalance, MmBalances } from '../types'
import { INDEXER, RPC } from '../types'

export function useWalletData(network: string, pool: string) {
  const [balA, setBalA] = useState<WalletBalance>({ sui: 0, coins: [], loading: false })
  const [balB, setBalB] = useState<WalletBalance>({ sui: 0, coins: [], loading: false })
  const [mgrBals, setMgrBals] = useState<Record<string, Record<string, number>>>({})
  const [mgrBalsLoading, setMgrBalsLoading] = useState(false)
  const [mmBals, setMmBals] = useState<Record<string, MmBalances>>({})
  const [mmBalsLoading, setMmBalsLoading] = useState(false)
  const [txHistory, setTxHistory] = useState<Record<string, { digest: string; ts: string; status: string }[]>>({})
  const [pendingOrders, setPendingOrders] = useState<Record<string, { orderId: string; side: string; price: number; qty: number; filled: number }[]>>({})

  const fetchBalance = useCallback(async (addr: string): Promise<WalletBalance> => {
    try {
      const res = await fetch(RPC[network], {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'suix_getAllBalances', params: [addr] }),
      })
      const d = await res.json() as { result?: { coinType: string; totalBalance: string }[] }
      const coins = (d.result ?? []).map((c) => {
        const parts = c.coinType.split('::')
        const symbol = parts[parts.length - 1]
        const dec = symbol === 'SUI' ? 9 : 6
        return { symbol, balance: (parseInt(c.totalBalance, 10) / 10 ** dec).toFixed(4) }
      }).filter((c) => parseFloat(c.balance) > 0)
      const sui = parseFloat(coins.find((c) => c.symbol === 'SUI')?.balance ?? '0')
      return { sui, coins, loading: false }
    } catch {
      return { sui: 0, coins: [], loading: false }
    }
  }, [network])

  const fetchAllCoins = useCallback(async (addr: string): Promise<{ symbol: string; balance: string }[]> => {
    const bal = await fetchBalance(addr)
    return bal.coins
  }, [fetchBalance])

  const fetchMgrBals = useCallback(async (bmIdA: string | null, bmIdB: string | null) => {
    if (!bmIdA && !bmIdB) return
    setMgrBalsLoading(true)
    const net = network as 'mainnet' | 'testnet'
    const [base, quote] = pool.split('_')
    const coinKeys = [...new Set([base, quote, 'DEEP'])]
    const ids = [bmIdA, bmIdB].filter(Boolean) as string[]
    try {
      const client = new SuiGrpcClient({ network: net, baseUrl: RPC[net] })
      const dbClient = new DeepBookClient({
        client, address: '0x0', network: net,
        coins: net === 'mainnet' ? mainnetCoins : testnetCoins,
        pools: net === 'mainnet' ? mainnetPools : testnetPools,
        packageIds: net === 'mainnet' ? mainnetPackageIds : testnetPackageIds,
      })
      const result = await dbClient.checkManagerBalancesWithAddress(ids, coinKeys)
      setMgrBals(result)
    } catch { /* silent */ }
    setMgrBalsLoading(false)
  }, [network, pool])

  const fetchMmBals = useCallback(async (mmIdA: string | null, mmIdB: string | null) => {
    if (!mmIdA && !mmIdB) return
    setMmBalsLoading(true)
    const net = network as 'mainnet' | 'testnet'
    const result: Record<string, MmBalances> = {}
    for (const [key, id] of [['mmA', mmIdA], ['mmB', mmIdB]] as const) {
      if (!id) continue
      try {
        const client = new SuiGrpcClient({ network: net, baseUrl: RPC[net] })
        const db = new DeepBookClient({
          client, address: '0x0', network: net,
          marginManagers: { [key]: { address: id, poolKey: pool } },
        })
        const state = await db.getMarginManagerState(key)
        result[id] = {
          base: parseFloat(state.baseAsset) || 0,
          quote: parseFloat(state.quoteAsset) || 0,
          baseDebt: parseFloat(state.baseDebt) || 0,
          quoteDebt: parseFloat(state.quoteDebt) || 0,
        }
      } catch { /* MM may not exist */ }
    }
    setMmBals(result)
    setMmBalsLoading(false)
  }, [network, pool])

  const fetchTxHistory = useCallback(async (addr: string) => {
    try {
      const res = await fetch(RPC[network], {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'suix_queryTransactionBlocks',
          params: [{ filter: { FromAddress: addr }, options: { showEffects: true } }, null, 10, true],
        }),
      })
      const d = await res.json() as { result?: { data: { digest: string; timestampMs?: string; effects?: { status?: { status: string } } }[] } }
      const txs = (d.result?.data ?? []).map((t) => ({
        digest: t.digest,
        ts: t.timestampMs ? new Date(Number(t.timestampMs)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?',
        status: t.effects?.status?.status ?? '?',
      }))
      setTxHistory((prev) => ({ ...prev, [addr]: txs }))
    } catch { /* silent */ }
  }, [network])

  const fetchPendingOrders = useCallback(async (bmId: string | null, addr: string) => {
    if (!bmId) { setPendingOrders((prev) => ({ ...prev, [addr]: [] })); return }
    try {
      const poolsToCheck = [pool, 'SUI_USDC', 'DEEP_SUI', 'WAL_SUI']
      const allOrders: { orderId: string; side: string; price: number; qty: number; filled: number; pool: string }[] = []
      for (const p of [...new Set(poolsToCheck)]) {
        try {
          const res = await fetch(`${INDEXER[network]}/orders/${p}/${bmId}`)
          if (!res.ok) continue
          const orders = await res.json() as { order_id: string; is_bid: boolean; price: number; original_quantity: number; quantity: number }[]
          for (const o of orders) {
            allOrders.push({
              orderId: o.order_id, side: o.is_bid ? 'buy' : 'sell',
              price: o.price, qty: o.original_quantity, filled: o.original_quantity - o.quantity, pool: p,
            })
          }
        } catch { /* skip pool */ }
      }
      setPendingOrders((prev) => ({ ...prev, [addr]: allOrders }))
    } catch { setPendingOrders((prev) => ({ ...prev, [addr]: [] })) }
  }, [network, pool])

  return {
    balA, setBalA, balB, setBalB,
    mgrBals, mgrBalsLoading, fetchMgrBals,
    mmBals, mmBalsLoading, fetchMmBals,
    txHistory, fetchTxHistory,
    pendingOrders, fetchPendingOrders,
    fetchBalance, fetchAllCoins,
  }
}

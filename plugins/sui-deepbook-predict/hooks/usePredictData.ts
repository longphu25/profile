import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getOraclePrices,
  getOracles,
  getOracleState,
  getServerStatus,
  getVaultSummary,
} from '../data/predictRepository'

export function usePredictData() {
  const [oracles, setOracles] = useState<any[]>([])
  const [selectedOracle, setSelectedOracle] = useState<string | null>(null)
  const [oracleState, setOracleState] = useState<any>(null)
  const [vaultData, setVaultData] = useState<any>(null)
  const [prices, setPrices] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverStatus, setServerStatus] = useState<string>('checking')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkServer = useCallback(async () => {
    setServerStatus(await getServerStatus())
  }, [])

  const fetchOracles = useCallback(async () => {
    const data = await getOracles()
    if (data.length > 0) {
      setOracles(data)
      if (!selectedOracle && data.length > 0) setSelectedOracle(data[0].oracle_id)
    }
  }, [selectedOracle])

  const fetchOracleState = useCallback(async () => {
    if (!selectedOracle) return
    const data = await getOracleState(selectedOracle)
    if (data) setOracleState(data)
  }, [selectedOracle])

  const fetchVault = useCallback(async () => {
    const data = await getVaultSummary()
    if (data) setVaultData(data)
  }, [])

  const fetchPrices = useCallback(async () => {
    if (!selectedOracle) return
    const data = await getOraclePrices(selectedOracle)
    if (data.length > 0) setPrices(data)
  }, [selectedOracle])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([checkServer(), fetchOracles(), fetchVault()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch')
    }
    setLoading(false)
  }, [checkServer, fetchOracles, fetchVault])

  useEffect(() => {
    refreshAll()
    pollRef.current = setInterval(refreshAll, 20000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [refreshAll])

  useEffect(() => {
    if (selectedOracle) {
      fetchOracleState()
      fetchPrices()
    }
  }, [selectedOracle, fetchOracleState, fetchPrices])

  return {
    oracles,
    selectedOracle,
    setSelectedOracle,
    oracleState,
    vaultData,
    prices,
    loading,
    error,
    serverStatus,
    refreshAll,
  }
}

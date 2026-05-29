/**
 * useOracleData — React hook to consume shared oracle data from oracleService.
 * Any component in any plugin can use this instead of prop drilling.
 */

import { useState, useEffect } from 'react'
import type { OracleData } from '../oracleService'
import { getOracleData } from '../oracleService'

let sharedHostRef: any = null

export function setOracleHookHost(host: any) {
  sharedHostRef = host
}

export function useOracleData(): OracleData {
  const [data, setData] = useState<OracleData>(getOracleData())

  useEffect(() => {
    if (!sharedHostRef) return
    return sharedHostRef.onSharedDataChange('oracleData', (newData: OracleData) => {
      setData({ ...newData })
    })
  }, [])

  return data
}

// BTC Chart — UI chrome state (tools, intel drawer, mobile rail, toasts).
import { useEffect, useState } from 'react'
import type { IntelTab } from '../lib/intel-panels'
import type { MobileRailTab } from '../lib/mobile-rail-tabs'

export interface UseBtcChartUI {
  toolsOpen: boolean
  setToolsOpen: React.Dispatch<React.SetStateAction<boolean>>
  intelTab: IntelTab
  setIntelTab: React.Dispatch<React.SetStateAction<IntelTab>>
  intelSearch: string
  setIntelSearch: React.Dispatch<React.SetStateAction<string>>
  sidebarMobileOpen: boolean
  setSidebarMobileOpen: React.Dispatch<React.SetStateAction<boolean>>
  mobileRailTab: MobileRailTab
  setMobileRailTab: React.Dispatch<React.SetStateAction<MobileRailTab>>
  intelOpen: boolean
  setIntelOpen: React.Dispatch<React.SetStateAction<boolean>>
  firedToast: string | null
  setFiredToast: React.Dispatch<React.SetStateAction<string | null>>
  importErr: string | null
  setImportErr: React.Dispatch<React.SetStateAction<string | null>>
}

/** Owns transient UI state: panels, drawers, mobile rail, and toast messages. */
export function useBtcChartUI(): UseBtcChartUI {
  const [toolsOpen, setToolsOpen] = useState(false)
  const [intelTab, setIntelTab] = useState<IntelTab>('trade')
  const [intelSearch, setIntelSearch] = useState('')
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false)
  const [mobileRailTab, setMobileRailTab] = useState<MobileRailTab>('setup')
  const [intelOpen, setIntelOpen] = useState(false)
  const [firedToast, setFiredToast] = useState<string | null>(null)
  const [importErr, setImportErr] = useState<string | null>(null)

  useEffect(() => {
    if (!sidebarMobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sidebarMobileOpen])

  useEffect(() => {
    if (!firedToast) return
    const t = setTimeout(() => setFiredToast(null), 5000)
    return () => clearTimeout(t)
  }, [firedToast])

  return {
    toolsOpen,
    setToolsOpen,
    intelTab,
    setIntelTab,
    intelSearch,
    setIntelSearch,
    sidebarMobileOpen,
    setSidebarMobileOpen,
    mobileRailTab,
    setMobileRailTab,
    intelOpen,
    setIntelOpen,
    firedToast,
    setFiredToast,
    importErr,
    setImportErr,
  }
}

import { useMemo, useState, useEffect } from 'react'
import { usePredictClub } from './usePredictClub'
import { QuickPredictPanel } from './QuickPredictPanel'
import { createSuiPredictGateway } from '../infrastructure/suiPredictGateway'
import { startFastPoll, stopFastPoll } from '../infrastructure/deepbookOracleService'

export function QuickPredictPanelWrapper() {
  const { oracleSnapshot, context, balances, host, currentMember, predictManagerId, club } =
    usePredictClub()

  const [open, setOpen] = useState(false)
  const [quickActive, setQuickActive] = useState(false)
  const predictGateway = useMemo(() => createSuiPredictGateway(), [])

  useEffect(() => {
    if (quickActive) startFastPoll()
    else stopFastPoll()
    return () => stopFastPoll()
  }, [quickActive])

  // Listen for custom event from trigger button in HTML
  useEffect(() => {
    const handler = () => setOpen(true)
    document.addEventListener('pc:open-quick-predict', handler)
    return () => document.removeEventListener('pc:open-quick-predict', handler)
  }, [])

  const signAndExecute = useMemo(
    () => async (tx: any) => {
      if (!host) throw new Error('No host available')
      const result = await host.signAndExecuteTransaction(tx)
      return { digest: result.digest }
    },
    [host],
  )

  const isLeader =
    context.isConnected && context.address
      ? club.members.some(
          (m) =>
            m.role === 'leader' &&
            m.wallet.toLowerCase().includes(context.address!.slice(-6).toLowerCase()),
        )
      : false

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div className="bg-surface-container rounded-lg shadow-xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col relative">
        <button
          className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
        <div className="flex-1 overflow-y-auto">
          <QuickPredictPanel
            oracleSnapshot={oracleSnapshot}
            walletAddress={context.address}
            managerId={predictManagerId}
            dusdc={balances.dusdc}
            isLeader={isLeader || !!context.address}
            predictGateway={predictGateway}
            signAndExecute={signAndExecute}
            memberName={currentMember?.name ?? 'You'}
            onActiveChange={setQuickActive}
          />
        </div>
      </div>
    </div>
  )
}

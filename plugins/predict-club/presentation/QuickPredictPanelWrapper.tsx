import { useMemo } from 'react'
import { usePredictClub } from './usePredictClub'
import { QuickPredictPanel } from './QuickPredictPanel'
import { createSuiPredictGateway } from '../infrastructure/suiPredictGateway'
import { startFastPoll, stopFastPoll } from '../infrastructure/deepbookOracleService'
import { useEffect, useState } from 'react'

export function QuickPredictPanelWrapper() {
  const { oracleSnapshot, context, balances, host, currentMember, predictManagerId, club } =
    usePredictClub()

  const [quickActive, setQuickActive] = useState(false)
  const predictGateway = useMemo(() => createSuiPredictGateway(), [])

  useEffect(() => {
    if (quickActive) startFastPoll()
    else stopFastPoll()
    return () => stopFastPoll()
  }, [quickActive])

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

  return (
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
  )
}

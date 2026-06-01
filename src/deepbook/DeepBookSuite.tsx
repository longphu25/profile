/**
 * DeepBookSuite — DeepBook shell with grouped navigation, lazy-loaded plugins,
 * shared wallet context, and Shadow DOM plugin rendering.
 */

import { useEffect, useState } from 'react'
import {
  DAppKitProvider,
  useDAppKit,
  useCurrentAccount,
  useCurrentNetwork,
  useWallets,
  useWalletConnection,
} from '@mysten/dapp-kit-react'
import { createDAppKit } from '@mysten/dapp-kit-core'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { registerActions, suiHostAPI, updateSuiContext } from '../sui-dashboard/sui-host'
import { MissionControl } from './MissionControl'
import { DeepBookMobileNav } from './components/DeepBookNav'
import { DeepBookWorkspace } from './components/DeepBookWorkspace'
import { RightRail } from './components/RightRail'
import { WalletBar, WalletConnectModal } from './components/WalletBar'
import { getGroupPlugins, getPluginById } from './config/plugins'
import type { NavGroup } from './config/nav'

const GRPC_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
}

const dAppKit = createDAppKit({
  networks: ['mainnet', 'testnet', 'devnet'],
  defaultNetwork: 'testnet',
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
})

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit
  }
}

const QUEST_COUNT = 6

function loadQuestCount(): number {
  try {
    return Object.values(JSON.parse(localStorage.getItem('deepbook-quests-v1') || '{}')).filter(
      Boolean,
    ).length
  } catch {
    return 0
  }
}

function DeepBookInner() {
  const [activeGroup, setActiveGroup] = useState<NavGroup>('predict')
  const [activePlugin, setActivePlugin] = useState('predict')
  const [showWallets, setShowWallets] = useState(false)

  const wallets = useWallets()
  const connection = useWalletConnection()
  const account = useCurrentAccount()
  const network = useCurrentNetwork()
  const dAppKitInstance = useDAppKit()

  useEffect(() => {
    updateSuiContext({
      address: account?.address ?? null,
      network,
      isConnected: connection.isConnected,
      accounts: [],
    })
    suiHostAPI.setSharedData(
      'walletProfile',
      account?.address ? { address: account.address } : null,
    )
  }, [account?.address, network, connection.isConnected])

  useEffect(() => {
    registerActions({
      onConnect: () => setShowWallets(true),
      onDisconnect: () => dAppKitInstance.disconnectWallet(),
      onNetworkSwitch: (net) =>
        dAppKitInstance.switchNetwork(net as 'mainnet' | 'testnet' | 'devnet'),
      onSignAndExecuteTransaction: async (transaction) => {
        const result = await dAppKitInstance.signAndExecuteTransaction({ transaction })
        const tx = result.Transaction ?? result.FailedTransaction
        if (result.$kind === 'FailedTransaction') throw new Error(`TX failed: ${tx?.digest}`)
        return { digest: tx!.digest, effects: tx }
      },
      onSignPersonalMessage: async (message) => {
        const result = await dAppKitInstance.signPersonalMessage({ message })
        return { signature: result.signature, bytes: result.bytes }
      },
    })
  }, [dAppKitInstance])

  const selectPlugin = (id: string) => {
    const plugin = getPluginById(id)
    if (!plugin) return
    setActiveGroup(plugin.group)
    setActivePlugin(id)
  }

  const handleGroupClick = (group: NavGroup) => {
    setActiveGroup(group)
    if (group === 'home' || group === 'rewards') return
    const firstPlugin = getGroupPlugins(group)[0]
    if (firstPlugin) selectPlugin(firstPlugin.id)
  }

  const questsDone = loadQuestCount()
  const activePluginDef = getPluginById(activePlugin)
  const activeGroupPlugins = getGroupPlugins(activeGroup)

  const centerContent =
    activeGroup === 'home' ? (
      <MissionControl
        commander={{
          isConnected: connection.isConnected,
          address: account?.address ?? null,
          claimableCount: 0,
          oracleHealth: null,
          hasOpenPositions: false,
          btcSpot: null,
        }}
        onSelectPlugin={selectPlugin}
        onConnect={() => setShowWallets(true)}
      />
    ) : activeGroup === 'rewards' ? (
      <RewardsPanel
        questsDone={questsDone}
        questTotal={QUEST_COUNT}
        isConnected={connection.isConnected}
      />
    ) : undefined

  return (
    <div
      className="min-h-[100dvh] flex flex-col pb-16 md:pb-0"
      style={{ background: 'var(--color-ink)' }}
    >
      <WalletBar
        activeGroup={activeGroup}
        isConnected={connection.isConnected}
        account={account ?? null}
        onConnectClick={() => setShowWallets(true)}
        onDisconnect={() => dAppKitInstance.disconnectWallet()}
        onGroupClick={handleGroupClick}
      />

      {showWallets && (
        <WalletConnectModal
          wallets={wallets}
          onClose={() => setShowWallets(false)}
          onConnect={async (wallet) => {
            await dAppKitInstance.connectWallet({ wallet: wallet as never })
            setShowWallets(false)
          }}
        />
      )}

      <main className="flex-1 mx-3 mt-3 mb-4">
        <div className="mx-auto max-w-[1400px] flex gap-4">
          <DeepBookWorkspace
            activeGroup={activeGroup}
            activePlugin={activePlugin}
            activePluginDef={activePluginDef}
            groupPlugins={activeGroupPlugins}
            onSelectPlugin={selectPlugin}
          >
            {centerContent}
          </DeepBookWorkspace>

          <RightRail
            activePlugin={activePlugin}
            address={account?.address ?? null}
            network={network}
            isConnected={connection.isConnected}
            questsDone={questsDone}
            questTotal={QUEST_COUNT}
            onConnect={() => setShowWallets(true)}
            onSelectPlugin={selectPlugin}
            onShowRewards={() => setActiveGroup('rewards')}
          />
        </div>
      </main>

      <DeepBookMobileNav activeGroup={activeGroup} onGroupClick={handleGroupClick} />
    </div>
  )
}

const ACHIEVEMENTS = [
  { id: 'first-swap', label: 'First Swap', desc: 'Execute your first DeepBook swap' },
  { id: 'first-predict', label: 'First Predict Trade', desc: 'Mint a binary or range position' },
  { id: 'first-bot', label: 'Bot Operator', desc: 'Run or inspect a hedging cycle' },
  { id: 'first-risk', label: 'Risk Reviewer', desc: 'Complete a portfolio risk review' },
  { id: 'streak-3', label: '3-Day Streak', desc: 'Complete quests 3 days in a row' },
  { id: 'streak-7', label: '7-Day Streak', desc: 'Complete quests 7 days in a row' },
]

function RewardsPanel({
  questsDone,
  questTotal,
  isConnected,
}: {
  questsDone: number
  questTotal: number
  isConnected: boolean
}) {
  const achievements: Record<string, boolean> = (() => {
    try {
      return JSON.parse(localStorage.getItem('deepbook-achievements-v1') || '{}')
    } catch {
      return {}
    }
  })()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-lg font-bold mb-1"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-satoshi)' }}
        >
          Rewards
        </h2>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          Complete quests and earn achievements
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-muted)' }}
          >
            Daily Quests
          </p>
          <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
            {questsDone}/{questTotal}
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden mb-1"
          style={{ background: 'rgba(190,255,234,0.1)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(questsDone / questTotal) * 100}%`,
              background: 'var(--color-mint)',
            }}
          />
        </div>
        <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
          {questsDone === questTotal
            ? 'All quests completed today!'
            : `${questTotal - questsDone} quests remaining`}
        </p>
      </section>

      <section>
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--color-muted)' }}
        >
          Achievements
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ACHIEVEMENTS.map((achievement) => {
            const done = !!achievements[achievement.id]
            return (
              <div
                key={achievement.id}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{
                  background: done ? 'rgba(128,255,213,0.06)' : 'rgba(8,24,25,0.82)',
                  border: `1px solid ${done ? 'rgba(128,255,213,0.2)' : 'var(--color-line)'}`,
                  opacity: done ? 1 : 0.6,
                }}
              >
                <div
                  className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
                  style={{
                    background: done ? 'rgba(128,255,213,0.15)' : 'rgba(190,255,234,0.06)',
                    color: done ? 'var(--color-mint)' : 'var(--color-muted)',
                  }}
                >
                  {done ? '✓' : '○'}
                </div>
                <div>
                  <p
                    className="text-xs font-semibold"
                    style={{ color: done ? 'var(--color-text)' : 'var(--color-muted)' }}
                  >
                    {achievement.label}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                    {achievement.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {!isConnected && (
        <p className="text-xs text-center" style={{ color: 'var(--color-muted)' }}>
          Connect wallet to track achievements on-chain in a future update
        </p>
      )}
    </div>
  )
}

export function DeepBookSuite() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <DeepBookInner />
    </DAppKitProvider>
  )
}

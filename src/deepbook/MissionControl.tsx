/**
 * Mission Control — Phase 2
 * Recommended actions based on wallet state, oracle health, claimable positions.
 * Quest board with local session state.
 */

import { useState, useEffect } from 'react'

export type MissionStatus = 'available' | 'in-progress' | 'completed' | 'blocked'

export interface Mission {
  id: string
  label: string
  desc: string
  category: 'trade' | 'risk' | 'bot' | 'portfolio' | 'predict' | 'learning'
  status: MissionStatus
  pluginId?: string
  badge?: string
}

export interface CommanderState {
  isConnected: boolean
  address: string | null
  claimableCount: number
  oracleHealth: 'HEALTHY' | 'DELAYED' | 'STALE' | null
  hasOpenPositions: boolean
  btcSpot: number | null
}

const QUEST_STORAGE_KEY = 'deepbook-quests-v1'

function loadQuests(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(QUEST_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveQuests(q: Record<string, boolean>) {
  localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(q))
}

const DAILY_QUESTS: { id: string; label: string; desc: string }[] = [
  { id: 'swap', label: 'Make a Swap', desc: 'Execute one DeepBook spot swap' },
  { id: 'orderbook', label: 'Review Orderbook', desc: 'Check live bids/asks for a pool' },
  {
    id: 'predict-signal',
    label: 'Review Predict Signal',
    desc: 'Open Predict and check oracle health',
  },
  { id: 'portfolio-check', label: 'Check Portfolio', desc: 'Review open positions and PnL' },
  { id: 'risk-review', label: 'Risk Review', desc: 'Inspect margin or hedging state' },
  { id: 'claim', label: 'Claim Settlement', desc: 'Claim or scan for settled positions' },
]

interface Props {
  commander: CommanderState
  onSelectPlugin: (id: string) => void
  onConnect: () => void
}

export function MissionControl({ commander, onSelectPlugin, onConnect }: Props) {
  const [quests, setQuests] = useState<Record<string, boolean>>(loadQuests)

  useEffect(() => {
    saveQuests(quests)
  }, [quests])

  const completeQuest = (id: string) => setQuests((q) => ({ ...q, [id]: true }))
  const completedCount = Object.values(quests).filter(Boolean).length

  // Recommended actions — deterministic rules from plan 06 Phase 2
  const recommendations: {
    label: string
    desc: string
    cta: string
    pluginId: string
    urgent?: boolean
  }[] = []

  if (!commander.isConnected) {
    recommendations.push({
      label: 'Connect Wallet',
      desc: 'Connect to access trading, portfolio, and quests',
      cta: 'Connect',
      pluginId: '',
    })
  } else {
    if (commander.claimableCount > 0) {
      recommendations.push({
        label: `Claim ${commander.claimableCount} Settlement${commander.claimableCount > 1 ? 's' : ''}`,
        desc: 'Settled positions are ready to redeem',
        cta: 'Claim Now',
        pluginId: 'predict',
        urgent: true,
      })
    }
    if (commander.oracleHealth === 'STALE') {
      recommendations.push({
        label: 'Oracle Feed Stale',
        desc: 'Predict oracle is delayed — review before trading',
        cta: 'Analyze Market',
        pluginId: 'predict',
      })
    } else if (commander.oracleHealth === 'HEALTHY') {
      recommendations.push({
        label: 'BTC Predict Opportunity',
        desc: `Spot $${commander.btcSpot ? Math.round(commander.btcSpot / 1e9).toLocaleString() : '—'} — active oracle is healthy`,
        cta: 'Start Trade',
        pluginId: 'predict',
      })
    }
    if (commander.hasOpenPositions) {
      recommendations.push({
        label: 'Review Open Positions',
        desc: 'Check unrealized PnL and expiry risk',
        cta: 'View Portfolio',
        pluginId: 'predict',
      })
    }
    if (recommendations.length === 0) {
      recommendations.push({
        label: 'Explore DeepBook',
        desc: 'Swap tokens or check the orderbook',
        cta: 'Trade Now',
        pluginId: 'swap',
      })
    }
  }

  const QUICK_ACTIONS = [
    { id: 'predict', label: 'Predict Market', desc: 'BTC binary & range options', icon: '◇' },
    { id: 'swap', label: 'Swap', desc: 'DeepBook V3 spot swap', icon: '⇄' },
    { id: 'portfolio', label: 'Portfolio', desc: 'Positions, PnL, settlements', icon: '◫' },
    { id: 'hedging-bot', label: 'Hedging Bot', desc: 'Automated delta-neutral', icon: '⚙' },
    { id: 'analysis', label: 'Analysis', desc: 'Pool stats, price feeds', icon: '◊' },
    { id: 'orderbook', label: 'Orderbook', desc: 'Live bids/asks, depth', icon: '≡' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Commander header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-xl font-bold"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-satoshi)' }}
          >
            {commander.isConnected ? 'Mission Control' : 'DeepBook Suite'}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
            {commander.isConnected
              ? `${commander.address?.slice(0, 8)}…${commander.address?.slice(-6)} · Testnet`
              : 'Connect wallet to unlock missions and quests'}
          </p>
        </div>
        {commander.isConnected && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
            style={{
              background: 'rgba(128,255,213,0.08)',
              border: '1px solid rgba(128,255,213,0.16)',
              color: 'var(--color-mint)',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--color-mint)' }}
            />
            Ready
          </div>
        )}
      </div>

      {/* Recommended actions */}
      <section>
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-2"
          style={{ color: 'var(--color-muted)' }}
        >
          Recommended
        </p>
        <div className="flex flex-col gap-2">
          {recommendations.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{
                background: r.urgent ? 'rgba(255,196,107,0.08)' : 'rgba(8,24,25,0.82)',
                border: `1px solid ${r.urgent ? 'rgba(255,196,107,0.25)' : 'var(--color-line)'}`,
              }}
            >
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: r.urgent ? 'var(--color-amber)' : 'var(--color-text)' }}
                >
                  {r.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                  {r.desc}
                </p>
              </div>
              <button type="button"
                onClick={() => (r.pluginId ? onSelectPlugin(r.pluginId) : onConnect())}
                className="ml-4 shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                style={{
                  background: r.urgent ? 'rgba(255,196,107,0.15)' : 'rgba(128,255,213,0.1)',
                  color: r.urgent ? 'var(--color-amber)' : 'var(--color-mint)',
                  border: `1px solid ${r.urgent ? 'rgba(255,196,107,0.3)' : 'rgba(128,255,213,0.2)'}`,
                }}
              >
                {r.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Quick launch */}
      <section>
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-2"
          style={{ color: 'var(--color-muted)' }}
        >
          Quick Launch
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {QUICK_ACTIONS.map((a) => (
            <button type="button"
              key={a.id}
              onClick={() => onSelectPlugin(a.id)}
              className="flex flex-col gap-1 p-3 rounded-xl text-left cursor-pointer transition-all"
              style={{ background: 'rgba(8,24,25,0.82)', border: '1px solid var(--color-line)' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(128,255,213,0.28)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-line)'
              }}
            >
              <span className="text-base" style={{ color: 'var(--color-mint)' }}>
                {a.icon}
              </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                {a.label}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                {a.desc}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Daily quests */}
      {commander.isConnected && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <p
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-muted)' }}
            >
              Daily Quests
            </p>
            <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
              {completedCount}/{DAILY_QUESTS.length} completed
            </span>
          </div>
          {/* Progress bar */}
          <div
            className="h-1 rounded-full mb-3 overflow-hidden"
            style={{ background: 'rgba(190,255,234,0.1)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(completedCount / DAILY_QUESTS.length) * 100}%`,
                background: 'var(--color-mint)',
              }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DAILY_QUESTS.map((q) => (
              <div
                key={q.id}
                className="flex items-center gap-3 p-2.5 rounded-lg"
                style={{
                  background: quests[q.id] ? 'rgba(128,255,213,0.06)' : 'rgba(8,24,25,0.6)',
                  border: `1px solid ${quests[q.id] ? 'rgba(128,255,213,0.2)' : 'var(--color-line)'}`,
                  opacity: quests[q.id] ? 0.7 : 1,
                }}
              >
                <button type="button"
                  onClick={() => completeQuest(q.id)}
                  className="shrink-0 h-4 w-4 rounded flex items-center justify-center cursor-pointer transition-all"
                  style={{
                    background: quests[q.id] ? 'var(--color-mint)' : 'transparent',
                    border: `1px solid ${quests[q.id] ? 'var(--color-mint)' : 'rgba(190,255,234,0.3)'}`,
                  }}
                >
                  {quests[q.id] && (
                    <span style={{ color: 'var(--color-ink)', fontSize: '9px', fontWeight: 700 }}>
                      ✓
                    </span>
                  )}
                </button>
                <div className="min-w-0">
                  <p
                    className="text-xs font-medium truncate"
                    style={{
                      color: quests[q.id] ? 'var(--color-muted)' : 'var(--color-text)',
                      textDecoration: quests[q.id] ? 'line-through' : 'none',
                    }}
                  >
                    {q.label}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--color-muted)' }}>
                    {q.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {completedCount === DAILY_QUESTS.length && (
            <div
              className="mt-3 p-3 rounded-xl text-center text-xs font-semibold"
              style={{
                background: 'rgba(128,255,213,0.1)',
                color: 'var(--color-mint)',
                border: '1px solid rgba(128,255,213,0.2)',
              }}
            >
              🎯 All daily quests completed!
            </div>
          )}
        </section>
      )}
    </div>
  )
}

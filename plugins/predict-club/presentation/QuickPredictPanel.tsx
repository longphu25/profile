import { useCallback, useEffect, useRef, useState } from 'react'
import { startQuickRound } from '../application/startQuickRound'
import { joinQuickRound } from '../application/joinQuickRound'
import { canClaim, claimForParticipant } from '../application/settleQuickRound'
import {
  isJoinWindowOpen,
  hasJoined,
  remainingJoinSeconds,
  remainingExpirySeconds,
  lockRound,
  settleRound,
  type QuickRound,
  type QuickRoundParticipant,
} from '../domain/quickRound'
import { formatUsd, truncateAddress } from './shared'
import type { ClubOracleSnapshot } from '../infrastructure/deepbookOracleService'
import type { SuiPredictGateway } from '../infrastructure/suiPredictGateway'
import type { Direction } from '../domain/types'

interface QuickPredictPanelProps {
  oracleSnapshot: ClubOracleSnapshot
  walletAddress: string | null
  managerId: string | null
  dusdc: number
  isLeader: boolean
  predictGateway: SuiPredictGateway
  signAndExecute: (tx: any) => Promise<{ digest: string }>
  memberName: string
  onActiveChange?: (active: boolean) => void
}

const STORAGE_KEY = 'predict-club:quick-rounds'

function loadHistory(): QuickRound[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(rounds: QuickRound[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rounds.slice(-20)))
  } catch {}
}

export function QuickPredictPanel(props: QuickPredictPanelProps) {
  const {
    oracleSnapshot,
    walletAddress,
    managerId,
    dusdc,
    isLeader,
    predictGateway,
    signAndExecute,
    memberName,
    onActiveChange,
  } = props

  const [round, setRound] = useState<QuickRound | null>(null)
  const [history, setHistory] = useState<QuickRound[]>(loadHistory)
  const [joinSeconds, setJoinSeconds] = useState(0)
  const [expirySeconds, setExpirySeconds] = useState(0)
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Notify parent about active round state (for fast polling)
  useEffect(() => {
    const active = !!(round && round.status !== 'settled' && round.status !== 'claimed')
    onActiveChange?.(active)
  }, [round?.status, onActiveChange])

  // Timer tick
  useEffect(() => {
    if (!round || round.status === 'settled' || round.status === 'claimed') {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => {
      if (!round) return
      setJoinSeconds(remainingJoinSeconds(round))
      setExpirySeconds(remainingExpirySeconds(round))

      // Auto-lock when join window closes
      if (round.status === 'live' && !isJoinWindowOpen(round)) {
        setRound((r) => (r ? lockRound(r) : r))
      }
    }, 500)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [round?.status, round?.startedAt])

  // Check settlement via oracle state
  useEffect(() => {
    if (!round || (round.status !== 'locked' && round.status !== 'settling')) return
    const oracleState = oracleSnapshot.oracleState
    if (!oracleState) return
    if (oracleState.settlement_price !== null && oracleState.settlement_price > 0) {
      const PRICE_SCALE = 1e9
      const rawSettlement = Math.floor(oracleState.settlement_price * PRICE_SCALE)
      setRound((r) => (r ? settleRound(r, rawSettlement) : r))
    }
  }, [oracleSnapshot.oracleState?.settlement_price, round?.status])

  // Save to history on settle
  useEffect(() => {
    if (round?.status === 'settled') {
      setHistory((h) => {
        const updated = [round, ...h.filter((r) => r.id !== round.id)]
        saveHistory(updated)
        return updated
      })
    }
  }, [round?.status])

  const handleStart = useCallback(() => {
    setError(null)
    try {
      const qr = startQuickRound(oracleSnapshot, {
        joinWindowSeconds: 30,
        maxQuantityPerMember: 1,
      })
      setRound(qr)
      setJoinSeconds(qr.config.joinWindowSeconds)
      setExpirySeconds(remainingExpirySeconds(qr))
    } catch (e: any) {
      setError(e.message)
    }
  }, [oracleSnapshot])

  const handleJoin = useCallback(
    async (direction: Direction) => {
      if (!round || !walletAddress || !managerId) return
      setLoading(true)
      setError(null)
      try {
        const { participant } = await joinQuickRound(
          round,
          {
            direction,
            quantity: round.config.maxQuantityPerMember,
            walletAddress,
            managerId,
            memberName,
          },
          { predictGateway, signAndExecute },
        )

        setRound((r) => {
          if (!r) return r
          return { ...r, participants: [...r.participants, participant] }
        })
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [round, walletAddress, managerId, memberName, predictGateway, signAndExecute],
  )

  const handleNextRound = useCallback(() => {
    setRound(null)
    setError(null)
  }, [])

  const handleClaim = useCallback(async () => {
    if (!round || !walletAddress || !managerId) return
    setClaiming(true)
    setError(null)
    try {
      const me = round.participants.find(
        (p) => p.address.toLowerCase() === walletAddress.toLowerCase(),
      )
      if (!me) throw new Error('You did not participate in this round')

      const result = await claimForParticipant(round, me, managerId, {
        predictGateway,
        signAndExecute,
      })

      if (result.error) throw new Error(result.error)

      setRound((r) => {
        if (!r) return r
        return {
          ...r,
          status: 'claimed',
          participants: r.participants.map((p) =>
            p.address.toLowerCase() === walletAddress.toLowerCase()
              ? { ...p, redeemDigest: result.digest }
              : p,
          ),
        }
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setClaiming(false)
    }
  }, [round, walletAddress, managerId, predictGateway, signAndExecute])

  const spotPrice = oracleSnapshot.oracleState?.latest_price?.spot ?? 0
  const STRIKE_SCALE = 1e9
  const joined = round && walletAddress ? hasJoined(round, walletAddress) : false
  const canJoin = !!(
    round &&
    round.status === 'live' &&
    walletAddress &&
    managerId &&
    !joined &&
    !loading &&
    dusdc >= round.config.maxQuantityPerMember
  )

  // ── Render ────────────────────────────────────────────────────────────────

  // No active round → Start UI
  if (!round) {
    return (
      <div className="flex flex-col h-full">
        <Header oracleSnapshot={oracleSnapshot} />
        <div className="flex-1 flex flex-col items-center justify-center gap-md p-lg">
          {!walletAddress ? (
            <div className="text-center">
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant mb-sm">
                account_balance_wallet
              </span>
              <p className="text-on-surface-variant font-label text-label-caps">
                Connect wallet to participate
              </p>
            </div>
          ) : isLeader ? (
            <>
              <span className="material-symbols-outlined text-[32px] text-primary">bolt</span>
              <p className="text-on-surface-variant font-label text-label-caps text-center">
                Start a quick round for your club
              </p>
              <button
                type="button"
                className="bg-primary text-on-primary px-lg py-sm rounded font-label text-label-md cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!oracleSnapshot.isHealthy}
                onClick={handleStart}
              >
                ⚡ Start Quick Round
              </button>
              {!oracleSnapshot.isHealthy && (
                <p className="text-error font-data text-data-sm mt-xs">
                  ⚠ Oracle unavailable — check connection
                </p>
              )}
              {oracleSnapshot.isHealthy && (
                <p className="text-on-surface-variant font-data text-[11px] text-center mt-xs">
                  {oracleSnapshot.oracles.filter((o) => o.status === 'active').length} active
                  oracle(s) • {oracleSnapshot.oracleState?.underlying_asset ?? 'BTC/USD'}
                </p>
              )}
            </>
          ) : (
            <div className="text-center">
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant mb-sm">
                hourglass_empty
              </span>
              <p className="text-on-surface-variant font-label text-label-caps">
                Waiting for leader to start a quick round…
              </p>
            </div>
          )}
          {error && (
            <div className="bg-error/10 border border-error/30 rounded p-sm mt-sm max-w-full">
              <p className="text-error font-data text-data-sm break-words">{error}</p>
            </div>
          )}
        </div>
        <HistorySection history={history} walletAddress={walletAddress} />
      </div>
    )
  }

  // Settled
  if (round.status === 'settled' || round.status === 'claimed') {
    const strikeUsd = round.config.strike / STRIKE_SCALE
    const settlementUsd = (round.settlementPrice ?? 0) / STRIKE_SCALE
    const showClaim = walletAddress && round.status === 'settled' && canClaim(round, walletAddress)
    return (
      <div className="flex flex-col h-full">
        <Header oracleSnapshot={oracleSnapshot} />
        <div className="flex-1 flex flex-col items-center justify-center gap-md p-lg">
          <div className="text-center">
            <span
              className={`font-headline text-headline-lg ${round.result === 'UP' ? 'text-success' : 'text-error'}`}
            >
              {round.result === 'UP' ? '▲ UP Wins' : '▼ DOWN Wins'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-sm text-center">
            <div>
              <span className="font-label text-label-caps text-on-surface-variant">Strike</span>
              <p className="font-data text-data-md">${formatUsd(strikeUsd)}</p>
            </div>
            <div>
              <span className="font-label text-label-caps text-on-surface-variant">Settlement</span>
              <p className="font-data text-data-md">${formatUsd(settlementUsd)}</p>
            </div>
          </div>
          <ParticipantList participants={round.participants} result={round.result} />
          {showClaim && (
            <button
              type="button"
              className="bg-success/20 text-success px-lg py-sm rounded font-label text-label-md cursor-pointer mt-sm disabled:opacity-40"
              disabled={claiming}
              onClick={handleClaim}
            >
              {claiming ? 'Claiming…' : '💰 Claim Winnings'}
            </button>
          )}
          {round.status === 'claimed' &&
            walletAddress &&
            canClaim({ ...round, status: 'settled' }, walletAddress) && (
              <p className="text-success font-data text-data-sm">✓ Claimed successfully</p>
            )}
          {error && <p className="text-error font-data text-data-sm">{error}</p>}
          <button
            type="button"
            className="btn-primary px-lg py-sm rounded font-label text-label-md cursor-pointer mt-md"
            onClick={handleNextRound}
          >
            Next Round →
          </button>
        </div>
      </div>
    )
  }

  // Live / Locked
  const strikeUsd = round.config.strike / STRIKE_SCALE
  return (
    <div className="flex flex-col h-full">
      <Header oracleSnapshot={oracleSnapshot} />
      <div className="flex-1 flex flex-col gap-md p-md">
        {/* Status bar */}
        <div className="flex justify-between items-center">
          <span
            className={`font-label text-label-caps px-sm py-xs rounded ${
              round.status === 'live' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
            }`}
          >
            {round.status === 'live' ? '● LIVE' : '● LOCKED'}
          </span>
          <span className="font-data text-data-md text-on-surface-variant">
            {round.config.underlyingAsset}
          </span>
        </div>

        {/* Price + Strike */}
        <div className="grid grid-cols-3 gap-sm text-center border border-outline-variant rounded p-sm">
          <div>
            <span className="font-label text-[10px] text-on-surface-variant">SPOT</span>
            <p className="font-data text-data-md">${formatUsd(spotPrice)}</p>
          </div>
          <div>
            <span className="font-label text-[10px] text-on-surface-variant">STRIKE</span>
            <p className="font-data text-data-md">${formatUsd(strikeUsd)}</p>
          </div>
          <div>
            <span className="font-label text-[10px] text-on-surface-variant">
              {round.status === 'live' ? 'JOIN CLOSES' : 'EXPIRY'}
            </span>
            <p className="font-data text-data-lg font-bold text-primary">
              {round.status === 'live' ? formatTimer(joinSeconds) : formatTimer(expirySeconds)}
            </p>
          </div>
        </div>

        {/* Price chart sparkline */}
        {oracleSnapshot.prices.length > 1 && (
          <PriceSparkline prices={oracleSnapshot.prices} strike={strikeUsd} />
        )}

        {/* Risk disclosure */}
        <div className="bg-surface-container-highest rounded p-xs flex gap-sm items-center">
          <span className="material-symbols-outlined text-[14px] text-warning">warning</span>
          <span className="font-data text-[11px] text-on-surface-variant">
            Max loss: {round.config.maxQuantityPerMember} DUSDC per position • Oracle-settled
          </span>
        </div>

        {/* UP / DOWN buttons */}
        {round.status === 'live' && (
          <div className="flex gap-md justify-center mt-sm">
            <button
              type="button"
              className="flex-1 py-md rounded font-label text-label-lg cursor-pointer transition-all bg-success/20 text-success hover:bg-success/30 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              disabled={!canJoin || loading}
              onClick={() => handleJoin('UP')}
            >
              ▲ UP
            </button>
            <button
              type="button"
              className="flex-1 py-md rounded font-label text-label-lg cursor-pointer transition-all bg-error/20 text-error hover:bg-error/30 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              disabled={!canJoin || loading}
              onClick={() => handleJoin('DOWN')}
            >
              ▼ DOWN
            </button>
          </div>
        )}

        {/* Contextual messages */}
        {round.status === 'live' && !joined && walletAddress && !managerId && (
          <p className="text-center font-data text-data-sm text-warning">
            ⚠ Create a PredictManager first to join
          </p>
        )}
        {round.status === 'live' &&
          !joined &&
          walletAddress &&
          managerId &&
          dusdc < round.config.maxQuantityPerMember && (
            <p className="text-center font-data text-data-sm text-warning">
              ⚠ Insufficient DUSDC ({dusdc.toFixed(2)} / {round.config.maxQuantityPerMember} needed)
            </p>
          )}

        {joined && !loading && (
          <p className="text-center font-data text-data-sm text-primary">
            ✓ You joined — waiting for settlement
          </p>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-sm">
            <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="font-data text-data-sm text-on-surface-variant">
              Signing transaction…
            </span>
          </div>
        )}

        {error && (
          <div className="bg-error/10 border border-error/30 rounded p-sm max-w-full">
            <p className="text-error font-data text-data-sm break-words">{error}</p>
          </div>
        )}

        {/* Participants */}
        <ParticipantList participants={round.participants} />
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Header({ oracleSnapshot }: { oracleSnapshot: ClubOracleSnapshot }) {
  return (
    <div className="p-md border-b border-outline-variant bg-surface-container-high flex justify-between items-center">
      <div className="flex items-center gap-sm">
        <span className="material-symbols-outlined text-[18px] text-primary">bolt</span>
        <h2 className="font-headline text-headline-md text-primary">Quick Predict</h2>
      </div>
      <div className="flex items-center gap-sm">
        {oracleSnapshot.oracleState?.latest_price && (
          <span className="font-data text-[11px] text-on-surface-variant">
            ${formatUsd(oracleSnapshot.oracleState.latest_price.spot)}
          </span>
        )}
        <span
          className={`w-2 h-2 rounded-full ${oracleSnapshot.isHealthy ? 'bg-success' : 'bg-error'}`}
          title={oracleSnapshot.isHealthy ? 'Oracle healthy' : 'Oracle stale'}
        />
      </div>
    </div>
  )
}

function ParticipantList({
  participants,
  result,
}: {
  participants: QuickRoundParticipant[]
  result?: 'UP' | 'DOWN'
}) {
  if (participants.length === 0) {
    return (
      <p className="text-center font-data text-data-sm text-on-surface-variant">
        No participants yet
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-xs mt-sm">
      <span className="font-label text-label-caps text-on-surface-variant">
        Participants ({participants.length})
      </span>
      {participants.map((p) => {
        const won = result ? p.direction === result : undefined
        return (
          <div
            key={p.address}
            className="flex items-center justify-between px-sm py-xs border-b border-outline-variant/30"
          >
            <div className="flex items-center gap-sm">
              <span
                className={`font-data text-data-sm ${p.direction === 'UP' ? 'text-success' : 'text-error'}`}
              >
                {p.direction === 'UP' ? '▲' : '▼'}
              </span>
              <span className="font-data text-data-sm">{p.name || truncateAddress(p.address)}</span>
            </div>
            <div className="flex items-center gap-sm">
              <span className="font-data text-[11px] text-on-surface-variant">
                {p.quantity} DUSDC
              </span>
              {won !== undefined && (
                <span className={`font-data text-data-sm ${won ? 'text-success' : 'text-error'}`}>
                  {won ? '✓ Won' : '✗ Lost'}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HistorySection({
  history,
  walletAddress,
}: {
  history: QuickRound[]
  walletAddress: string | null
}) {
  if (history.length === 0) return null
  const STRIKE_SCALE = 1e9

  // Compute personal stats
  const stats = walletAddress ? computeStats(history, walletAddress) : null

  return (
    <div className="border-t border-outline-variant p-md">
      {stats && (
        <div className="flex justify-between items-center mb-sm">
          <span className="font-label text-label-caps text-on-surface-variant">Your Stats</span>
          <div className="flex gap-md">
            <StatBadge label="W" value={stats.wins} tone="success" />
            <StatBadge label="L" value={stats.losses} tone="error" />
            <StatBadge
              label="Streak"
              value={stats.streak > 0 ? `${stats.streak}🔥` : '0'}
              tone={stats.streak > 0 ? 'success' : 'muted'}
            />
            <StatBadge
              label="PnL"
              value={`${stats.netPnl >= 0 ? '+' : ''}${stats.netPnl.toFixed(2)}`}
              tone={stats.netPnl >= 0 ? 'success' : 'error'}
            />
          </div>
        </div>
      )}
      <span className="font-label text-label-caps text-on-surface-variant">
        Recent Rounds ({history.length})
      </span>
      <div className="flex flex-col gap-xs mt-sm max-h-[200px] overflow-y-auto">
        {history.slice(0, 10).map((r) => {
          const myParticipation = walletAddress
            ? r.participants.find((p) => p.address.toLowerCase() === walletAddress.toLowerCase())
            : null
          const won = myParticipation && r.result ? myParticipation.direction === r.result : null
          return (
            <div
              key={r.id}
              className="flex justify-between items-center px-sm py-xs border-b border-outline-variant/20"
            >
              <div className="flex items-center gap-sm">
                <span
                  className={`font-data text-data-sm ${r.result === 'UP' ? 'text-success' : 'text-error'}`}
                >
                  {r.result === 'UP' ? '▲' : '▼'}
                </span>
                <span className="font-data text-data-sm text-on-surface-variant">
                  {r.config.underlyingAsset} ${formatUsd(r.config.strike / STRIKE_SCALE)}
                </span>
              </div>
              <div className="flex items-center gap-sm">
                <span className="font-data text-[11px] text-on-surface-variant">
                  {r.participants.length}p
                </span>
                {won !== null && (
                  <span
                    className={`font-data text-[11px] font-bold ${won ? 'text-success' : 'text-error'}`}
                  >
                    {won ? 'W' : 'L'}
                  </span>
                )}
                {!myParticipation && (
                  <span className="font-data text-[11px] text-on-surface-variant">—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatBadge({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone: string
}) {
  const colors: Record<string, string> = {
    success: 'text-success',
    error: 'text-error',
    muted: 'text-on-surface-variant',
  }
  return (
    <div className="flex flex-col items-center">
      <span className={`font-data text-data-sm font-bold ${colors[tone] ?? colors.muted}`}>
        {value}
      </span>
      <span className="font-label text-[9px] text-on-surface-variant uppercase">{label}</span>
    </div>
  )
}

interface PlayerStats {
  wins: number
  losses: number
  streak: number
  netPnl: number
}

function computeStats(history: QuickRound[], address: string): PlayerStats {
  let wins = 0
  let losses = 0
  let streak = 0
  let counting = true
  for (const r of history) {
    const p = r.participants.find((x) => x.address.toLowerCase() === address.toLowerCase())
    if (!p || !r.result) continue
    const won = p.direction === r.result
    if (won) {
      wins++
      if (counting) streak++
    } else {
      losses++
      if (counting) counting = false
    }
  }

  // Approximate PnL: +quantity for wins, -quantity for losses
  let pnl = 0
  for (const r of history) {
    const p = r.participants.find((x) => x.address.toLowerCase() === address.toLowerCase())
    if (!p || !r.result) continue
    pnl += p.direction === r.result ? p.quantity * 0.8 : -p.quantity
  }

  return { wins, losses, streak, netPnl: pnl }
}

function PriceSparkline({ prices, strike }: { prices: { spot: number }[]; strike: number }) {
  const recent = prices.slice(-30)
  if (recent.length < 2) return null

  const spots = recent.map((p) => p.spot)
  const min = Math.min(...spots, strike)
  const max = Math.max(...spots, strike)
  const range = max - min || 1

  const w = 200
  const h = 40
  const points = spots
    .map((s, i) => {
      const x = (i / (spots.length - 1)) * w
      const y = h - ((s - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')

  const strikeY = h - ((strike - min) / range) * h
  const lastPrice = spots[spots.length - 1]
  const up = lastPrice >= strike

  return (
    <div className="flex justify-center">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full max-w-[200px] h-[40px]"
        preserveAspectRatio="none"
      >
        {/* Strike line */}
        <line
          x1="0"
          y1={strikeY}
          x2={w}
          y2={strikeY}
          stroke="currentColor"
          strokeDasharray="3,3"
          opacity="0.3"
        />
        {/* Price line */}
        <polyline
          points={points}
          fill="none"
          stroke={up ? '#4ade80' : '#f87171'}
          strokeWidth="1.5"
        />
      </svg>
    </div>
  )
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

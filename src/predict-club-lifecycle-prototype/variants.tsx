// PROTOTYPE — throwaway. 3 structurally different lifecycle UIs.
// VariantA: horizontal stepper + relative countdown banner
// VariantB: vertical timeline (chat-like progress feed)
// VariantC: single focused "status card" with big circular countdown
import {
  PHASES,
  PHASE_LABEL,
  PHASE_HINT,
  phaseSecondsLeft,
  phaseProgress,
  secondsToClaim,
  formatTimer,
  type RoundMock,
  type Phase,
} from './mock'

const MINT = '#00e0b3'
const INK = '#0c1512'
const PANEL = '#151d1a'
const LINE = '#3a4a44'
const TEXT = '#dbe5df'
const MUTED = '#83958d'
const RED = '#ffb4ab'

function phaseIndex(p: Phase) {
  return PHASES.indexOf(p)
}

function ClaimCta({ round }: { round: RoundMock }) {
  if (round.phase !== 'claim') return null
  if (round.result === 'lost') {
    return (
      <div style={{ color: RED, fontWeight: 700, fontSize: 14 }}>
        ✗ Round lost — settled {round.spot.toLocaleString()} vs strike{' '}
        {round.strike.toLocaleString()}
      </div>
    )
  }
  return (
    <button
      type="button"
      style={{
        background: `linear-gradient(135deg, ${MINT}, #28d8c1)`,
        color: INK,
        border: 'none',
        borderRadius: 10,
        padding: '12px 18px',
        fontSize: 15,
        fontWeight: 750,
        cursor: 'pointer',
      }}
    >
      💰 Claim {round.payoutDusdc.toLocaleString()} DUSDC
    </button>
  )
}

// ─── Variant A — horizontal stepper + countdown banner ──────────────────────
export function VariantA({ round }: { round: RoundMock }) {
  const idx = phaseIndex(round.phase)
  const left = phaseSecondsLeft(round)
  const claimable = round.phase === 'claim'
  const countdownLabel = claimable
    ? round.result === 'won'
      ? 'Ready to claim'
      : 'Round closed'
    : round.phase === 'live'
      ? `Settles in ${formatTimer(left)}`
      : round.phase === 'fund'
        ? `Funding closes in ${formatTimer(left)}`
        : `Next step in ${formatTimer(left)}`

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 24, color: TEXT }}>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>{round.market}</div>
      <div style={{ fontSize: 20, fontWeight: 750, marginBottom: 20 }}>
        {round.direction} · strike ${round.strike.toLocaleString()}
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        {PHASES.map((p, i) => {
          const done = i < idx
          const current = i === idx
          return (
            <div
              key={p}
              style={{ display: 'flex', alignItems: 'center', flex: i < PHASES.length - 1 ? 1 : 0 }}
            >
              <div
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    background: done ? MINT : current ? 'rgba(0,224,179,0.15)' : PANEL,
                    color: done ? INK : current ? MINT : MUTED,
                    border: `2px solid ${done || current ? MINT : LINE}`,
                    boxShadow: current ? `0 0 12px ${MINT}66` : 'none',
                  }}
                >
                  {done ? '✓' : i + 1}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: current ? TEXT : MUTED,
                    fontWeight: current ? 700 : 400,
                  }}
                >
                  {PHASE_LABEL[p]}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    margin: '0 4px',
                    marginBottom: 16,
                    background: done ? MINT : LINE,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Countdown banner */}
      <div
        style={{
          background: PANEL,
          border: `1px solid ${claimable && round.result === 'won' ? MINT : LINE}`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {PHASE_LABEL[round.phase]}
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 750,
            color: claimable ? MINT : TEXT,
            fontFamily: 'monospace',
          }}
        >
          {countdownLabel}
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{PHASE_HINT[round.phase]}</div>
        {!claimable && (
          <div
            style={{
              height: 4,
              background: LINE,
              borderRadius: 2,
              marginTop: 10,
              overflow: 'hidden',
            }}
          >
            <div
              style={{ height: '100%', width: `${phaseProgress(round) * 100}%`, background: MINT }}
            />
          </div>
        )}
        {!claimable && (
          <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
            ~{formatTimer(secondsToClaim(round))} until claimable
          </div>
        )}
      </div>

      <ClaimCta round={round} />
    </div>
  )
}

// ─── Variant B — vertical timeline feed ─────────────────────────────────────
export function VariantB({ round }: { round: RoundMock }) {
  const idx = phaseIndex(round.phase)
  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: 24, color: TEXT }}>
      <div style={{ fontSize: 20, fontWeight: 750, marginBottom: 2 }}>{round.market}</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>
        {round.direction} · strike ${round.strike.toLocaleString()} · stake {round.stakeDusdc} DUSDC
      </div>

      <div style={{ position: 'relative', paddingLeft: 28 }}>
        {/* vertical rail */}
        <div
          style={{ position: 'absolute', left: 13, top: 8, bottom: 8, width: 2, background: LINE }}
        />
        {PHASES.map((p, i) => {
          const done = i < idx
          const current = i === idx
          const left = phaseSecondsLeft(round)
          return (
            <div key={p} style={{ position: 'relative', marginBottom: 18, minHeight: 28 }}>
              <div
                style={{
                  position: 'absolute',
                  left: -28 + 4,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: done ? MINT : current ? INK : PANEL,
                  border: `2px solid ${done || current ? MINT : LINE}`,
                  boxShadow: current ? `0 0 10px ${MINT}88` : 'none',
                }}
              />
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: current ? 750 : 500,
                    color: done || current ? TEXT : MUTED,
                  }}
                >
                  {PHASE_LABEL[p]}
                </span>
                {current && p !== 'claim' && (
                  <span style={{ fontSize: 13, fontFamily: 'monospace', color: MINT }}>
                    {formatTimer(left)}
                  </span>
                )}
                {done && <span style={{ fontSize: 11, color: MINT }}>done</span>}
              </div>
              {current && (
                <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{PHASE_HINT[p]}</div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 8 }}>
        <ClaimCta round={round} />
      </div>
    </div>
  )
}

// ─── Variant C — focused status card w/ circular countdown ──────────────────
export function VariantC({ round }: { round: RoundMock }) {
  const claimable = round.phase === 'claim'
  const pct = claimable ? 1 : phaseProgress(round)
  const left = phaseSecondsLeft(round)
  const R = 54
  const C = 2 * Math.PI * R
  const ringColor = claimable ? (round.result === 'won' ? MINT : RED) : MINT

  return (
    <div style={{ maxWidth: 380, margin: '0 auto', padding: 24, color: TEXT, textAlign: 'center' }}>
      <div
        style={{
          fontSize: 12,
          color: MUTED,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        {PHASE_LABEL[round.phase]}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
        {round.market} · {round.direction}
      </div>

      <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 16px' }}>
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="70" cy="70" r={R} fill="none" stroke={LINE} strokeWidth="8" />
          <circle
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {claimable ? (
            <span style={{ fontSize: 22 }}>{round.result === 'won' ? '🎉' : '✗'}</span>
          ) : (
            <>
              <span style={{ fontSize: 24, fontWeight: 750, fontFamily: 'monospace', color: TEXT }}>
                {formatTimer(left)}
              </span>
              <span style={{ fontSize: 10, color: MUTED }}>this step</span>
            </>
          )}
        </div>
      </div>

      <div style={{ fontSize: 13, color: MUTED, marginBottom: 6 }}>{PHASE_HINT[round.phase]}</div>
      {!claimable && (
        <div style={{ fontSize: 12, color: TEXT, marginBottom: 18 }}>
          Claim opens in{' '}
          <strong style={{ color: MINT }}>{formatTimer(secondsToClaim(round))}</strong>
        </div>
      )}

      <ClaimCta round={round} />
    </div>
  )
}

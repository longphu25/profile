// BTC Chart — Kathy Lien Reversal Panel.

import { useState } from 'react'
import { fmtP, type LienResult } from '../lib'
import {
  SideBlock,
  SideHead,
  SideBody,
  StatGrid,
  StatCell,
  SideBadge,
  SideNote,
  SideEmpty,
  SideRow,
} from './sidebar'

interface Props {
  lien: LienResult
  enabled: boolean
  onToggle: () => void
}

const ZONE_LABEL: Record<string, string> = {
  buy: 'Buy Zone',
  sell: 'Sell Zone',
  neutral: 'Neutral',
}

const REGIME_LABEL: Record<string, string> = {
  trending_up: 'Trend Up',
  trending_down: 'Trend Down',
  range: 'Range',
}

export function ReversalPanel({ lien, enabled, onToggle }: Props) {
  const [open, setOpen] = useState(false)
  const hasData = !!lien.dbb
  const sig = lien.latestSignal
  const zoneTone = lien.zone === 'buy' ? 'up' : lien.zone === 'sell' ? 'dn' : ''

  return (
    <SideBlock variant="strategy" className={!enabled ? 'is-disabled' : ''}>
      <SideHead
        title="Reversal"
        subtitle="Lien DBB method"
        collapsible
        open={open}
        onToggle={() => setOpen((o) => !o)}
        badges={
          !open && hasData && enabled ? (
            <>
              <SideBadge tone={zoneTone || 'muted'}>{ZONE_LABEL[lien.zone]}</SideBadge>
              {lien.squeeze.active && <SideBadge tone="hi">SQZ</SideBadge>}
            </>
          ) : undefined
        }
        summary={
          !open && sig && enabled
            ? `${sig.type === 'bullish' ? '▲' : '▼'} ${sig.confidence}%`
            : undefined
        }
        actions={
          <button
            type="button"
            className={`btc-chart__collapse-toggle${enabled ? ' is-on' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            {enabled ? 'ON' : 'OFF'}
          </button>
        }
      />

      {open && enabled && hasData && (
        <SideBody>
          <StatGrid cols={2}>
            <StatCell label="Zone" value={ZONE_LABEL[lien.zone]} tone={zoneTone} />
            <StatCell
              label="Regime"
              value={REGIME_LABEL[lien.regime]}
              tone={lien.regime.includes('up') ? 'up' : lien.regime.includes('down') ? 'dn' : ''}
            />
          </StatGrid>

          <div className="sb-kv-list">
            <SideRow label="+2SD" value={fmtP(lien.dbb!.upper2)} tone="dn" />
            <SideRow label="+1SD" value={fmtP(lien.dbb!.upper1)} />
            <SideRow label="SMA" value={fmtP(lien.dbb!.sma)} tone="neu" />
            <SideRow label="-1SD" value={fmtP(lien.dbb!.lower1)} />
            <SideRow label="-2SD" value={fmtP(lien.dbb!.lower2)} tone="up" />
          </div>

          {lien.squeeze.active && (
            <SideNote>
              <span className="hi">Squeeze active</span> ({lien.squeeze.bars} bars)
              {lien.squeeze.breakout
                ? ` · Breakout ${lien.squeeze.breakout === 'up' ? '▲' : '▼'}`
                : ''}
            </SideNote>
          )}

          {sig && (
            <div className="sb-calc-box">
              <SideBadge tone={sig.type === 'bullish' ? 'up' : 'dn'}>
                {sig.type === 'bullish' ? 'BULL REV ▲' : 'BEAR REV ▼'}
              </SideBadge>
              <SideRow label="Entry" value={fmtP(sig.price)} />
              <div className="sb-chip-row">
                {sig.reasons.map((r) => (
                  <span key={r} className="sb-chip">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          <StatGrid cols={2}>
            <StatCell
              label="ADR spent"
              value={`${Math.round(lien.adrSpent)}%`}
              tone={lien.adrSpent > 80 ? 'dn' : ''}
            />
            <StatCell label="Bandwidth" value={`${lien.dbb!.bandwidth.toFixed(2)}%`} />
          </StatGrid>
        </SideBody>
      )}

      {open && !hasData && enabled && <SideEmpty>Cần ít nhất 20 nến</SideEmpty>}
    </SideBlock>
  )
}

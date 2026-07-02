// BTC Chart — Boucher M1 Scalping Panel.

import { useState } from 'react'
import { fmtP, type BoucherResult } from '../lib'
import {
  SideBlock,
  SideHead,
  SideBody,
  StatGrid,
  StatCell,
  SideBadge,
  SideNote,
  SideEmpty,
} from './sidebar'

interface Props {
  scalp: BoucherResult
  interval: string
  enabled: boolean
  onToggle: () => void
}

export function ScalpingPanel({ scalp, interval, enabled, onToggle }: Props) {
  const [open, setOpen] = useState(false)
  const lastEntry = scalp.entries[scalp.entries.length - 1]
  const hasData = scalp.atr > 0 && scalp.boxSize > 0

  return (
    <SideBlock variant="strategy" className={!enabled ? 'is-disabled' : ''}>
      <SideHead
        title="Scalping M1"
        subtitle="Boucher method"
        collapsible
        open={open}
        onToggle={() => setOpen((o) => !o)}
        badges={
          !open && hasData && enabled ? (
            <>
              <SideBadge
                tone={scalp.speed === 'fast' ? 'up' : scalp.speed === 'slow' ? 'dn' : 'muted'}
              >
                {scalp.speed === 'fast' ? 'FAST' : scalp.speed === 'slow' ? 'SLOW' : 'OK'}
              </SideBadge>
              {lastEntry && (
                <SideBadge tone={lastEntry.dir === 'long' ? 'up' : 'dn'}>
                  {lastEntry.dir === 'long' ? 'BUY' : 'SELL'}
                </SideBadge>
              )}
            </>
          ) : undefined
        }
        summary={
          !open && hasData && enabled ? `WR ${Math.round(scalp.stats.rr * 100)}%` : undefined
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
          {interval !== '1m' && (
            <SideNote>
              <span className="dn">Khuyến nghị dùng khung 1m</span>
            </SideNote>
          )}

          <StatGrid cols={2}>
            <StatCell label="Box" value={fmtP(scalp.boxSize)} />
            <StatCell label="ATR" value={fmtP(scalp.atr)} />
            <StatCell label="Envelope" value={fmtP(scalp.envelope)} tone="dn" />
            <StatCell label="Target" value={fmtP(scalp.target)} tone="up" />
          </StatGrid>

          <StatGrid cols={3}>
            <StatCell
              label="Speed"
              value={scalp.speed === 'fast' ? 'Fast' : scalp.speed === 'slow' ? 'Slow' : 'Normal'}
              tone={scalp.speed === 'fast' ? 'up' : scalp.speed === 'slow' ? 'dn' : ''}
            />
            <StatCell label="3-Bar" value={String(scalp.threeBar.length)} />
            <StatCell
              label="Win rate"
              value={`${Math.round(scalp.stats.rr * 100)}%`}
              tone={scalp.stats.rr >= 0.6 ? 'up' : scalp.stats.rr < 0.4 ? 'dn' : ''}
            />
          </StatGrid>

          {scalp.currentBox && (
            <SideNote>
              Active box {fmtP(scalp.currentBox.low)} – {fmtP(scalp.currentBox.high)} (
              {scalp.currentBox.bars} bars)
            </SideNote>
          )}

          {lastEntry && (
            <div
              className={`sb-calc-box ${lastEntry.dir === 'long' ? 'sb-block--long' : 'sb-block--short'}`}
            >
              <SideBadge tone={lastEntry.dir === 'long' ? 'up' : 'dn'}>
                {lastEntry.dir === 'long' ? 'BUY ▲' : 'SELL ▼'}
              </SideBadge>
              <span className="sb-row__value"> @ {fmtP(lastEntry.price)}</span>
              {lastEntry.confirmed && <SideBadge tone="mint">3-Bar</SideBadge>}
            </div>
          )}
        </SideBody>
      )}

      {open && !hasData && enabled && <SideEmpty>Chưa đủ dữ liệu</SideEmpty>}
    </SideBlock>
  )
}

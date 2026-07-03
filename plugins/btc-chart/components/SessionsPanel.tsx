// BTC Chart — ICT Sessions panel: active session, Asian range, killzone, Judas.

import { useState } from 'react'
import React from 'react'
import { fmtP } from '../lib/format'
import type { ICTResult } from '../lib/ict-sessions'
import {
  SideBlock,
  SideHead,
  SideBody,
  SideRow,
  StatGrid,
  StatCell,
  SideBadge,
  SideMeter,
  SideNote,
  SideEmpty,
} from './sidebar/SidebarBlocks'

interface Props {
  ict: ICTResult
  enabled: boolean
  onToggle: () => void
}

const SESSION_LABEL: Record<string, string> = {
  asia: 'Asia',
  london: 'London',
  ny: 'New York',
}

function OnOffToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
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
  )
}

export const SessionsPanel = React.memo(function SessionsPanel({ ict, enabled, onToggle }: Props) {
  const [open, setOpen] = useState(false)

  const activeKz = ict.killzones.find((k) => k.active)
  const lastJudas = ict.judas[ict.judas.length - 1]
  const asiaToday = [...ict.sessions].reverse().find((s) => s.name === 'asia')
  const hasData = ict.sessions.length > 0

  if (!hasData) {
    return (
      <SideBlock variant="context" className={!enabled ? 'is-disabled' : ''}>
        <SideHead
          title="ICT Sessions"
          subtitle="Intraday only"
          collapsible
          open={open}
          onToggle={() => setOpen((o) => !o)}
          actions={<OnOffToggle enabled={enabled} onToggle={onToggle} />}
        />
        {open && enabled && <SideEmpty>Chỉ khả dụng ở khung 1m đến 1h</SideEmpty>}
      </SideBlock>
    )
  }

  const sessionShort = ict.activeSession ? SESSION_LABEL[ict.activeSession] : '—'
  const adrTone = ict.adrPct > 85 ? 'dn' : ict.adrPct > 60 ? 'hi' : 'up'

  return (
    <SideBlock variant="context" className={!enabled ? 'is-disabled' : ''}>
      <SideHead
        title="ICT Sessions"
        subtitle="Daily range decode"
        collapsible
        open={open}
        onToggle={() => setOpen((o) => !o)}
        badges={
          !open && enabled ? (
            <>
              {activeKz && <SideBadge tone="mint">KZ</SideBadge>}
              {lastJudas && (
                <SideBadge tone={lastJudas.type === 'bullish' ? 'up' : 'dn'}>
                  {lastJudas.type === 'bullish' ? 'JUDAS ▲' : 'JUDAS ▼'}
                </SideBadge>
              )}
            </>
          ) : undefined
        }
        summary={
          !open && enabled ? (
            <>
              <span className={activeKz ? 'mint' : ''}>{sessionShort}</span>
              <span>ADR {ict.adrPct.toFixed(0)}%</span>
            </>
          ) : undefined
        }
        actions={<OnOffToggle enabled={enabled} onToggle={onToggle} />}
      />

      {open && enabled && (
        <SideBody>
          <SideRow
            label="Phiên hiện tại"
            value={ict.activeSession ? SESSION_LABEL[ict.activeSession] : '—'}
            tone={ict.activeSession ? 'neu' : ''}
          />
          <SideRow
            label="Killzone"
            value={activeKz ? `${activeKz.name === 'london' ? 'London' : 'NY'} active` : 'Outside'}
            tone={activeKz ? 'mint' : ''}
          />

          {asiaToday && (
            <>
              <div className="sb-divider" />
              <StatGrid cols={2}>
                <StatCell label="Asia High" value={fmtP(asiaToday.high)} tone="up" />
                <StatCell label="Asia Low" value={fmtP(asiaToday.low)} tone="dn" />
              </StatGrid>
            </>
          )}

          <div>
            <SideRow label="ADR spent" value={`${ict.adrPct.toFixed(0)}%`} tone={adrTone} />
            <SideMeter
              value={ict.adrPct}
              tone={ict.adrPct > 85 ? 'dn' : ict.adrPct > 60 ? 'hi' : 'up'}
            />
          </div>

          <div className="sb-divider" />
          {lastJudas ? (
            <SideNote>
              <span className={lastJudas.type === 'bullish' ? 'up' : 'dn'}>
                Judas {lastJudas.type === 'bullish' ? '▲' : '▼'}
              </span>{' '}
              sweep {lastJudas.sweptSide} @ {fmtP(lastJudas.sweptLevel)} · {lastJudas.confidence}%
            </SideNote>
          ) : (
            <SideNote>Chưa có Judas swing trong cửa sổ hiện tại</SideNote>
          )}
        </SideBody>
      )}
    </SideBlock>
  )
})

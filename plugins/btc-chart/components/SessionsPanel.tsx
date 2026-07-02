// BTC Chart — ICT Sessions panel: active session, Asian range, killzone, Judas.

import { useState } from 'react'
import React from 'react'
import { fmtP, type ICTResult } from '../lib'
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
} from './sidebar'

interface Props {
  ict: ICTResult
}

const SESSION_LABEL: Record<string, string> = {
  asia: 'Asia',
  london: 'London',
  ny: 'New York',
}

export const SessionsPanel = React.memo(function SessionsPanel({ ict }: Props) {
  const [open, setOpen] = useState(false)

  const activeKz = ict.killzones.find((k) => k.active)
  const lastJudas = ict.judas[ict.judas.length - 1]
  const asiaToday = [...ict.sessions].reverse().find((s) => s.name === 'asia')

  if (!ict.sessions.length) {
    return (
      <SideBlock variant="context">
        <SideHead title="ICT Sessions" subtitle="Intraday only" />
        <SideEmpty>Chỉ khả dụng ở khung 1m đến 1h</SideEmpty>
      </SideBlock>
    )
  }

  const sessionShort = ict.activeSession ? SESSION_LABEL[ict.activeSession] : '—'
  const adrTone = ict.adrPct > 85 ? 'dn' : ict.adrPct > 60 ? 'hi' : 'up'

  return (
    <SideBlock variant="context">
      <SideHead
        title="ICT Sessions"
        subtitle="Daily range decode"
        collapsible
        open={open}
        onToggle={() => setOpen((o) => !o)}
        badges={
          <>
            {activeKz && <SideBadge tone="mint">KZ</SideBadge>}
            {lastJudas && (
              <SideBadge tone={lastJudas.type === 'bullish' ? 'up' : 'dn'}>
                {lastJudas.type === 'bullish' ? 'JUDAS ▲' : 'JUDAS ▼'}
              </SideBadge>
            )}
          </>
        }
        summary={
          <>
            <span className={activeKz ? 'mint' : ''}>{sessionShort}</span>
            <span>ADR {ict.adrPct.toFixed(0)}%</span>
          </>
        }
      />

      {open && (
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

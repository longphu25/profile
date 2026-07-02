// BTC Chart — market-data readouts: 24h stats, Fear & Greed.

import type { StatsState, FngState } from '../lib'
import { SideBlock, SideBody, SideHero, SideRow, SideMeter, SideNote } from './sidebar'

export function StatsPanel({ stats }: { stats: StatsState }) {
  return (
    <SideBlock variant="data">
      <SideBody>
        <div className="sb-head__title" style={{ marginBottom: 8 }}>
          24h Stats
        </div>
        <div className="sb-kv-list">
          <SideRow label="High" value={stats.high} />
          <SideRow label="Low" value={stats.low} />
          <SideRow label="Volume" value={stats.vol} />
          <SideRow label="Change" value={stats.chg} tone={stats.up ? 'up' : 'dn'} />
        </div>
      </SideBody>
    </SideBlock>
  )
}

export function FearGreedPanel({ fng }: { fng: FngState }) {
  return (
    <SideBlock variant="market">
      <SideHero kicker="Fear & Greed" title={fng.label} value={String(fng.val)} color={fng.color} />
      <SideBody className="!pt-0">
        <SideMeter value={fng.pct} tone={fng.pct > 60 ? 'hi' : fng.pct < 40 ? 'dn' : 'mint'} />
        <SideNote>
          Chỉ số sentiment thị trường crypto (0 = extreme fear, 100 = extreme greed)
        </SideNote>
      </SideBody>
    </SideBlock>
  )
}

// BTC Chart — indicator readout panels driven by the sidebar snapshot.

import type { SidebarState } from '../lib/types'
import {
  SideBlock,
  SideBody,
  SideNote,
  SideEmpty,
  StatGrid,
  StatCell,
  SideBadge,
} from './sidebar/SidebarBlocks'

export function OrderFlowPanel({ ofLog }: { ofLog: SidebarState['ofLog'] }) {
  return (
    <SideBlock variant="data">
      <SideBody>
        <div className="sb-head__title" style={{ marginBottom: 8 }}>
          Order Flow
        </div>
        {ofLog.length === 0 ? (
          <SideEmpty>Chưa có tín hiệu rebound</SideEmpty>
        ) : (
          <div className="sb-kv-list">
            {ofLog.map((s) => (
              <div
                key={`${s.type}-${s.price}-${s.time}`}
                className="sb-row"
                style={{ alignItems: 'center' }}
              >
                <SideBadge tone={s.type === 'buy' ? 'up' : 'dn'}>
                  {s.type === 'buy' ? 'BUY' : 'SELL'}
                </SideBadge>
                <span className="sb-row__value" style={{ flex: 1, textAlign: 'center' }}>
                  ${s.price} · ×{s.ratio}
                </span>
                <span className="sb-row__label">{s.time}</span>
              </div>
            ))}
          </div>
        )}
        <SideNote>
          SELL: nến chọc Upper rồi đảo giảm. BUY: nến chọc Lower rồi đảo tăng. ×N = volume vs SMA20.
        </SideNote>
      </SideBody>
    </SideBlock>
  )
}

export function BoxFlipPanel({ boxFlip }: { boxFlip: SidebarState['boxFlip'] }) {
  return (
    <SideBlock variant="data">
      <SideBody>
        <div className="sb-head__title" style={{ marginBottom: 8 }}>
          Box Flip
        </div>
        <StatGrid cols={2}>
          <StatCell label="Signals" value={String(boxFlip.count)} />
          <StatCell
            label="Last flip"
            value={boxFlip.last ?? '—'}
            tone={boxFlip.last === 'B' ? 'up' : boxFlip.last === 'S' ? 'dn' : ''}
          />
        </StatGrid>
        <SideNote>B / S in prints on box breakout direction flip.</SideNote>
      </SideBody>
    </SideBlock>
  )
}

export function MHBandPanel({ sidebar }: { sidebar: SidebarState }) {
  return (
    <SideBlock variant="data">
      <SideBody>
        <div className="sb-head__title" style={{ marginBottom: 8 }}>
          MH Band
        </div>
        <StatGrid cols={2}>
          <StatCell label="Upper" value={sidebar.nweUpper} tone="dn" />
          <StatCell label="Mid" value={sidebar.nweMid} tone="neu" />
          <StatCell label="Lower" value={sidebar.nweLower} tone="up" />
          <StatCell label="Zone" value={sidebar.nweZone.text} tone="" />
        </StatGrid>
      </SideBody>
    </SideBlock>
  )
}

export function VolumeProfilePanel({ vp, vpHvn }: { vp: SidebarState['vp']; vpHvn: number }) {
  return (
    <SideBlock variant="data">
      <SideBody>
        <div className="sb-head__title" style={{ marginBottom: 8 }}>
          Volume Profile
        </div>
        <StatGrid cols={2}>
          <StatCell label="POC" value={vp.poc} tone="hi" />
          <StatCell label="vs POC" value={vp.pos} />
          <StatCell label="VAH 70%" value={vp.vah} tone="dn" />
          <StatCell label="VAL 70%" value={vp.val} tone="up" />
          <StatCell label="HVN nodes" value={String(vpHvn)} tone="hi" />
        </StatGrid>
      </SideBody>
    </SideBlock>
  )
}

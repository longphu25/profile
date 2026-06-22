// BTC Chart — indicator readout panels driven by the sidebar snapshot.

import type { SidebarState } from '../lib'

export function OrderFlowPanel({ ofLog }: { ofLog: SidebarState['ofLog'] }) {
  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-title">Midnight Hunter signals</div>
      {ofLog.length === 0 ? (
        <span className="btc-chart__of-empty">Chưa có tín hiệu rebound</span>
      ) : (
        ofLog.map((s, idx) => (
          <div key={idx} className="btc-chart__of-item">
            <span className={`btc-chart__of-tag ${s.type === 'buy' ? 'is-buy' : 'is-sell'}`}>
              {s.type === 'buy' ? 'BUY' : 'SELL'}
            </span>
            <span className="btc-chart__of-text">
              ${s.price} · ×{s.ratio}
            </span>
            <span className="btc-chart__of-time">{s.time}</span>
          </div>
        ))
      )}
      <div className="btc-chart__of-note">
        <div>
          <b className="dn">SELL ▼</b> — nến trước chọc lên trên dải trên (Upper Band) rồi nến hiện
          tại đảo chiều giảm.
        </div>
        <div>
          <b className="up">BUY ▲</b> — nến trước chọc xuống dưới dải dưới (Lower Band) rồi nến hiện
          tại đảo chiều tăng.
        </div>
        <div className="btc-chart__of-note-sub">
          ×N = bội số volume so với SMA20 (tham khảo, không phải điều kiện tín hiệu).
        </div>
      </div>
    </div>
  )
}

export function BoxFlipPanel({ boxFlip }: { boxFlip: SidebarState['boxFlip'] }) {
  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-title">Box breakout flip</div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">Signals</span>
        <span className="btc-chart__row-val">{boxFlip.count}</span>
      </div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">Last flip</span>
        <span
          className={`btc-chart__row-val ${
            boxFlip.last === 'B' ? 'up' : boxFlip.last === 'S' ? 'dn' : ''
          }`}
        >
          {boxFlip.last ?? '—'}
        </span>
      </div>
      <div className="btc-chart__of-note">
        <div>
          <b className="up">B</b> / <b className="dn">S</b> only prints when box breakout direction
          flips.
        </div>
      </div>
    </div>
  )
}

export function MHBandPanel({ sidebar }: { sidebar: SidebarState }) {
  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-title">Midnight Hunter Band</div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">Upper</span>
        <span className="btc-chart__row-val dn">{sidebar.nweUpper}</span>
      </div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">Mid</span>
        <span className="btc-chart__row-val neu">{sidebar.nweMid}</span>
      </div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">Lower</span>
        <span className="btc-chart__row-val up">{sidebar.nweLower}</span>
      </div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">Zone</span>
        <span className={`btc-chart__row-val ${sidebar.nweZone.cls}`}>{sidebar.nweZone.text}</span>
      </div>
    </div>
  )
}

export function VolumeProfilePanel({ vp, vpHvn }: { vp: SidebarState['vp']; vpHvn: number }) {
  return (
    <div className="btc-chart__panel">
      <div className="btc-chart__panel-title">Volume profile</div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">POC</span>
        <span className="btc-chart__row-val" style={{ color: 'var(--hi)' }}>
          {vp.poc}
        </span>
      </div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">VAH · 70%</span>
        <span className="btc-chart__row-val dn">{vp.vah}</span>
      </div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">VAL · 70%</span>
        <span className="btc-chart__row-val up">{vp.val}</span>
      </div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">vs POC</span>
        <span className="btc-chart__row-val">{vp.pos}</span>
      </div>
      <div className="btc-chart__row">
        <span className="btc-chart__row-label">HVN nodes</span>
        <span className="btc-chart__row-val" style={{ color: 'var(--hi)' }}>
          {vpHvn}
        </span>
      </div>
    </div>
  )
}

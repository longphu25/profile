// BTC Chart — "Vì sao có Trade Setup này?" explanation modal. Explains the
// current setup's confluence (each reason in plain language, split bull/bear),
// the confidence math, and provides a reference for every indicator.
//
// Rendered inline (not via portal) because the plugin lives in a Shadow DOM —
// a portal to document.body would escape the scoped stylesheet.

import { fmtP } from '../lib/format'
import { explainReason, INDICATOR_DOCS, type ReasonSide } from '../lib/explain'
import type { TradeSetup } from '../lib/trade-setup'

interface Props {
  setup: TradeSetup
  onClose: () => void
}

export function ExplainModal({ setup, onClose }: Props) {
  const grouped: Record<ReasonSide, { reason: string; text: string }[]> = {
    bull: [],
    bear: [],
    context: [],
  }
  for (const r of setup.reasons) {
    const ex = explainReason(r)
    grouped[ex.side].push({ reason: r, text: ex.text })
  }

  const isLong = setup.dir === 'long'
  const risk = setup.dir ? Math.abs(setup.entry - setup.sl) : 0
  const riskPct = setup.entry > 0 ? ((risk / setup.entry) * 100).toFixed(2) : '0'

  return (
    <div className="btc-chart__modal-backdrop">
      <button
        type="button"
        className="btc-chart__modal-scrim"
        aria-label="Đóng giải thích"
        onClick={onClose}
      />
      <div
        className="btc-chart__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="btc-chart-explain-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      >
        <div className="btc-chart__modal-hdr">
          <h3 id="btc-chart-explain-title">Vì sao có Trade Setup này?</h3>
          <button
            type="button"
            className="btc-chart__modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className="btc-chart__modal-body">
          {setup.dir ? (
            <div className="btc-chart__explain-verdict">
              <span className={isLong ? 'up' : 'dn'}>
                {isLong ? '▲ LONG' : '▼ SHORT'} · {setup.confidence}%
              </span>
              <span className="muted">
                {grouped.bull.length} tín hiệu tăng · {grouped.bear.length} tín hiệu giảm
              </span>
            </div>
          ) : (
            <p className="muted">
              Chưa đủ đồng thuận cho một setup (cần ≥2 tín hiệu cùng phía). Dưới đây là các tín hiệu
              đang có.
            </p>
          )}

          {setup.dir && (
            <div className="btc-chart__explain-levels">
              <span>
                Limit entry {fmtP(setup.entry)}
                {setup.entryMethod ? ` (${setup.entryMethod})` : ''}
              </span>
              {setup.spotPrice > 0 && <span className="muted">Spot {fmtP(setup.spotPrice)}</span>}
              <span className="dn">
                SL {fmtP(setup.sl)} (-{riskPct}%)
              </span>
              <span className="up">TP1 {fmtP(setup.tp1)}</span>
              <span className="up">TP2 {fmtP(setup.tp2)}</span>
              <span className="up">TP3 {fmtP(setup.tp3)}</span>
              <span className="muted">R:R 1:{setup.rr > 0 ? setup.rr.toFixed(1) : '2.0'}</span>
            </div>
          )}

          <ExplainGroup
            title="Tín hiệu ủng hộ TĂNG"
            cls="up"
            items={grouped.bull}
            empty="Không có tín hiệu tăng."
          />
          <ExplainGroup
            title="Tín hiệu ủng hộ GIẢM"
            cls="dn"
            items={grouped.bear}
            empty="Không có tín hiệu giảm."
          />
          {grouped.context.length > 0 && (
            <ExplainGroup
              title="Bối cảnh (không đổi hướng)"
              cls=""
              items={grouped.context}
              empty=""
            />
          )}

          <div className="btc-chart__explain-conf-note">
            Độ tin cậy = số phiếu bên thắng × 20 + chênh lệch phiếu × 10 (tối đa 100%). Cần ít nhất
            2 phiếu cùng phía mới ra hướng.
          </div>

          <h4 className="btc-chart__explain-h4">Giải thích các chỉ báo</h4>
          <div className="btc-chart__explain-docs">
            {INDICATOR_DOCS.map((d) => (
              <div key={d.name} className="btc-chart__explain-doc">
                <span className="btc-chart__explain-doc-name">{d.name}</span>
                <span className="btc-chart__explain-doc-desc">{d.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ExplainGroup({
  title,
  cls,
  items,
  empty,
}: {
  title: string
  cls: string
  items: { reason: string; text: string }[]
  empty: string
}) {
  return (
    <div className="btc-chart__explain-group">
      <h4 className={`btc-chart__explain-group-title ${cls}`}>{title}</h4>
      {items.length === 0 ? (
        empty ? (
          <p className="muted btc-chart__explain-empty">{empty}</p>
        ) : null
      ) : (
        <ul className="btc-chart__explain-list">
          {items.map((it) => (
            <li key={it.reason}>
              <span className={`btc-chart__explain-tag ${cls}`}>{it.reason}</span>
              <span className="btc-chart__explain-text">{it.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import type { Interval } from '@btc-chart/constants'
import { INTERVALS } from '@btc-chart/constants'
import type { BtcAlertSnapshot } from '../lib/analyze-alert'
import type { TelegramAuthState } from '../lib/telegram-user'
import { TelegramUserBar } from './TelegramUserBar'

export interface AlertScreenProps {
  readonly auth: TelegramAuthState
  readonly symbol: string
  readonly interval: Interval
  readonly snapshot: BtcAlertSnapshot | null
  readonly loading: boolean
  readonly error: string | null
  readonly chartUrl: string
  readonly onSymbolChange: (sym: string) => void
  readonly onIntervalChange: (iv: Interval) => void
  readonly onRefresh: () => void
}

function fmtPrice(v: number): string {
  if (v >= 1000) return v.toFixed(2)
  if (v >= 1) return v.toFixed(4)
  return v.toFixed(6)
}

function dirLabel(dir: 'long' | 'short' | null): string {
  if (dir === 'long') return 'LONG'
  if (dir === 'short') return 'SHORT'
  return 'NEUTRAL'
}

export function AlertScreen({
  auth,
  symbol,
  interval,
  snapshot,
  loading,
  error,
  chartUrl,
  onSymbolChange,
  onIntervalChange,
  onRefresh,
}: AlertScreenProps) {
  const base = symbol.replace(/USDT$/, '')
  const setup = snapshot?.setup
  const bias = setup?.bias
  const plan = setup?.plan
  const biasDir = bias?.dir ?? null
  const planDir = plan?.dir ?? setup?.dir ?? null

  return (
    <div className="tga">
      <TelegramUserBar auth={auth} />

      <header className="tga__header">
        <div>
          <p className="tga__kicker">BTC Chart Alert</p>
          <h1 className="tga__pair">
            {base}/USDT
            <span className="tga__iv">{interval}</span>
          </h1>
        </div>
        <button type="button" className="tga__refresh" onClick={onRefresh} aria-label="Refresh">
          {loading ? '…' : '↻'}
        </button>
      </header>

      <label className="tga__field">
        <span className="tga__field-label">Symbol</span>
        <input
          className="tga__input"
          value={symbol.replace(/USDT$/, '')}
          onChange={(e) => onSymbolChange(`${e.target.value}USDT`)}
          placeholder="BTC"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </label>

      <div className="tga__intervals" role="tablist" aria-label="Interval">
        {INTERVALS.map((iv: Interval) => (
          <button
            key={iv}
            type="button"
            role="tab"
            aria-selected={interval === iv}
            className={`tga__iv-btn${interval === iv ? ' is-on' : ''}`}
            onClick={() => onIntervalChange(iv)}
          >
            {iv}
          </button>
        ))}
      </div>

      {error && (
        <p className="tga__error" role="alert">
          {error}
        </p>
      )}

      {snapshot && (
        <>
          <section className="tga__price-row">
            <span className="tga__price">{fmtPrice(snapshot.price)}</span>
            <span className={`tga__chg${snapshot.changePct >= 0 ? ' is-up' : ' is-dn'}`}>
              {snapshot.changePct >= 0 ? '+' : ''}
              {snapshot.changePct.toFixed(2)}%
            </span>
          </section>

          <section className="tga__card tga__card--ml">
            <p className="tga__card-label">ML Signal</p>
            <p className="tga__ml" style={{ color: snapshot.ml.color }}>
              {snapshot.ml.label}
              <span className="tga__ml-pct">{Math.round(snapshot.ml.score * 100)}%</span>
            </p>
          </section>

          <section
            className={`tga__card tga__hero${biasDir === 'long' ? ' is-long' : biasDir === 'short' ? ' is-short' : ''}`}
          >
            <p className="tga__card-label">Bias live</p>
            <p className="tga__hero-dir">{dirLabel(biasDir)}</p>
            <p className="tga__hero-meta">
              {bias ? `${bias.bull} bull · ${bias.bear} bear` : '—'}
              {bias ? ` · ${bias.confidence}%` : ''}
            </p>
          </section>

          <section className="tga__card">
            <p className="tga__card-label">Trade Setup</p>
            {planDir && setup?.planStatus === 'active' ? (
              <div className="tga__plan">
                <p className={`tga__plan-dir${planDir === 'long' ? ' is-long' : ' is-short'}`}>
                  Plan {planDir === 'long' ? 'LONG' : 'SHORT'}
                </p>
                <dl className="tga__levels">
                  <div>
                    <dt>Entry</dt>
                    <dd>{fmtPrice(setup.entry)}</dd>
                  </div>
                  <div>
                    <dt>SL</dt>
                    <dd>{fmtPrice(setup.sl)}</dd>
                  </div>
                  <div>
                    <dt>TP1</dt>
                    <dd>{fmtPrice(setup.tp1)}</dd>
                  </div>
                  <div>
                    <dt>RR</dt>
                    <dd>{setup.rr.toFixed(1)}R</dd>
                  </div>
                </dl>
                {setup.entryMethod && <p className="tga__method">{setup.entryMethod}</p>}
              </div>
            ) : (
              <div className="tga__empty">
                <p className="tga__empty-title">Chưa có plan</p>
                <p className="tga__empty-hint">
                  Cần ít nhất 2 vote cùng hướng (Lux + ML). SMC votes chỉ có trên chart đầy đủ.
                </p>
              </div>
            )}
          </section>

          {bias && bias.reasons.length > 0 && (
            <section className="tga__card">
              <p className="tga__card-label">Confluence</p>
              <ul className="tga__reasons">
                {bias.reasons.slice(0, 6).map((r: string) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          <p className="tga__updated">
            Updated {new Date(snapshot.updatedAt).toLocaleTimeString()}
          </p>
        </>
      )}

      <a className="tga__cta" href={chartUrl} target="_blank" rel="noopener noreferrer">
        Open full chart
      </a>
    </div>
  )
}

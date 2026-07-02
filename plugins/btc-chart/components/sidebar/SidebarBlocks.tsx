// BTC Chart — shared sidebar block primitives (Meridian rail design system).

import type { ReactNode } from 'react'

export type SideBlockVariant = 'signal' | 'trade' | 'context' | 'market' | 'strategy' | 'data'
export type SideTone = 'up' | 'dn' | 'neu' | 'hi' | 'mint' | ''

/** Section divider in the sidebar rail (SIGNALS, CONTEXT, TOOLS). */
export function RailSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="sb-rail">
      <div className="sb-rail__label">{label}</div>
      <div className="sb-rail__stack">{children}</div>
    </section>
  )
}

interface SideBlockProps {
  variant: SideBlockVariant
  tone?: 'long' | 'short' | 'buy' | 'sell' | 'neutral'
  className?: string
  children: ReactNode
}

/** Root card for a sidebar panel. Variant sets accent color and surface tint. */
export function SideBlock({ variant, tone, className = '', children }: SideBlockProps) {
  const toneCls = tone ? ` sb-block--${tone}` : ''
  return (
    <div className={`sb-block sb-block--${variant}${toneCls} ${className}`.trim()}>{children}</div>
  )
}

/** Hero block: ML signal, Fear & Greed headline metrics. */
export function SideHero({
  kicker,
  title,
  value,
  hint,
  color,
  pct,
  actions,
}: {
  kicker: string
  title: string
  value?: string
  hint?: string
  color?: string
  pct?: number
  actions?: ReactNode
}) {
  return (
    <div className="sb-hero">
      <div className="sb-hero__top">
        <span className="sb-hero__kicker">{kicker}</span>
        <div className="sb-hero__meta">
          {pct != null && <span className="sb-hero__pct">{pct}%</span>}
          {actions && <div className="sb-hero__actions">{actions}</div>}
        </div>
      </div>
      <div className="sb-hero__title" style={color ? { color } : undefined}>
        {title}
      </div>
      {value && <div className="sb-hero__value">{value}</div>}
      {pct != null && (
        <div className="sb-hero__meter">
          <div className="sb-hero__meter-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      )}
      {hint && <div className="sb-hero__hint">{hint}</div>}
    </div>
  )
}

/** Collapsible or static panel header. */
export function SideHead({
  title,
  subtitle,
  open,
  collapsible = false,
  onToggle,
  badges,
  summary,
  actions,
}: {
  title: string
  subtitle?: string
  open?: boolean
  collapsible?: boolean
  onToggle?: () => void
  badges?: ReactNode
  summary?: ReactNode
  actions?: ReactNode
}) {
  const toggleContent = (
    <>
      {collapsible && (
        <span className="sb-head__caret" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      )}
      <div className="sb-head__titles">
        <span className="sb-head__title">{title}</span>
        {subtitle && <span className="sb-head__sub">{subtitle}</span>}
      </div>
      {badges && <div className="sb-head__badges">{badges}</div>}
      {summary && <div className="sb-head__summary">{summary}</div>}
    </>
  )

  if (collapsible && actions) {
    return (
      <div className="sb-head sb-head--split">
        <button
          type="button"
          className="sb-head__toggle sb-head--btn"
          onClick={onToggle}
          aria-expanded={open}
        >
          {toggleContent}
        </button>
        <div className="sb-head__actions">{actions}</div>
      </div>
    )
  }

  if (collapsible) {
    return (
      <button
        type="button"
        className="sb-head sb-head--btn"
        onClick={onToggle}
        aria-expanded={open}
      >
        {toggleContent}
      </button>
    )
  }

  return (
    <div className="sb-head">
      {toggleContent}
      {actions && <div className="sb-head__actions">{actions}</div>}
    </div>
  )
}

export function SideBody({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`sb-body ${className}`.trim()}>{children}</div>
}

export function StatGrid({ cols = 3, children }: { cols?: 2 | 3 | 4; children: ReactNode }) {
  return <div className={`sb-stat-grid sb-stat-grid--${cols}`}>{children}</div>
}

export function StatCell({
  label,
  value,
  tone = '',
  sub,
}: {
  label: string
  value: ReactNode
  tone?: SideTone
  sub?: string
}) {
  return (
    <div className="sb-stat">
      <div className="sb-stat__label">{label}</div>
      <div className={`sb-stat__value ${tone}`}>{value}</div>
      {sub && <div className="sb-stat__sub">{sub}</div>}
    </div>
  )
}

export function SideRow({
  label,
  value,
  tone = '',
  className = '',
}: {
  label: string
  value: ReactNode
  tone?: SideTone
  className?: string
}) {
  return (
    <div className={`sb-row ${className}`.trim()}>
      <span className="sb-row__label">{label}</span>
      <span className={`sb-row__value ${tone}`}>{value}</span>
    </div>
  )
}

export function SideBadge({
  children,
  tone = 'mint',
}: {
  children: ReactNode
  tone?: 'mint' | 'up' | 'dn' | 'neu' | 'hi' | 'muted'
}) {
  return <span className={`sb-badge sb-badge--${tone}`}>{children}</span>
}

export function SideMeter({
  value,
  max = 100,
  tone = 'mint',
}: {
  value: number
  max?: number
  tone?: 'mint' | 'up' | 'dn' | 'hi'
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="sb-meter">
      <div className={`sb-meter__fill sb-meter__fill--${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function SideNote({ children }: { children: ReactNode }) {
  return <p className="sb-note">{children}</p>
}

export function SideEmpty({ children }: { children: ReactNode }) {
  return <div className="sb-empty">{children}</div>
}

export function SideDivider() {
  return <div className="sb-divider" role="separator" />
}

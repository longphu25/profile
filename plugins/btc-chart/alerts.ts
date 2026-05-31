// BTC Chart — Alert engine, sound, and browser notifications.
//
// Alert types supported:
//   • price-cross-up      — current price crosses above a target
//   • price-cross-down    — current price crosses below a target
//   • nwe-upper           — price touches/exceeds NWE upper band
//   • nwe-lower           — price touches/breaks below NWE lower band
//   • rsi-overbought      — RSI > threshold (default 70)
//   • rsi-oversold        — RSI < threshold (default 30)
//
// Each rule fires once until reset, unless `repeat: true`.

export type AlertKind =
  | 'price-cross-up'
  | 'price-cross-down'
  | 'nwe-upper'
  | 'nwe-lower'
  | 'rsi-overbought'
  | 'rsi-oversold'

export interface AlertRule {
  id: string
  kind: AlertKind
  /** Target value for price/RSI alerts. NWE alerts ignore this. */
  value: number
  /** Optional human label. */
  label?: string
  enabled: boolean
  repeat: boolean
  /** Last fire timestamp (ms). 0 = never fired since reset. */
  triggeredAt: number
}

export interface AlertContext {
  price: number
  prevPrice: number | null
  nweUpper: number | null
  nweLower: number | null
  rsi: number | null
}

export interface FiredAlert {
  rule: AlertRule
  message: string
  at: number
}

const KIND_LABEL: Record<AlertKind, string> = {
  'price-cross-up': 'Price crosses up',
  'price-cross-down': 'Price crosses down',
  'nwe-upper': 'Touch NWE Upper',
  'nwe-lower': 'Touch NWE Lower',
  'rsi-overbought': 'RSI overbought',
  'rsi-oversold': 'RSI oversold',
}

export function describeRule(r: AlertRule): string {
  if (r.label) return r.label
  switch (r.kind) {
    case 'price-cross-up':
      return `Price ↑ ${fmt(r.value)}`
    case 'price-cross-down':
      return `Price ↓ ${fmt(r.value)}`
    case 'nwe-upper':
      return 'Price touches NWE Upper'
    case 'nwe-lower':
      return 'Price breaks NWE Lower'
    case 'rsi-overbought':
      return `RSI > ${r.value}`
    case 'rsi-oversold':
      return `RSI < ${r.value}`
  }
}

export function kindLabel(k: AlertKind): string {
  return KIND_LABEL[k]
}

const fmt = (n: number) =>
  n >= 10000 ? n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : n.toFixed(2)

export function makeRule(kind: AlertKind, value: number, label?: string): AlertRule {
  return {
    id: cryptoRandomId(),
    kind,
    value,
    label,
    enabled: true,
    repeat: false,
    triggeredAt: 0,
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto & { randomUUID(): string }).randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Evaluate all rules against current context. Returns rules that fired now.
 *  Mutates `triggeredAt` on the rule objects (caller should persist after). */
export function evaluateAlerts(rules: AlertRule[], ctx: AlertContext): FiredAlert[] {
  const fired: FiredAlert[] = []
  const now = Date.now()
  // Suppress duplicate fires within 60s for repeat rules.
  const cooldown = 60_000

  for (const r of rules) {
    if (!r.enabled) continue
    if (r.triggeredAt && !r.repeat) continue
    if (r.triggeredAt && r.repeat && now - r.triggeredAt < cooldown) continue

    let hit = false
    let msg = ''

    switch (r.kind) {
      case 'price-cross-up':
        if (ctx.prevPrice != null && ctx.prevPrice < r.value && ctx.price >= r.value) {
          hit = true
          msg = `Price crossed up ${fmt(r.value)} (now ${fmt(ctx.price)})`
        }
        break
      case 'price-cross-down':
        if (ctx.prevPrice != null && ctx.prevPrice > r.value && ctx.price <= r.value) {
          hit = true
          msg = `Price crossed down ${fmt(r.value)} (now ${fmt(ctx.price)})`
        }
        break
      case 'nwe-upper':
        if (ctx.nweUpper != null && ctx.price >= ctx.nweUpper) {
          hit = true
          msg = `Price touched NWE Upper ${fmt(ctx.nweUpper)} (now ${fmt(ctx.price)})`
        }
        break
      case 'nwe-lower':
        if (ctx.nweLower != null && ctx.price <= ctx.nweLower) {
          hit = true
          msg = `Price broke NWE Lower ${fmt(ctx.nweLower)} (now ${fmt(ctx.price)})`
        }
        break
      case 'rsi-overbought':
        if (ctx.rsi != null && ctx.rsi >= r.value) {
          hit = true
          msg = `RSI ${ctx.rsi.toFixed(1)} ≥ ${r.value} (overbought)`
        }
        break
      case 'rsi-oversold':
        if (ctx.rsi != null && ctx.rsi <= r.value) {
          hit = true
          msg = `RSI ${ctx.rsi.toFixed(1)} ≤ ${r.value} (oversold)`
        }
        break
    }

    if (hit) {
      r.triggeredAt = now
      fired.push({ rule: r, message: msg, at: now })
    }
  }

  return fired
}

/** Reset trigger state for one or all rules. */
export function resetTriggers(rules: AlertRule[], id?: string): void {
  for (const r of rules) {
    if (!id || r.id === id) r.triggeredAt = 0
  }
}

// ── Sound ─────────────────────────────────────────────────────────────────

/** Lightweight Web Audio "ping" — no asset file, no preload. */
export class AlertSound {
  private ctx: AudioContext | null = null
  private vol = 0.4

  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v))
  }

  /** Play a short two-tone ping. Initializes AudioContext on first call. */
  play(): void {
    try {
      if (!this.ctx) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!Ctx) return
        this.ctx = new Ctx()
      }
      const ctx = this.ctx
      // Resume on user gesture in case it was suspended
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})

      const now = ctx.currentTime
      this.beep(now, 880, 0.12) // A5
      this.beep(now + 0.13, 1318.5, 0.18) // E6
    } catch {
      /* audio not available */
    }
  }

  private beep(at: number, freq: number, duration: number) {
    if (!this.ctx) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(this.vol, at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    osc.connect(gain).connect(this.ctx.destination)
    osc.start(at)
    osc.stop(at + duration + 0.02)
  }
}

// ── Browser Notifications ─────────────────────────────────────────────────

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission
  }
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export function pushNotification(title: string, body: string): void {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, tag: 'btc-chart-alert', silent: true })
  } catch {
    /* iOS Safari etc. — silent */
  }
}

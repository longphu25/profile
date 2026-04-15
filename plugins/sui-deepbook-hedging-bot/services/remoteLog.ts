/**
 * Remote log service — push bot logs to external services.
 * Supports: Discord webhooks, Grafana Loki, generic HTTP endpoints.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'success'

export interface RemoteLogConfig {
  url: string
  type: 'discord' | 'loki' | 'supabase' | 'generic'
  /** Loki labels or Supabase table config */
  labels?: Record<string, string>
  /** Supabase anon key */
  apiKey?: string
}

const LEVEL_ICON: Record<LogLevel, string> = {
  success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️',
}

/** Detect service type from URL */
export function detectLogServiceType(url: string): RemoteLogConfig['type'] {
  if (url.includes('discord.com/api/webhooks')) return 'discord'
  if (url.includes('/loki/api/v1/push') || url.includes('grafana.net')) return 'loki'
  if (url.includes('supabase.co') || url.includes('supabase.in')) return 'supabase'
  return 'generic'
}

/** Parse basic auth from URL (https://user:pass@host/path) and return { url, headers } */
function parseAuthUrl(rawUrl: string): { url: string; headers: Record<string, string> } {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const parsed = new URL(rawUrl)
    if (parsed.username) {
      headers['Authorization'] = 'Basic ' + btoa(`${parsed.username}:${parsed.password}`)
      parsed.username = ''
      parsed.password = ''
      return { url: parsed.toString(), headers }
    }
  } catch { /* not a valid URL, use as-is */ }
  return { url: rawUrl, headers }
}

/** Build Loki push payload */
function buildLokiPayload(level: LogLevel, msg: string, labels: Record<string, string>): string {
  const ts = (Date.now() * 1_000_000).toString() // nanoseconds
  return JSON.stringify({
    streams: [{
      stream: { ...labels, level },
      values: [[ts, `${LEVEL_ICON[level]} ${msg}`]],
    }],
  })
}

/** Push a single log entry to remote service. Fire-and-forget. */
export function pushLog(config: RemoteLogConfig, level: LogLevel, msg: string): void {
  if (!config.url) return
  const { url, headers } = parseAuthUrl(config.url)

  try {
    switch (config.type) {
      case 'discord':
        fetch(config.url, { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `${LEVEL_ICON[level]} ${msg}` }),
        }).catch(() => {})
        break

      case 'loki':
        fetch(url, { method: 'POST', headers,
          body: buildLokiPayload(level, msg, config.labels ?? { job: 'hedging-bot' }),
        }).catch(() => {})
        break

      case 'supabase': {
        const baseUrl = config.url.replace(/\/+$/, '')
        fetch(`${baseUrl}/rest/v1/bot_logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.apiKey ?? '',
            'Authorization': `Bearer ${config.apiKey ?? ''}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            level, msg,
            pool: config.labels?.pool ?? null,
            created_at: new Date().toISOString(),
          }),
        }).catch(() => {})
        break
      }

      case 'generic':
        fetch(config.url, { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level, msg, ts: Date.now(), icon: LEVEL_ICON[level] }),
        }).catch(() => {})
        break
    }
  } catch { /* never block the bot */ }
}

/** Send a test message to verify the endpoint works */
export async function testLogEndpoint(config: RemoteLogConfig): Promise<boolean> {
  const { url, headers } = parseAuthUrl(config.url)
  try {
    const testMsg = `🤖 Hedging Bot — test (${config.type})`
    let res: Response
    switch (config.type) {
      case 'discord':
        res = await fetch(config.url, { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: testMsg }) })
        break
      case 'loki':
        res = await fetch(url, { method: 'POST', headers,
          body: buildLokiPayload('info', testMsg, config.labels ?? { job: 'hedging-bot' }) })
        break
      case 'supabase': {
        const baseUrl = config.url.replace(/\/+$/, '')
        res = await fetch(`${baseUrl}/rest/v1/bot_logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.apiKey ?? '',
            'Authorization': `Bearer ${config.apiKey ?? ''}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ level: 'info', msg: testMsg, pool: config.labels?.pool ?? null, created_at: new Date().toISOString() }),
        })
        break
      }
      default:
        res = await fetch(config.url, { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: 'info', msg: testMsg, ts: Date.now() }) })
        break
    }
    return res.ok || res.status === 201 || res.status === 204
  } catch {
    return false
  }
}

/**
 * === Supabase Free Tier setup ===
 *
 * 1. Create project: https://supabase.com/dashboard
 * 2. SQL Editor → run:
 *
 *    create table bot_logs (
 *      id bigint generated always as identity primary key,
 *      level text not null,
 *      msg text not null,
 *      pool text,
 *      created_at timestamptz default now()
 *    );
 *    alter table bot_logs enable row level security;
 *    create policy "anon insert" on bot_logs for insert to anon with check (true);
 *    create policy "anon select" on bot_logs for select to anon using (true);
 *
 * 3. In bot Setup tab:
 *    URL: https://xxxxx.supabase.co
 *    API Key: eyJhbGciOiJIUzI1NiIs... (anon key from Settings → API)
 *
 * 4. Query logs:
 *    select * from bot_logs order by created_at desc limit 100;
 *    select * from bot_logs where level = 'error';
 *
 * === Grafana Cloud Free Tier setup ===
 *
 * 1. Sign up: https://grafana.com/auth/sign-up/create-user
 * 2. Connections → Hosted Logs → Details → copy User ID + API token
 * 3. Paste into bot:
 *    https://<USER_ID>:<API_TOKEN>@logs-prod-<REGION>.grafana.net/loki/api/v1/push
 * 4. Grafana → Explore → Loki:
 *    {job="hedging-bot"} | json
 */

#!/usr/bin/env node

/**
 * Predict Club — cockpit UI smoke probe.
 *
 * Headless Playwright check that the rebuilt chart-king cockpit (plan 22) mounts
 * and renders its rails on the Next route, at both desktop and mobile widths.
 * This is the hand-run companion to tests/e2e/predict-club-cockpit.spec.ts — same
 * surface, but a single fast pass with a human-readable report and a pass/fail
 * exit code, so it is useful for a quick local sanity check or a CI smoke gate.
 *
 * Usage:
 *   node scripts/predict-club-ui-smoke.mjs
 *   node scripts/predict-club-ui-smoke.mjs --json
 *
 * Config (CLI flag overrides env var overrides default):
 *   PC_SMOKE_URL       base origin           (default http://127.0.0.1:5173)
 *   PC_SMOKE_ENTRY     entry html file       (default predict-club-next.html)
 *   PC_SMOKE_WAIT_MS   wait for live prices  (default 9000)
 *   PC_SMOKE_DESKTOP   desktop viewport WxH  (default 1440x900)
 *   PC_SMOKE_MOBILE    mobile viewport WxH   (default 390x844)
 *
 * Must run with `node` (not bun): the project pins playwright 1.59.x, and bun's
 * cache resolves a newer playwright-core whose browser build is not installed.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

// Minimal .env loader: standalone node scripts do not pick up .env the way Vite
// does. Existing process.env always wins so CI / shell overrides are respected.
function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (key in process.env) continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

function parseArgs(input) {
  const result = {}
  for (let i = 0; i < input.length; i += 1) {
    const item = input[i]
    if (!item.startsWith('--')) continue
    const [rawKey, inlineValue] = item.slice(2).split('=')
    if (inlineValue === undefined) {
      const next = input[i + 1]
      if (next && !next.startsWith('--')) {
        result[rawKey] = next
        i += 1
      } else {
        result[rawKey] = 'true'
      }
    } else {
      result[rawKey] = inlineValue
    }
  }
  return result
}

function parseViewport(value, fallback) {
  const match = /^(\d+)x(\d+)$/.exec((value ?? '').trim())
  if (!match) return fallback
  return { width: Number(match[1]), height: Number(match[2]) }
}

loadEnvFile(resolve(process.cwd(), '.env'))
const args = parseArgs(process.argv.slice(2))
const asJson = args.json === 'true'

const origin = (args.url ?? process.env.PC_SMOKE_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const entry = args.entry ?? process.env.PC_SMOKE_ENTRY ?? 'predict-club-next.html'
const waitMs = Number(args.wait ?? process.env.PC_SMOKE_WAIT_MS ?? 9000)
const desktop = parseViewport(args.desktop ?? process.env.PC_SMOKE_DESKTOP, {
  width: 1440,
  height: 900,
})
const mobile = parseViewport(args.mobile ?? process.env.PC_SMOKE_MOBILE, { width: 390, height: 844 })
const url = `${origin}/${entry.replace(/^\//, '')}`

// Public testnet fullnode / Binance feed errors are expected noise in a local
// headless run; anything else is a real console error and fails the smoke.
function isExpectedNoise(text) {
  return text.includes('fullnode.testnet.sui.io') || text.includes('binance')
}

const checks = []
function record(name, pass, detail = '') {
  checks.push({ name, pass, detail })
}

async function main() {
  const browser = await chromium.launch()
  const errors = []
  try {
    const page = await browser.newPage({ viewport: desktop })
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error' && !isExpectedNoise(m.text())) errors.push(m.text())
    })

    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(waitMs)

    // Desktop: cockpit + every rail mounts.
    record('cockpit mounts', (await page.locator('[data-pc-cockpit]').count()) > 0)
    record('chart zone', (await page.locator('[data-pc-chart]').count()) > 0)
    record('lifecycle rail', (await page.locator('[data-pc-lifecycle]').count()) > 0)
    record('action rail', (await page.locator('[data-pc-rail]').count()) > 0)
    record('exposure rail', (await page.locator('[data-pc-exposure]').count()) > 0)

    // Chart draws spot + forward (2 polylines) once prices arrive, else collecting.
    const polylines = await page.locator('[data-pc-chart-canvas] svg polyline').count()
    const collecting =
      (await page.getByText(/Collecting live prices|No oracle feed/).count()) > 0
    record(
      'chart spot + forward lines',
      polylines === 2 || collecting,
      `polylines=${polylines} collecting=${collecting}`,
    )

    // Action path is gated while disconnected: Connect shown, one-tap submit hidden.
    const connect = await page.locator('[data-pc-action="connect"]').count()
    const submitUp = await page.locator('[data-pc-action="submit-up"]').count()
    const submitDown = await page.locator('[data-pc-action="submit-down"]').count()
    record(
      'disconnected gating',
      connect > 0 && submitUp === 0 && submitDown === 0,
      `connect=${connect} submit=${submitUp + submitDown}`,
    )

    // No horizontal overflow at desktop width.
    const deskOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    record('no desktop x-overflow', deskOverflow <= 1, `overflow=${deskOverflow}px`)

    // Mobile: CTA bar present, opens the action sheet, Escape closes it.
    await page.setViewportSize(mobile)
    await page.waitForTimeout(300)
    const ctaCount = await page.locator('[data-pc-cta-bar]').count()
    record('mobile CTA bar', ctaCount > 0)
    if (ctaCount > 0) {
      await page.locator('[data-pc-cta-bar]').click()
      record('sheet opens on tap', (await page.locator('[data-pc-action-sheet]').count()) > 0)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      record('Escape closes sheet', (await page.locator('[data-pc-action-sheet]').count()) === 0)
    }

    // No horizontal overflow at mobile width.
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    record('no mobile x-overflow', mobileOverflow <= 1, `overflow=${mobileOverflow}px`)

    // No severe console / page errors throughout.
    record('no severe console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  } finally {
    await browser.close()
  }

  const failed = checks.filter((c) => !c.pass)

  if (asJson) {
    console.log(JSON.stringify({ url, passed: failed.length === 0, checks, errors }, null, 2))
  } else {
    console.log(`Predict Club — cockpit UI smoke`)
    console.log(`URL: ${url}`)
    console.log('-------------------------------')
    for (const c of checks) {
      const mark = c.pass ? 'PASS' : 'FAIL'
      console.log(`[${mark}] ${c.name}${c.detail ? `  (${c.detail})` : ''}`)
    }
    console.log('-------------------------------')
    console.log(failed.length === 0 ? `OK — ${checks.length} checks passed` : `FAILED — ${failed.length}/${checks.length} checks`)
  }

  process.exitCode = failed.length === 0 ? 0 : 1
}

main().catch((error) => {
  console.error(`Smoke failed to run: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})

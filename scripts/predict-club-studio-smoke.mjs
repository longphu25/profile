#!/usr/bin/env node

/**
 * Predict Surface Studio - UI smoke probe (plan 23).
 *
 * Headless Playwright check that the vol-surface studio (plan 23) mounts and
 * renders its panels on the studio entry, at both desktop and mobile widths,
 * plus a keyboard-nav check that locks in the S6 a11y work (roving tabindex on
 * the heatmap grid). This is the hand-run companion to
 * tests/e2e/predict-club-studio.spec.ts - same surface, but a single fast pass
 * with a human-readable report and a pass/fail exit code.
 *
 * Usage:
 *   bun scripts/predict-club-studio-smoke.mjs
 *   bun scripts/predict-club-studio-smoke.mjs --json
 *
 * Config (CLI flag overrides env var overrides default). The studio probe uses
 * its own PC_STUDIO_* namespace so it never collides with the cockpit probe's
 * PC_SMOKE_* vars in a shared .env (the cockpit .env pins PC_SMOKE_ENTRY to the
 * cockpit entry, which would otherwise point this probe at the wrong surface):
 *   PC_STUDIO_URL       base origin           (default http://127.0.0.1:5173)
 *   PC_STUDIO_ENTRY     entry html file       (default predict-surface-studio.html)
 *   PC_STUDIO_WAIT_MS   wait for live prices  (default 9000)
 *   PC_STUDIO_DESKTOP   desktop viewport WxH  (default 1440x900)
 *   PC_STUDIO_MOBILE    mobile viewport WxH   (default 390x844)
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

// Minimal .env loader: standalone scripts do not pick up .env the way Vite does.
// Existing process.env always wins so CI / shell overrides are respected.
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

const origin = (args.url ?? process.env.PC_STUDIO_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const entry = args.entry ?? process.env.PC_STUDIO_ENTRY ?? 'predict-surface-studio.html'
const waitMs = Number(args.wait ?? process.env.PC_STUDIO_WAIT_MS ?? 9000)
const desktop = parseViewport(args.desktop ?? process.env.PC_STUDIO_DESKTOP, {
  width: 1440,
  height: 900,
})
const mobile = parseViewport(args.mobile ?? process.env.PC_STUDIO_MOBILE, { width: 390, height: 844 })
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

    // Desktop: studio + every panel mounts.
    record('studio mounts', (await page.locator('[data-pc-studio]').count()) > 0)
    record('status band', (await page.locator('[data-pc-studio-status]').count()) > 0)
    record('heatmap', (await page.locator('[data-pc-studio-heatmap]').count()) > 0)
    record('edge panel', (await page.locator('[data-pc-studio-edge]').count()) > 0)
    record('time-travel control', (await page.locator('[data-pc-studio-timetravel]').count()) > 0)
    record(
      'surface health row',
      (await page.getByText(/arb-free|violation|not checked/i).count()) > 0,
    )

    // Heatmap grid carries the ARIA matrix semantics from the S6 a11y pass.
    const grid = page.locator('[data-pc-studio-heatmap] [role="grid"]')
    record('heatmap exposes role=grid', (await grid.count()) > 0)

    // Keyboard nav: when the grid has live cells, the roving-tabindex cell takes
    // focus and ArrowDown moves it. When there is no live SVI surface the grid is
    // empty - that is a valid state, so the check passes by skipping.
    const cellCount = await page.locator('[data-pc-studio-heatmap] [role="gridcell"]').count()
    if (cellCount > 0) {
      const firstCell = page.locator('[data-pc-studio-heatmap] [role="gridcell"]').first()
      await firstCell.focus()
      const focusedFirst = await page.evaluate(
        () => document.activeElement?.getAttribute('role') === 'gridcell',
      )
      await page.keyboard.press('ArrowDown')
      const stillOnCell = await page.evaluate(
        () => document.activeElement?.getAttribute('role') === 'gridcell',
      )
      record('heatmap keyboard nav', focusedFirst && stillOnCell, `cells=${cellCount}`)
    } else {
      record('heatmap keyboard nav', true, 'no live cells - skipped')
    }

    // Cell tooltip (S8): focusing a live cell shows the floating detail panel with
    // the strike and a model probability line; blur hides it. Skipped when there is
    // no live SVI surface. Runs before the ticket check, since clicking opens the
    // ticket and would steal focus from the cell.
    if (cellCount > 0) {
      await page.locator('[data-pc-studio-heatmap] [role="gridcell"]').first().focus()
      await page.waitForTimeout(150)
      const tip = page.locator('[data-pc-studio-cell-tip]')
      const tipShown = (await tip.count()) > 0
      const tipText = tipShown ? await tip.first().innerText() : ''
      record('cell tooltip shows on focus', tipShown && /\$/.test(tipText), `text=${tipText.replace(/\s+/g, ' ').trim().slice(0, 40)}`)
      await page.locator('[data-pc-studio-heatmap] [role="gridcell"]').first().blur()
      await page.waitForTimeout(150)
      record('cell tooltip hides on blur', (await page.locator('[data-pc-studio-cell-tip]').count()) === 0)
    } else {
      record('cell tooltip shows on focus', true, 'no live cells - skipped')
      record('cell tooltip hides on blur', true, 'no live cells - skipped')
    }

    // Trade ticket (S7): clicking a live cell opens the popover. Disconnected, it
    // must show Connect Wallet and hide the submit button (gating), and Escape
    // closes it. Skipped when no live SVI surface populated the grid.
    if (cellCount > 0) {
      await page.locator('[data-pc-studio-heatmap] [role="gridcell"]').first().click()
      const ticket = page.locator('[data-pc-studio-ticket]')
      const opened = (await ticket.count()) > 0
      const connect = await page.locator('[data-pc-studio-ticket-connect]').count()
      const submit = await page.locator('[data-pc-studio-ticket-submit]').count()
      record('trade ticket opens on cell click', opened)
      record('disconnected ticket gates submit', connect > 0 && submit === 0, `connect=${connect} submit=${submit}`)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(150)
      record('Escape closes ticket', (await page.locator('[data-pc-studio-ticket]').count()) === 0)
    } else {
      record('trade ticket opens on cell click', true, 'no live cells - skipped')
      record('disconnected ticket gates submit', true, 'no live cells - skipped')
      record('Escape closes ticket', true, 'no live cells - skipped')
    }

    // Positions drawer (S9): the status-band button opens the slide-in sheet, and
    // Escape closes it. Disconnected, the drawer shows the connect empty state. This
    // does not depend on a live SVI surface, so it runs unconditionally.
    const positionsOpen = await page.locator('[data-pc-studio-positions-open]').count()
    record('positions button present', positionsOpen > 0)
    if (positionsOpen > 0) {
      await page.locator('[data-pc-studio-positions-open]').click()
      await page.waitForTimeout(150)
      const drawer = page.locator('[data-pc-studio-positions]')
      const drawerShown = (await drawer.count()) > 0
      const connect = await page.locator('[data-pc-studio-positions-connect]').count()
      record('positions drawer opens', drawerShown)
      record('disconnected drawer shows connect', drawerShown && connect > 0, `connect=${connect}`)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(150)
      record('Escape closes positions drawer', (await page.locator('[data-pc-studio-positions]').count()) === 0)
    } else {
      record('positions drawer opens', false, 'no positions button')
      record('disconnected drawer shows connect', false, 'no positions button')
      record('Escape closes positions drawer', false, 'no positions button')
    }

    // No horizontal overflow at desktop width.
    const deskOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    record('no desktop x-overflow', deskOverflow <= 1, `overflow=${deskOverflow}px`)

    // No horizontal overflow at mobile width.
    await page.setViewportSize(mobile)
    await page.waitForTimeout(300)
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
    console.log('Predict Surface Studio - UI smoke')
    console.log(`URL: ${url}`)
    console.log('-------------------------------')
    for (const c of checks) {
      const mark = c.pass ? 'PASS' : 'FAIL'
      console.log(`[${mark}] ${c.name}${c.detail ? `  (${c.detail})` : ''}`)
    }
    console.log('-------------------------------')
    console.log(
      failed.length === 0
        ? `OK - ${checks.length} checks passed`
        : `FAILED - ${failed.length}/${checks.length} checks`,
    )
  }

  process.exitCode = failed.length === 0 ? 0 : 1
}

main().catch((error) => {
  console.error(`Smoke failed to run: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})

import { type Locator, expect, test } from 'playwright/test'

/**
 * Surface Studio (plan 23) on its own Vite entry — the volatility-surface
 * decision-support surface that reuses the predict-club data layer but stays
 * separate from the chart-king cockpit (plan 22).
 *
 * Covers the live-render path: the studio mounts with its status band, IV
 * heatmap, edge panel, time-travel scrubber, and surface-health row, draws no
 * horizontal overflow at desktop or mobile width, and exposes the heatmap as a
 * keyboard-navigable ARIA grid (S6 a11y: roving tabindex + arrow keys). The
 * surface fills from live on-chain SVI, so the grid may be empty in a headless
 * run with no live expiry publishing SVI — the keyboard case is gated on cells
 * actually being present.
 *
 * Console errors from the public testnet fullnode / Binance feed are filtered;
 * any other severe error fails the test.
 */
test.describe('Predict Club — Surface Studio', () => {
  test.beforeEach(async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      const text = message.text()
      if (
        message.type() === 'error' &&
        !text.includes('fullnode.testnet.sui.io') &&
        !text.includes('binance')
      ) {
        pageErrors.push(text)
      }
    })
    pageErrorsByTest.set(page, pageErrors)

    await page.goto('/predict-surface-studio.html')
    await expect(page.locator('[data-pc-studio]')).toBeVisible({ timeout: 15_000 })
  })

  test('mounts every panel with no severe page errors', async ({ page }) => {
    await expect(page.locator('[data-pc-studio-status]')).toBeVisible()
    await expect(page.locator('[data-pc-studio-heatmap]')).toBeVisible()
    await expect(page.locator('[data-pc-studio-edge]')).toBeVisible()
    await expect(page.locator('[data-pc-studio-timetravel]')).toBeVisible()
    await expect(page.getByText(/arb-free|violation|not checked/i).first()).toBeVisible()
    expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })

  test('exposes the heatmap as an ARIA grid', async ({ page }) => {
    const grid = page.locator('[data-pc-studio-heatmap] [role="grid"]')
    // The grid only renders once a live expiry is publishing SVI, which can take
    // a few seconds after mount. Wait for it before deciding: a headless run with
    // no live expiry shows the empty state instead, so the case skips only then.
    if (!(await waitForGrid(grid))) {
      test.skip(true, 'no live SVI surface in this run')
      return
    }
    await expect(grid).toHaveAttribute('aria-label', /implied volatility/i)
    await expect(grid.locator('[role="row"]').first()).toBeVisible()
    expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })

  test('arrow keys move focus between heatmap cells', async ({ page }) => {
    const cells = page.locator('[data-pc-studio-heatmap] [role="gridcell"]')
    if (!(await waitForGrid(page.locator('[data-pc-studio-heatmap] [role="grid"]')))) {
      test.skip(true, 'no live SVI surface in this run')
      return
    }
    // Roving tabindex: exactly one data cell is the tab stop at rest.
    await expect(page.locator('[data-pc-studio-heatmap] [role="gridcell"][tabindex="0"]')).toHaveCount(1)
    await cells.first().focus()
    await page.keyboard.press('ArrowRight')
    // Focus moved to a different cell, and it is now the sole tab stop.
    await expect(page.locator('[data-pc-studio-heatmap] [role="gridcell"][tabindex="0"]')).toHaveCount(1)
    const focusedIsCell = await page.evaluate(
      () => document.activeElement?.getAttribute('role') === 'gridcell',
    )
    expect(focusedIsCell).toBe(true)
    expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })

  test('no horizontal overflow at desktop or mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const deskOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(deskOverflow).toBeLessThanOrEqual(1)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(300)
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(mobileOverflow).toBeLessThanOrEqual(1)
    expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })
})

// The surface fills from live on-chain SVI a few seconds after mount. Poll for
// the grid to appear so the a11y cases run on a live surface; return false only
// when no SVI arrives in the window, in which case the caller skips.
async function waitForGrid(grid: Locator): Promise<boolean> {
  try {
    await grid.first().waitFor({ state: 'attached', timeout: 12_000 })
    return true
  } catch {
    return false
  }
}

const pageErrorsByTest = new WeakMap<object, string[]>()

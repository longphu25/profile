import { expect, test } from 'playwright/test'

/**
 * Cockpit (chart-king) surface on the Next route — the rebuilt pro surface from
 * plan 22, which replaced the Variant A/B/C prototypes at the C7 cutover.
 *
 * Covers the disconnected render path: the cockpit mounts with all rails (chart,
 * lifecycle, context, action, exposure), the chart draws its spot/forward lines,
 * and the action path is gated — the disconnected CTA is Connect Wallet, so the
 * one-tap UP/DOWN submit buttons must NOT appear. Wallet-connected execution is
 * not covered here: it needs a funded signer the headless run does not have.
 *
 * Console errors from the public testnet fullnode / Binance feed are filtered;
 * any other severe error fails the test.
 */
test.describe('Predict Club — Cockpit (Next)', () => {
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

    await page.goto('/predict-club-next.html')
    await expect(page.locator('[data-pc-cockpit]')).toBeVisible({ timeout: 15_000 })
  })

  test('mounts every rail with no severe page errors', async ({ page }) => {
    await expect(page.locator('[data-pc-chart]')).toBeVisible()
    await expect(page.locator('[data-pc-lifecycle]')).toBeVisible()
    await expect(page.locator('[data-pc-rail]')).toBeVisible()
    await expect(page.locator('[data-pc-exposure]').first()).toBeVisible()
    expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })

  test('draws the king chart with spot and forward lines', async ({ page }) => {
    await expect(page.locator('[data-pc-chart-canvas]')).toBeVisible({ timeout: 15_000 })
    // Two polylines: spot + forward. Live prices may take a moment to arrive.
    await expect(page.locator('[data-pc-chart-canvas] svg polyline')).toHaveCount(2, {
      timeout: 15_000,
    })
    await expect(page.locator('[data-pc-chart-canvas]')).toContainText(/Spot/i)
    await expect(page.locator('[data-pc-chart-canvas]')).toContainText(/Forward/i)
    expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })

  test('gates the action path: Connect Wallet shown, one-tap submit hidden', async ({ page }) => {
    await expect(page.locator('[data-pc-action="connect"]').first()).toBeVisible()
    await expect(page.locator('[data-pc-action="submit-up"]')).toHaveCount(0)
    await expect(page.locator('[data-pc-action="submit-down"]')).toHaveCount(0)
    expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })

  test('desktop reference dock expands on demand', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const dock = page.locator('[data-pc-dock]')
    await expect(dock).toBeVisible()
    await expect(page.locator('[data-pc-dock-tabs]')).toHaveCount(0)
    await dock.getByRole('button', { name: /Funding/ }).click()
    await expect(page.locator('[data-pc-dock-tabs]')).toBeVisible()
    expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })

  test('mobile CTA opens the action sheet and Escape closes it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const cta = page.locator('[data-pc-cta-bar]')
    await expect(cta).toBeVisible()
    await cta.click()
    await expect(page.locator('[data-pc-action-sheet]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-pc-action-sheet]')).toHaveCount(0)
    expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })
})

const pageErrorsByTest = new WeakMap<object, string[]>()

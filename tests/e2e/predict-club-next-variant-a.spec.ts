import { expect, test } from 'playwright/test'

/**
 * Variant A ("Swipe Deck", side-peek carousel, one-tap) on the Next surface.
 *
 * Verifies the disconnected render path: the oracle carousel mounts, the
 * centered card shows live economics, and the disconnected CTA is Connect Wallet
 * (the UP/DOWN one-tap submit buttons are gated behind a connected wallet, so
 * they must NOT appear while disconnected). Wallet-connected execution is not
 * covered here - it needs a funded signer the headless run doesn't have.
 */
test.describe('Predict Club Next — Variant A', () => {
  const pageErrorsByTest = new WeakMap<object, string[]>()

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

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/predict-club-next.html?variant=A')
    await expect(page.locator('[data-pc-variant="A"]')).toBeVisible({ timeout: 15_000 })
  })

  test('renders oracle carousel with no severe page errors', async ({ page }) => {
    await expect(page.locator('[data-pc-chart-bg]')).toBeVisible()
    // Centered card shows a live spot price headline (no canvas — simple SVG sparkline).
    await expect(page.locator('[data-pc-variant="A"]')).toContainText('$', { timeout: 15_000 })
    expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })

  test('shows Connect Wallet CTA and hides one-tap submit while disconnected', async ({ page }) => {
    await expect(page.locator('[data-pc-action="connect"]')).toBeVisible()
    await expect(page.locator('[data-pc-action="submit-up"]')).toHaveCount(0)
    await expect(page.locator('[data-pc-action="submit-down"]')).toHaveCount(0)
    expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })

  test('fits within mobile viewport without horizontal overflow', async ({ page }) => {
    const root = page.locator('[data-pc-variant="A"]')
    const box = await root.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThanOrEqual(390)
    // Regression guard for the max-w-md token collision (card had collapsed to ~32px).
    expect(box!.width).toBeGreaterThan(200)
    expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })
})

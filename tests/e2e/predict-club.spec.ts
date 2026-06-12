import { expect, test } from 'playwright/test'

test.describe('Predict Club member flow', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      const text = message.text()
      if (message.type() === 'error' && !text.includes('fullnode.testnet.sui.io')) {
        pageErrors.push(text)
      }
    })
    pageErrorsByTest.set(page, pageErrors)

    await page.goto('/predict-club.html')
    await expect(page.locator('[data-pc-panel="risk-panel"]')).toContainText('Account Backing', {
      timeout: 15_000,
    })
  })

  test('renders disconnected shell and no severe page errors', async ({ page }) => {
    await expect(page.getByText('Prediction Room').first()).toBeVisible()
    await expect(page.locator('[data-pc-panel="decision-strip"]')).toBeVisible()
    await expect(page.locator('[data-pc-panel="club-panel"]')).toContainText('Members')
    await expect(page.locator('[data-pc-panel="risk-panel"]')).toContainText('Risk Checks')
    await expect(page.locator('[data-pc-panel="risk-panel"]')).toContainText('Your Exposure')
    await expect(page.locator('[data-pc-panel="risk-panel"]')).toContainText('Account Backing')
    await expect(page.locator('[data-pc-panel="funding-router"]')).toContainText('Direct DUSDC')
    await expect(page.locator('[data-wallet-btn]')).toHaveAttribute('title', 'Connect wallet')
    await expect(page.locator('[data-wallet-trigger]')).toHaveCount(2)
    await expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })

  test('opens active oracles and keeps signal evidence collapsed by default', async ({ page }) => {
    const decisionStrip = page.locator('[data-pc-panel="decision-strip"]')
    await decisionStrip.getByRole('button', { name: /Active Oracles/ }).click()
    await expect(
      decisionStrip.getByText(/Selected|Select to load|No active oracle/).first(),
    ).toBeVisible()

    const signalEvidence = page
      .locator('[data-pc-panel="prediction-room"]')
      .getByRole('button', { name: 'Signal Evidence' })
    await expect(signalEvidence).toHaveAttribute('aria-expanded', 'false')
    await signalEvidence.click()
    await expect(signalEvidence).toHaveAttribute('aria-expanded', 'true')
    await expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })

  test('opens funding modal with clear route states', async ({ page }) => {
    await page.locator('[data-pc-panel="funding-router"] button').first().click()

    const dialog = page.locator('#pc-slot-modal-layer')
    await expect(page.getByRole('heading', { name: 'Fund to Join' })).toBeVisible()
    await expect(dialog.getByText('Available Balances')).toBeVisible()
    await expect(dialog.getByText('Recommended route', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Why', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Wallet', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Club Member', { exact: true })).toBeVisible()
    await expect(dialog.getByText('PredictManager', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Direct DUSDC', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Escrow USDC→DUSDC', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Swap SUI→USDC', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Bridge to Sui', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Suggested Stake', { exact: true })).toBeVisible()
    await expect(dialog.getByText('SUI→USDC swap via DeepBook v3')).toBeVisible()
    await expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })

  test('keeps account backing collapsed until requested', async ({ page }) => {
    const riskPanel = page.locator('[data-pc-panel="risk-panel"]')
    const accountBacking = riskPanel.getByRole('button', { name: /Account Backing/ })
    await expect(accountBacking).toHaveAttribute('aria-expanded', 'false')
    await accountBacking.click()
    await expect(accountBacking).toHaveAttribute('aria-expanded', 'true')
    await expect(riskPanel).toContainText(
      /Manager-owned positions unavailable|Max payout|Withdrawal|Vault liquidity unavailable/,
    )
    await expect(pageErrorsByTest.get(page) ?? []).toEqual([])
  })
})

const pageErrorsByTest = new WeakMap<object, string[]>()

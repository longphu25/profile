import { expect, test } from 'playwright/test'

test.describe('Predict Club member flow', () => {
  test('renders funding gate and member-facing wallet states', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      const text = message.text()
      if (message.type() === 'error' && !text.includes('fullnode.testnet.sui.io')) {
        pageErrors.push(text)
      }
    })

    await page.goto('/predict-club.html')

    await expect(page.getByText('Prediction Room').first()).toBeVisible()
    await expect(page.locator('[data-pc-panel="decision-strip"]')).toBeVisible()
    await expect(page.locator('[data-pc-panel="club-panel"]')).toContainText('Members')
    await expect(page.locator('[data-pc-panel="risk-panel"]')).toContainText('Risk Checks')
    await expect(page.locator('[data-pc-panel="risk-panel"]')).toContainText('Your Exposure')
    await expect(page.locator('[data-pc-panel="funding-router"]')).toContainText('Direct DUSDC')
    await expect(page.locator('[data-wallet-btn]')).toHaveAttribute('title', 'Connect wallet')
    await expect(page.locator('[data-wallet-trigger]')).toHaveCount(2)

    await page.locator('[data-pc-panel="funding-router"] button').first().click()

    const dialog = page.locator('#pc-slot-modal-layer')
    await expect(page.getByRole('heading', { name: 'Fund to Join' })).toBeVisible()
    await expect(dialog.getByText('Available Balances')).toBeVisible()
    await expect(dialog.getByText('Wallet', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Club Member', { exact: true })).toBeVisible()
    await expect(dialog.getByText('PredictManager', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Direct DUSDC', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Suggested Stake', { exact: true })).toBeVisible()
    await expect(dialog.getByText('SUI→USDC swap via DeepBook v3')).toBeVisible()

    await expect(pageErrors).toEqual([])
  })
})

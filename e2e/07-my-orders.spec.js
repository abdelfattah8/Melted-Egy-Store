import { test, expect } from '@playwright/test'
import { ensureLoggedIn, loadState } from './helpers.js'

/** POST-ORDER: My Orders lists this run's orders with correct statuses and totals. */

const STATUS_LABELS = {
  confirmed:       'Confirmed',
  pending_payment: 'Awaiting Confirmation',
}

test('My Orders shows the placed orders with statuses and totals', async ({ page }) => {
  const orders = loadState()?.orders || []
  test.skip(orders.length === 0, 'No orders recorded — run 06-checkout-orders first')

  await ensureLoggedIn(page)
  await page.goto('/my-orders')
  await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible()

  for (const order of orders) {
    await test.step(`order ${order.id} (${order.label})`, async () => {
      const card = page.locator('.order-card').filter({ hasText: `Order #${order.id}` })
      await expect(card).toBeVisible({ timeout: 20_000 })
      // First badge is the order status (cards can show extra badges like "Transfer under review")
      await expect(card.locator('.status-badge').first()).toHaveText(STATUS_LABELS[order.expectedStatus])
      await expect(card).toContainText(order.total)
    })
  }
})

import { test, expect } from '@playwright/test'
import {
  ensureLoggedIn, clearCartStorage, addBite,
  fillCheckoutContact, uploadProof, placeOrderAndCaptureId, recordOrder,
} from './helpers.js'

/**
 * CHECKOUT — places REAL orders in production Firestore (marked "E2E TEST").
 * Only the unlimited-stock "Classic Cookie" (150 EGP, stock=null) is ordered,
 * so no product stock is decremented by this suite.
 */
test('promo code + all three payment paths', async ({ page }) => {
  test.setTimeout(420_000)
  const creds = await ensureLoggedIn(page)
  await page.goto('/shop')
  await clearCartStorage(page)
  await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })

  // ── ORDER A: cash on delivery (<1000) + FIRST20 promo ──────────────────────
  await test.step('ORDER A: COD with FIRST20 promo (20% off)', async () => {
    await addBite(page, 'Classic Cookie', 2, '150')
    await page.goto('/checkout')
    await fillCheckoutContact(page, creds)

    // Apply FIRST20 → 20% of 300 = 60 off
    await page.getByPlaceholder('Enter promo code').fill('FIRST20')
    await page.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(page.getByText('Promo code applied — 20% off!')).toBeVisible({ timeout: 20_000 })
    const promoRow = page.locator('.summary-row').filter({ hasText: 'Promo (FIRST20)' })
    await expect(promoRow).toContainText('−60 EGP')
    // 300 − 60 + 85 = 325
    await expect(page.locator('.summary-row.total')).toContainText('325 EGP')

    // Cash is the default payment method; no deposit under 1000 EGP
    await expect(page.locator('.payment-option.selected')).toContainText('Cash on Delivery')
    await expect(page.getByText('Deposit Required')).toHaveCount(0)

    const orderId = await placeOrderAndCaptureId(page, 'Order Confirmed!')
    recordOrder({ id: orderId, label: 'A — COD + FIRST20', total: '325 EGP', expectedStatus: 'confirmed' })
  })

  // ── ORDER B: FIRST20 reuse rejected, then InstaPay with proof ───────────────
  await test.step('ORDER B: FIRST20 second use is rejected at order placement', async () => {
    await page.goto('/shop')
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })
    await addBite(page, 'Classic Cookie', 1, '150')
    await page.goto('/checkout')
    await fillCheckoutContact(page, creds)

    // Client-side apply succeeds (only checks active)…
    await page.getByPlaceholder('Enter promo code').fill('FIRST20')
    await page.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(page.getByText('Promo code applied — 20% off!')).toBeVisible({ timeout: 20_000 })

    // …but the order transaction enforces one-use-per-email
    await page.getByRole('button', { name: 'Place Order' }).click()
    await expect(page.getByText('You have already used this promo code')).toBeVisible({ timeout: 30_000 })
    await expect(page).toHaveURL(/\/checkout/)
    // The rejected promo was removed — full price again
    await expect(page.locator('.summary-row').filter({ hasText: 'Promo (FIRST20)' })).toHaveCount(0)
  })

  await test.step('ORDER B: completes via InstaPay with receipt upload', async () => {
    await page.locator('.payment-option').filter({ hasText: 'InstaPay' }).click()
    await expect(page.getByText('InstaPay Transfer')).toBeVisible()
    await uploadProof(page)
    // 150 + 85 = 235
    await expect(page.locator('.summary-row.total')).toContainText('235 EGP')
    const orderId = await placeOrderAndCaptureId(page, 'Order Received!')
    recordOrder({ id: orderId, label: 'B — InstaPay + proof', total: '235 EGP', expectedStatus: 'pending_payment' })
  })

  // ── ORDER C: over 1000 EGP → 30% deposit + proof ───────────────────────────
  await test.step('ORDER C: >1000 EGP cash order requires deposit + proof', async () => {
    await page.goto('/shop')
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })
    await addBite(page, 'Classic Cookie', 7, '150') // 1050 EGP
    await page.goto('/checkout')
    await fillCheckoutContact(page, creds)

    // Cash + >1000 → deposit section with 30% of subtotal (ceil(1050×0.3) = 315)
    await expect(page.getByText('Deposit Required')).toBeVisible()
    await expect(page.getByText('Orders over 1,000 EGP require a 30% deposit first')).toBeVisible()
    await expect(page.locator('.deposit-amount')).toContainText('315 EGP')
    await uploadProof(page)
    // 1050 + 85 = 1135
    await expect(page.locator('.summary-row.total')).toContainText('1135 EGP')
    const orderId = await placeOrderAndCaptureId(page, 'Order Received!')
    recordOrder({ id: orderId, label: 'C — COD deposit + proof', total: '1135 EGP', expectedStatus: 'pending_payment' })
  })
})

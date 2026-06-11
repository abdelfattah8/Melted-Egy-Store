import { test, expect } from '@playwright/test'
import {
  ensureLoggedIn, clearCartStorage, addBite,
  fillCheckoutContact, uploadProof, placeOrderAndCaptureId, recordOrder,
} from './helpers.js'
import { loadCatalog, orderProduct, depositProduct, freshPromo, effectivePrice } from './fixtures.js'

/**
 * CHECKOUT — places REAL orders in production Firestore (marked "E2E TEST").
 * Only unlimited-stock products are ordered, so no stock is decremented.
 * Promo steps self-skip when no active, unredeemed promo code exists.
 */
test('promo code + all three payment paths', async ({ page }) => {
  test.setTimeout(420_000)
  const catalog = await loadCatalog()
  const product = orderProduct(catalog)
  test.skip(!product, 'No unlimited-stock plain product to order safely')
  const price = effectivePrice(product)

  const creds = await ensureLoggedIn(page)
  const promo = freshPromo(catalog, creds.email)

  await page.goto('/shop')
  await clearCartStorage(page)
  await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })

  // ── ORDER A: cash on delivery (<1000), with promo when one exists ───────────
  await test.step(`ORDER A: COD${promo ? ` with ${promo.code} promo` : ' (no active promo to test)'}`, async () => {
    await addBite(page, product.name, 2)
    await page.goto('/checkout')
    await fillCheckoutContact(page, creds)

    const subtotal = price * 2
    let discount = 0
    if (promo) {
      await page.getByPlaceholder('Enter promo code').fill(promo.code)
      await page.getByRole('button', { name: 'Apply', exact: true }).click()
      await expect(page.getByText(`Promo code applied — ${promo.discountPercent}% off!`)).toBeVisible({ timeout: 20_000 })
      discount = Math.round(subtotal * promo.discountPercent / 100)
      const promoRow = page.locator('.summary-row').filter({ hasText: `Promo (${promo.code})` })
      await expect(promoRow).toContainText(`−${discount} EGP`)
    }
    const total = Math.max(0, subtotal - discount) + 85
    await expect(page.locator('.summary-row.total')).toContainText(`${total} EGP`)

    // Cash is the default payment method; no deposit under 1000 EGP
    await expect(page.locator('.payment-option.selected')).toContainText('Cash on Delivery')
    await expect(page.getByText('Deposit Required')).toHaveCount(0)

    const orderId = await placeOrderAndCaptureId(page, 'Order Confirmed!')
    recordOrder({ id: orderId, label: `A — COD${promo ? ` + ${promo.code}` : ''}`, total: `${total} EGP`, expectedStatus: 'confirmed' })
  })

  // ── ORDER B: promo reuse rejected (when promo exists), then InstaPay ────────
  await test.step('ORDER B: promo second use rejected, completes via InstaPay + receipt', async () => {
    await page.goto('/shop')
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })
    await addBite(page, product.name, 1)
    await page.goto('/checkout')
    await fillCheckoutContact(page, creds)

    if (promo) {
      // Client-side apply succeeds (only checks active)…
      await page.getByPlaceholder('Enter promo code').fill(promo.code)
      await page.getByRole('button', { name: 'Apply', exact: true }).click()
      await expect(page.getByText(`Promo code applied — ${promo.discountPercent}% off!`)).toBeVisible({ timeout: 20_000 })
      // …but the order transaction enforces one-use-per-email
      await page.getByRole('button', { name: 'Place Order' }).click()
      await expect(page.getByText('You have already used this promo code')).toBeVisible({ timeout: 30_000 })
      await expect(page).toHaveURL(/\/checkout/)
      await expect(page.locator('.summary-row').filter({ hasText: `Promo (${promo.code})` })).toHaveCount(0)
    }

    await page.locator('.payment-option').filter({ hasText: 'InstaPay' }).click()
    await expect(page.getByText('InstaPay Transfer')).toBeVisible()
    await uploadProof(page)
    const total = price + 85
    await expect(page.locator('.summary-row.total')).toContainText(`${total} EGP`)
    const orderId = await placeOrderAndCaptureId(page, 'Order Received!')
    recordOrder({ id: orderId, label: 'B — InstaPay + proof', total: `${total} EGP`, expectedStatus: 'pending_payment' })
  })

  // ── ORDER C: over 1000 EGP → 30% deposit + proof ───────────────────────────
  await test.step('ORDER C: >1000 EGP cash order requires deposit + proof', async () => {
    const dep = depositProduct(catalog)
    const qty = dep ? Math.floor(1000 / effectivePrice(dep)) + 1 : Infinity
    if (!dep || qty > 25) {
      test.info().annotations.push({ type: 'skipped-step', description: 'ORDER C skipped — no unlimited-stock product priced high enough to reach 1000 EGP in a few clicks' })
      return
    }
    const depPrice  = effectivePrice(dep)
    const subtotal  = depPrice * qty

    await page.goto('/shop')
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })
    await addBite(page, dep.name, qty)
    await page.goto('/checkout')
    await fillCheckoutContact(page, creds)

    // Cash + >1000 → deposit section with 30% of subtotal
    await expect(page.getByText('Deposit Required')).toBeVisible()
    await expect(page.getByText('Orders over 1,000 EGP require a 30% deposit first')).toBeVisible()
    await expect(page.locator('.deposit-amount')).toContainText(`${Math.ceil(subtotal * 0.3)} EGP`)
    await uploadProof(page)
    const total = subtotal + 85
    await expect(page.locator('.summary-row.total')).toContainText(`${total} EGP`)
    const orderId = await placeOrderAndCaptureId(page, 'Order Received!')
    recordOrder({ id: orderId, label: 'C — COD deposit + proof', total: `${total} EGP`, expectedStatus: 'pending_payment' })
  })
})

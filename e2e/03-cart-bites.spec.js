import { test, expect } from '@playwright/test'
import { clearCartStorage, addBite, productCard } from './helpers.js'

/** CART — BITES: quantities, qty update, removal, and the extras picker. */

test('add bites, update quantity, remove item', async ({ page }) => {
  await page.goto('/shop')
  await clearCartStorage(page)
  await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })

  await test.step('add Tiramisu ×2 and Brownie ×1', async () => {
    await addBite(page, 'Tiramisu', 2)
    await addBite(page, 'Brownie', 1)
    await expect(page.locator('.cart-btn .cart-badge').first()).toHaveText('3')
  })

  await test.step('checkout summary shows correct lines and totals', async () => {
    await page.goto('/checkout')
    const tiramisu = page.locator('.summary-item').filter({ hasText: 'Tiramisu' })
    const brownie  = page.locator('.summary-item').filter({ hasText: 'Brownie' })
    await expect(tiramisu.locator('.qty-value-mini')).toHaveText('2')
    await expect(brownie.locator('.qty-value-mini')).toHaveText('1')
    // 2×140 + 200 = 480 subtotal · +85 delivery = 565 total
    await expect(page.locator('.summary-row').filter({ hasText: 'Subtotal' })).toContainText('480 EGP')
    await expect(page.locator('.summary-row.total')).toContainText('565 EGP')
  })

  await test.step('increase Tiramisu quantity to 3', async () => {
    const tiramisu = page.locator('.summary-item').filter({ hasText: 'Tiramisu' })
    await tiramisu.locator('.qty-btn-mini').nth(1).click()
    await expect(tiramisu.locator('.qty-value-mini')).toHaveText('3')
    await expect(page.locator('.summary-row').filter({ hasText: 'Subtotal' })).toContainText('620 EGP')
  })

  await test.step('remove Brownie from cart', async () => {
    const brownie = page.locator('.summary-item').filter({ hasText: 'Brownie' })
    await brownie.locator('.qty-btn-mini').first().click() // qty 1 → minus removes
    await expect(page.getByText('Brownie removed')).toBeVisible()
    await expect(page.locator('.summary-item').filter({ hasText: 'Brownie' })).toHaveCount(0)
    await expect(page.locator('.summary-row').filter({ hasText: 'Subtotal' })).toContainText('420 EGP')
  })
})

test('product with extras opens the extras picker and prices the add-ons', async ({ page }) => {
  await page.goto('/shop')
  await clearCartStorage(page)
  await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })

  // The sale-priced "Classic Cookie" (220 EGP) has extras: Chocolate +25, Honey +50
  const card = productCard(page, 'Classic Cookie', '220')
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Add to Cart' }).click()

  const modal = page.locator('.box-builder-modal')
  await expect(modal).toBeVisible()
  await expect(modal.locator('.exm-row-name')).toHaveText('Quantity')

  await test.step('selecting an extra updates the live total', async () => {
    await expect(modal.getByRole('button', { name: /Add item — 220 EGP/ })).toBeVisible()
    await modal.locator('.exm-extra').filter({ hasText: 'Chocolate' }).click()
    await expect(modal.getByRole('button', { name: /Add item — 245 EGP/ })).toBeVisible()
    // Quantity stepper multiplies the total
    await modal.locator('.bbm-step-plus').click()
    await expect(modal.getByRole('button', { name: /Add 2 items — 490 EGP/ })).toBeVisible()
    await modal.locator('.bbm-step-btn').first().click() // back to 1
  })

  await test.step('cart line shows the chosen extra and its price', async () => {
    await modal.getByRole('button', { name: /Add item — 245 EGP/ }).click()
    await page.goto('/checkout')
    const line = page.locator('.summary-item').filter({ hasText: 'Classic Cookie' })
    await expect(line).toContainText('+ Chocolate (+25 EGP)')
    await expect(line).toContainText('245 EGP')
    await expect(page.locator('.summary-row').filter({ hasText: 'Subtotal' })).toContainText('245 EGP')
  })
})

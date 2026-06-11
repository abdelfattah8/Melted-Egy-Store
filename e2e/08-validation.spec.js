import { test, expect } from '@playwright/test'
import { clearCartStorage, addBite } from './helpers.js'
import { loadCatalog, plainProducts, activeOffer } from './fixtures.js'

/** VALIDATION: promo/offer mutual exclusion; delivery limited to Cairo/Giza. */

test('promo and offer never stack — each replaces the other', async ({ page }) => {
  const catalog = await loadCatalog()
  const offer = activeOffer(catalog, 'free_delivery')
  const promo = catalog.promoCodes.find(c => c.active)
  const item  = plainProducts(catalog)[0]
  test.skip(!offer, 'No active free_delivery offer in the live store')
  test.skip(!promo, 'No active promo code in the live store')
  test.skip(!item, 'No plain product in the live catalog')

  await page.goto('/shop')
  await clearCartStorage(page)
  await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })
  await addBite(page, item.name, 1)

  await test.step('apply the Free Delivery offer', async () => {
    await page.goto('/offers')
    const offerCard = page.locator('div').filter({ has: page.getByRole('heading', { name: offer.title }) }).last()
    await offerCard.getByRole('button', { name: 'Apply Offer →' }).click()
    await expect(page).toHaveURL(/\/checkout/)
    const deliveryRow = page.locator('.summary-row').filter({ hasText: 'Delivery' }).first()
    await expect(deliveryRow).toContainText('FREE')
  })

  await test.step('applying a promo removes the offer', async () => {
    await page.getByPlaceholder('Enter promo code').fill(promo.code)
    await page.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(page.getByText(`Promo code applied — ${promo.discountPercent}% off!`)).toBeVisible({ timeout: 20_000 })
    // Offer gone: section shows the empty state, delivery is charged again
    await expect(page.getByText('No offer applied.')).toBeVisible()
    const deliveryRow = page.locator('.summary-row').filter({ hasText: 'Delivery' }).first()
    await expect(deliveryRow).toContainText('85 EGP')
    await expect(page.locator('.summary-row').filter({ hasText: `Promo (${promo.code})` })).toBeVisible()
  })

  await test.step('re-applying an offer removes the promo', async () => {
    await page.goto('/offers')
    const offerCard = page.locator('div').filter({ has: page.getByRole('heading', { name: offer.title }) }).last()
    await offerCard.getByRole('button', { name: 'Apply Offer →' }).click()
    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.locator('.summary-row').filter({ hasText: `Promo (${promo.code})` })).toHaveCount(0)
    await expect(page.getByPlaceholder('Enter promo code')).toBeVisible()
    const deliveryRow = page.locator('.summary-row').filter({ hasText: 'Delivery' }).first()
    await expect(deliveryRow).toContainText('FREE')
  })
})

test('delivery is limited to Cairo and Giza', async ({ page }) => {
  const catalog = await loadCatalog()
  const item = plainProducts(catalog)[0]
  test.skip(!item, 'No plain product in the live catalog')

  await page.goto('/shop')
  await clearCartStorage(page)
  await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })
  await addBite(page, item.name, 1)

  await page.goto('/checkout')
  await expect(page.getByText('Delivery available in Cairo and Giza only')).toBeVisible()
  const cities = page.locator('.city-option')
  await expect(cities).toHaveCount(2)
  await expect(cities.nth(0)).toContainText('Cairo')
  await expect(cities.nth(1)).toContainText('Giza')
  // Selection toggles correctly
  await cities.nth(1).click()
  await expect(cities.nth(1)).toHaveClass(/selected/)
  await expect(cities.nth(0)).not.toHaveClass(/selected/)
})

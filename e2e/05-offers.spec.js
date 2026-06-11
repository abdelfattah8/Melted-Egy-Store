import { test, expect } from '@playwright/test'
import { clearCartStorage } from './helpers.js'

/** OFFERS: BOGO (bites only) and Buy-Box-Get-Bite-Free with FREE gift verification. */

test('BOGO offer: bites only, cheapest free at checkout', async ({ page }) => {
  await page.goto('/offers')
  await clearCartStorage(page)

  const offerCard = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Buy 1 Get 1 Free' }) }).last()
  await offerCard.getByRole('button', { name: 'Select Products →' }).click()

  const modal = page.locator('.offer-picker-modal')
  await expect(modal).toBeVisible()
  await expect(modal.getByText('cheapest becomes free')).toBeVisible()

  await test.step('boxes are NOT selectable in the picker', async () => {
    // Wait for the grid to load, then assert no box products appear INSIDE the modal
    await expect(modal.getByText('Loading products...')).toHaveCount(0, { timeout: 20_000 })
    await expect(modal.getByText('Tiramisu')).toBeVisible()
    await expect(modal.getByText('12 pices Cookie')).toHaveCount(0)
    await expect(modal.getByText('6 Picese Of Cookies')).toHaveCount(0)
  })

  await test.step('select 2 bites and confirm', async () => {
    // Pick Tiramisu twice (140 each → discount = 140)
    const tiramisuTile = modal.locator('div').filter({ hasText: /^Tiramisu140 EGP/ }).last()
    await tiramisuTile.getByRole('button').nth(1).click() // +
    await tiramisuTile.getByRole('button').nth(1).click() // +
    await modal.getByRole('button', { name: 'Confirm Selection' }).click()
    await expect(page).toHaveURL(/\/checkout/)
  })

  await test.step('checkout shows the offer and the correct discount', async () => {
    await expect(page.getByText('Offer applied: Buy 1 Get 1 Free')).toBeVisible()
    const offerSection = page.locator('.checkout-section').filter({ hasText: 'Applied Offer' })
    await expect(offerSection).toContainText('Buy 1 Get 1 Free')
    await expect(offerSection.getByText('FREE', { exact: true })).toBeVisible()
    // Discount row equals the cheapest unit (140)
    const discountRow = page.locator('.summary-row').filter({ hasText: 'Buy 1 Get 1 Free' })
    await expect(discountRow).toContainText('−140 EGP')
    // 280 − 140 + 85 = 225
    await expect(page.locator('.summary-row.total')).toContainText('225 EGP')
  })
})

test('Buy Box Get Bite Free: box → flavors → free bite', async ({ page }) => {
  await page.goto('/offers')
  await clearCartStorage(page)

  const offerCard = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Buy box get bite free' }) }).last()
  await offerCard.getByRole('button', { name: 'Select Products →' }).click()

  const modal = page.locator('.offer-picker-modal')

  await test.step('step 1: choose the box', async () => {
    await expect(modal.getByText('Step 1 — choose your box')).toBeVisible()
    await expect(modal.getByText('Loading products...')).toHaveCount(0, { timeout: 20_000 })
    await modal.getByText('6 Picese Of Cookies').first().click()
  })

  await test.step('step 2: flavor picker opens — fill the box', async () => {
    const bbm = page.locator('.box-builder-modal')
    await expect(bbm).toBeVisible()
    const plus = bbm.locator('.bbm-card').first().locator('.bbm-step-plus')
    for (let i = 0; i < 6; i++) await plus.click()
    await bbm.getByRole('button', { name: 'Add to Cart' }).click()
  })

  await test.step('step 3: pick the free bite (shown as FREE)', async () => {
    await expect(modal.getByText('pick ONE bite — it’s on us')).toBeVisible()
    // Tile = innermost div holding the bite's name, struck price, and FREE label
    const giftTile = modal.locator('div')
      .filter({ hasText: /^Nutella Cookie/ })
      .filter({ hasText: 'FREE' })
      .last()
    await expect(giftTile).toContainText('130 EGP') // struck-through sale price
    await giftTile.click()
    await modal.getByRole('button', { name: 'Confirm Free Gift' }).click()
    await expect(page).toHaveURL(/\/checkout/)
  })

  await test.step('checkout: gift is FREE and discount equals its price', async () => {
    const offerSection = page.locator('.checkout-section').filter({ hasText: 'Applied Offer' })
    await expect(offerSection).toContainText('Buy box get bite free')
    await expect(offerSection).toContainText('Nutella Cookie')
    await expect(offerSection.getByText('FREE', { exact: true })).toBeVisible()
    // Nutella Cookie effective (sale) price = 130 → discount −130
    const discountRow = page.locator('.summary-row').filter({ hasText: 'Buy box get bite free' })
    await expect(discountRow).toContainText('−130 EGP')
    // 480 (box, sale) + 130 (bite) − 130 + 85 = 565
    await expect(page.locator('.summary-row.total')).toContainText('565 EGP')
  })
})

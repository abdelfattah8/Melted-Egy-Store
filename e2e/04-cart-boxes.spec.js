import { test, expect } from '@playwright/test'
import { clearCartStorage } from './helpers.js'

/** CART — BOXES: multi-flavor box builder; single-flavor box if one exists. */

test('build a multi-flavor cookie box (piece counter)', async ({ page }) => {
  await page.goto('/shop?cat=boxes')
  await clearCartStorage(page)
  await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })

  const boxCard = page.locator('.product-card').filter({ hasText: '6 Picese Of Cookies' })
  await boxCard.getByRole('button', { name: 'Build Your Box' }).click()

  const modal = page.locator('.box-builder-modal')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('Choose exactly 6 pieces')

  await test.step('select 6 pieces and watch the progress counter', async () => {
    const firstFlavorPlus = modal.locator('.bbm-card').first().locator('.bbm-step-plus')
    for (let i = 0; i < 4; i++) await firstFlavorPlus.click()
    await expect(modal.locator('.bbm-progress-count')).toHaveText('4 / 6 pieces')
    await expect(modal).toContainText('Select 2 more')
    // Spread remaining 2 over a second flavor
    const secondFlavorPlus = modal.locator('.bbm-card').nth(1).locator('.bbm-step-plus')
    await secondFlavorPlus.click()
    await secondFlavorPlus.click()
    await expect(modal.locator('.bbm-progress-count')).toHaveText('6 / 6 pieces')
    await expect(modal).toContainText('Box complete!')
    // Cannot exceed the box size
    await expect(modal.locator('.bbm-card').nth(2).locator('.bbm-step-plus')).toBeDisabled()
  })

  await test.step('box modal shows the SALE price (500 → 480)', async () => {
    // Regression guard: boxes must respect an active sale like bites do
    await expect(modal.locator('.bbm-price')).toContainText('480')
  })

  await test.step('add the completed box to cart', async () => {
    await modal.getByRole('button', { name: 'Add to Cart' }).click()
    await expect(page.getByText('6 Picese Of Cookies added to cart!')).toBeVisible()
    await page.goto('/checkout')
    const line = page.locator('.summary-item').filter({ hasText: '6 Picese Of Cookies' })
    await expect(line).toContainText('BOX')
    await expect(line).toContainText('480 EGP') // sale price, not the original 500
  })
})

test('single-flavor box (cheesecake/tiramisu behavior)', async ({ page }) => {
  await page.goto('/shop?cat=boxes')
  await clearCartStorage(page)
  await page.waitForLoadState('networkidle')

  // Single-flavor behavior only applies to cheesecake/tiramisu boxes. None exist
  // in the production catalog right now — skip with a note if that's still true.
  let found = null
  for (const cat of ['Cheesecake', 'Tiramisu']) {
    await page.getByRole('button', { name: cat, exact: true }).click()
    await page.waitForTimeout(1500)
    if (await page.locator('.product-card').count() > 0) { found = cat; break }
  }
  test.skip(!found, 'No cheesecake/tiramisu box exists in the catalog — needs manual check once one is added')

  const boxCard = page.locator('.product-card').first()
  await boxCard.getByRole('button', { name: 'Build Your Box' }).click()
  const modal = page.locator('.box-builder-modal')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('Pick your flavor for this box')
  // Single-select radio behavior: clicking a card selects exactly one
  await modal.locator('.bbm-card').first().click()
  await expect(modal.locator('.bbm-radio-selected')).toHaveCount(1)
  await modal.getByRole('button', { name: 'Add to Cart' }).click()
  await expect(page.getByText('added to cart!')).toBeVisible()
})

import { test, expect } from '@playwright/test'
import { clearCartStorage } from './helpers.js'
import { loadCatalog, countingBox, singleFlavorBox, effectivePrice } from './fixtures.js'

/** CART — BOXES: multi-flavor box builder; single-flavor box if one exists. */

test('build a multi-flavor box (piece counter)', async ({ page }) => {
  const catalog = await loadCatalog()
  const box = countingBox(catalog)
  test.skip(!box, 'No cookies/brownies box with selectable flavors in the live catalog')
  const size  = box.boxSize
  const price = effectivePrice(box)

  await page.goto('/shop?cat=boxes')
  await clearCartStorage(page)
  await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })

  const boxCard = page.locator('.product-card').filter({ hasText: box.name })
  await boxCard.getByRole('button', { name: 'Build Your Box' }).click()

  const modal = page.locator('.box-builder-modal')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText(`Choose exactly ${size} pieces`)

  await test.step(`select ${size} pieces and watch the progress counter`, async () => {
    const firstFlavorPlus = modal.locator('.bbm-card').first().locator('.bbm-step-plus')
    for (let i = 0; i < size - 1; i++) await firstFlavorPlus.click()
    await expect(modal.locator('.bbm-progress-count')).toHaveText(`${size - 1} / ${size} pieces`)
    await expect(modal).toContainText('Select 1 more')
    // Last piece goes on a second flavor when one exists
    const flavorCards = modal.locator('.bbm-card')
    const lastPlus = (await flavorCards.count()) > 1
      ? flavorCards.nth(1).locator('.bbm-step-plus')
      : firstFlavorPlus
    await lastPlus.click()
    await expect(modal.locator('.bbm-progress-count')).toHaveText(`${size} / ${size} pieces`)
    await expect(modal).toContainText('Box complete!')
    // Cannot exceed the box size
    await expect(modal.locator('.bbm-card').first().locator('.bbm-step-plus')).toBeDisabled()
  })

  await test.step('modal shows the effective (sale-aware) price', async () => {
    // Regression guard: boxes must respect an active sale like products do
    await expect(modal.locator('.bbm-price')).toContainText(String(price))
  })

  await test.step('add the completed box to cart', async () => {
    await modal.getByRole('button', { name: 'Add to Cart' }).click()
    await expect(page.getByText(`${box.name} added to cart!`)).toBeVisible()
    await page.goto('/checkout')
    const line = page.locator('.summary-item').filter({ hasText: box.name })
    await expect(line).toContainText('BOX')
    await expect(line).toContainText(`${price} EGP`)
  })
})

test('single-flavor box (cheesecake/tiramisu behavior)', async ({ page }) => {
  const catalog = await loadCatalog()
  const box = singleFlavorBox(catalog)
  test.skip(!box, 'No cheesecake/tiramisu box exists in the catalog — needs manual check once one is added')

  await page.goto('/shop?cat=boxes')
  await clearCartStorage(page)
  const boxCard = page.locator('.product-card').filter({ hasText: box.name })
  await expect(boxCard).toBeVisible({ timeout: 20_000 })
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

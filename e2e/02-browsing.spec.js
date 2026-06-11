import { test, expect } from '@playwright/test'

/** BROWSING: home page, Shop main tabs + sub-filters. */

test('home page loads with hero and sections', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.hero-btn-main')).toBeVisible()
  await expect(page.locator('.hero-btn-main')).toContainText('Order Now')
  await expect(page.locator('.hero-btn-outline')).toContainText('New Items')
  // Hero CTA navigates to shop
  await page.locator('.hero-btn-main').click()
  await expect(page).toHaveURL(/\/shop/)
})

test('shop tabs: All / New / Bites / Boxes with sub-filters', async ({ page }) => {
  await page.goto('/shop')

  await test.step('All tab shows products', async () => {
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })
    expect(await page.locator('.product-card').count()).toBeGreaterThan(0)
  })

  await test.step('New tab shows only new items', async () => {
    await page.getByRole('button', { name: 'New', exact: true }).click()
    // Settle the transition in order: first the stale grid disappears (Brownie is
    // not a new item), then the NEW grid renders (Louts Cookie is). Only after the
    // second wait is the grid final — counting earlier reads a transitional state.
    await expect(page.locator('.product-card').filter({ hasText: 'Brownie' })).toHaveCount(0, { timeout: 20_000 })
    await expect(page.locator('.product-card').filter({ hasText: 'Louts Cookie' })).toBeVisible({ timeout: 20_000 })
    const cards = page.locator('.product-card')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i).locator('.badge-new')).toBeVisible()
    }
  })

  await test.step('Bites tab shows sub-filters and no boxes', async () => {
    await page.getByRole('button', { name: 'Bites' }).click()
    await expect(page.getByRole('button', { name: 'All Bites' })).toBeVisible()
    // Settle: previous (New) grid had the box "12 pices Cookie"; Tiramisu only exists in Bites
    await expect(page.locator('.product-card').filter({ hasText: '12 pices Cookie' })).toHaveCount(0, { timeout: 20_000 })
    await expect(page.locator('.product-card').filter({ hasText: 'Tiramisu' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Build Your Box' })).toHaveCount(0)
  })

  await test.step('Bites → Cookies sub-filter', async () => {
    await page.getByRole('button', { name: 'Cookies' }).click()
    // Settle: Tiramisu (in Bites) disappears, then a known cookie renders
    await expect(page.locator('.product-card').filter({ hasText: 'Tiramisu' })).toHaveCount(0, { timeout: 20_000 })
    await expect(page.locator('.product-card').filter({ hasText: 'Louts Cookie' })).toBeVisible({ timeout: 20_000 })
    // Every visible card is a cookie bite
    const cats = page.locator('.product-card .product-card-category')
    const count = await cats.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(cats.nth(i)).toContainText('Cookies')
    }
  })

  await test.step('Boxes tab shows only boxes', async () => {
    await page.getByRole('button', { name: 'Boxes' }).click()
    await expect(page.getByRole('button', { name: 'All Boxes' })).toBeVisible()
    // Settle: cookie bites disappear, then a known box renders
    await expect(page.locator('.product-card').filter({ hasText: 'Louts Cookie' })).toHaveCount(0, { timeout: 20_000 })
    await expect(page.locator('.product-card').filter({ hasText: '12 pices Cookie' })).toBeVisible({ timeout: 20_000 })
    const cards = page.locator('.product-card')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    // All box cards offer the box-builder flow
    await expect(page.getByRole('button', { name: 'Build Your Box' })).toHaveCount(count)
  })

  await test.step('Boxes → Cookies sub-filter', async () => {
    await page.getByRole('button', { name: 'Cookies' }).click()
    await expect(page.locator('.product-card').filter({ hasText: '12 pices Cookie' })).toBeVisible({ timeout: 20_000 })
    const cats = page.locator('.product-card .product-card-category')
    const count = await cats.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(cats.nth(i)).toContainText('Gift Box')
    }
  })
})

// The app has no per-product detail route (cards are the full product view),
// so "product detail pages" cannot be tested. Card content is asserted instead.
test('product cards show full product info (no detail pages exist in this app)', async ({ page }) => {
  await page.goto('/shop')
  const card = page.locator('.product-card').filter({ hasText: 'Tiramisu' }).first()
  await expect(card).toBeVisible({ timeout: 20_000 })
  await expect(card.locator('.product-card-name')).toBeVisible()
  await expect(card.locator('.product-card-category')).toBeVisible()
  await expect(card).toContainText('EGP')
})

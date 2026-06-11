import { test, expect } from '@playwright/test'
import { settleGrid } from './helpers.js'
import { loadCatalog, plainProducts, countingBox, newItem } from './fixtures.js'

/** BROWSING: home page, Shop main tabs + sub-filters — driven by the LIVE catalog. */

test('home page loads with hero and sections', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.hero-btn-main')).toBeVisible()
  await expect(page.locator('.hero-btn-main')).toContainText('Order Now')
  await expect(page.locator('.hero-btn-outline')).toContainText('New Items')
  // Hero CTA navigates to shop
  await page.locator('.hero-btn-main').click()
  await expect(page).toHaveURL(/\/shop/)
})

test('shop tabs: All / New / Products / Bites / Boxes with sub-filters', async ({ page }) => {
  const catalog = await loadCatalog()
  const plains  = plainProducts(catalog)
  const box     = countingBox(catalog)
  test.skip(plains.length === 0, 'No plain products in the live catalog')

  const anyPlain  = plains[0]
  const cookie    = plains.find(p => p.category === 'cookies')
  const nonCookie = plains.find(p => p.category !== 'cookies')

  await page.goto('/shop')

  await test.step('All tab shows products', async () => {
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })
    expect(await page.locator('.product-card').count()).toBeGreaterThan(0)
  })

  await test.step('New tab shows only new items', async () => {
    const aNew    = newItem(catalog)
    const nonNew  = plains.find(p => !p.isNew)
    await page.getByRole('button', { name: 'New', exact: true }).click()
    await settleGrid(page, { absent: nonNew?.name, present: aNew?.name, emptyOk: !aNew })
    if (!aNew) {
      await expect(page.locator('.empty-state')).toBeVisible()
      return // nothing is marked NEW right now — empty state is the correct render
    }
    const cards = page.locator('.product-card')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i).locator('.badge-new')).toBeVisible()
    }
  })

  await test.step('Products tab shows products AND boxes (no bites)', async () => {
    await page.getByRole('button', { name: 'Products', exact: true }).click()
    await expect(page.getByRole('button', { name: 'All Products' })).toBeVisible()
    const nonNew = plains.find(p => !p.isNew) || anyPlain
    await settleGrid(page, { present: nonNew.name })
    if (box) {
      // Boxes now appear in the Products tab too, keeping their box-builder flow
      await expect(page.locator('.product-card').filter({ hasText: box.name })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Build Your Box' }).first()).toBeVisible()
    }
    // No bite cards in the Products tab
    await expect(page.locator('.product-card .product-card-category').filter({ hasText: 'Bite ·' })).toHaveCount(0)
  })

  await test.step('Products → Cookies sub-filter', async () => {
    if (!cookie) {
      test.info().annotations.push({ type: 'skipped-step', description: 'No cookie products in the live catalog' })
      return
    }
    await page.getByRole('button', { name: 'Cookies' }).click()
    await settleGrid(page, { absent: nonCookie?.name, present: cookie.name })
    const cats = page.locator('.product-card .product-card-category')
    const count = await cats.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(cats.nth(i)).toContainText('Cookies')
    }
  })

  await test.step('Bites tab shows only type:bite items (Cookies/Brownies sub-filters)', async () => {
    await page.getByRole('button', { name: 'Bites', exact: true }).click()
    await expect(page.getByRole('button', { name: 'All Bites' })).toBeVisible()
    // Bites only sub-filter by Cookies and Brownies
    const subRow = page.locator('.category-tabs').nth(1)
    await expect(subRow.getByRole('button', { name: 'Cookies' })).toBeVisible()
    await expect(subRow.getByRole('button', { name: 'Brownies' })).toBeVisible()
    await expect(subRow.getByRole('button', { name: 'Cheesecake' })).toHaveCount(0)
    await expect(subRow.getByRole('button', { name: 'Tiramisu' })).toHaveCount(0)
    // The grid may legitimately be empty until the admin adds bites
    await settleGrid(page, { absent: cookie?.name || anyPlain.name, emptyOk: true })
    const nonBite = page.locator('.product-card').filter({ hasNotText: 'Bite ·' })
    await expect(nonBite).toHaveCount(0)
  })

  await test.step('Boxes tab shows only boxes', async () => {
    if (!box) {
      test.info().annotations.push({ type: 'skipped-step', description: 'No counting box in the live catalog' })
      return
    }
    await page.getByRole('button', { name: 'Boxes' }).click()
    await expect(page.getByRole('button', { name: 'All Boxes' })).toBeVisible()
    await settleGrid(page, { absent: anyPlain.name, present: box.name })
    const cards = page.locator('.product-card')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    // All box cards offer the box-builder flow
    await expect(page.getByRole('button', { name: 'Build Your Box' })).toHaveCount(count)
  })
})

// The app has no per-product detail route (cards are the full product view),
// so "product detail pages" cannot be tested. Card content is asserted instead.
test('product cards show full product info (no detail pages exist in this app)', async ({ page }) => {
  const catalog = await loadCatalog()
  const plains  = plainProducts(catalog)
  test.skip(plains.length === 0, 'No plain products in the live catalog')
  await page.goto('/shop')
  const card = page.locator('.product-card').filter({ hasText: plains[0].name }).first()
  await expect(card).toBeVisible({ timeout: 20_000 })
  await expect(card.locator('.product-card-name')).toBeVisible()
  await expect(card.locator('.product-card-category')).toBeVisible()
  await expect(card).toContainText('EGP')
})

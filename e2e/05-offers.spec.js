import { test, expect } from '@playwright/test'
import { clearCartStorage, escapeRegex } from './helpers.js'
import { loadCatalog, activeOffer, plainProducts, effectivePrice } from './fixtures.js'

/** OFFERS: BOGO (boxes excluded) and Buy-Box-Get-Item-Free with FREE gift verification. */

function offerEligibleIds(offer) {
  if (offer?.productIds?.length) return offer.productIds
  if (offer?.productId) return [offer.productId]
  return []
}

test('BOGO offer: products only, cheapest free at checkout', async ({ page }) => {
  const catalog = await loadCatalog()
  const offer = activeOffer(catalog, 'buy1get1')
  test.skip(!offer, 'No active buy1get1 offer in the live store')

  const eligibleIds = offerEligibleIds(offer)
  const pickable = plainProducts(catalog).filter(p => eligibleIds.length === 0 || eligibleIds.includes(p.id))
  test.skip(pickable.length === 0, 'The buy1get1 offer has no eligible plain products')
  const item  = pickable[0]
  const price = effectivePrice(item)
  const boxNames = catalog.products.filter(p => p.type === 'box').map(p => p.name)

  await page.goto('/offers')
  await clearCartStorage(page)

  const offerCard = page.locator('div').filter({ has: page.getByRole('heading', { name: offer.title }) }).last()
  await offerCard.getByRole('button', { name: 'Select Products →' }).click()

  const modal = page.locator('.offer-picker-modal')
  await expect(modal).toBeVisible()
  await expect(modal.getByText('cheapest becomes free')).toBeVisible()

  await test.step('boxes are NOT selectable in the picker', async () => {
    await expect(modal.getByText('Loading products...')).toHaveCount(0, { timeout: 20_000 })
    await expect(modal.getByText(item.name)).toBeVisible()
    for (const boxName of boxNames) {
      await expect(modal.getByText(boxName, { exact: true })).toHaveCount(0)
    }
  })

  await test.step('select 2 items and confirm', async () => {
    const tile = modal.locator('div').filter({ hasText: new RegExp(`^${escapeRegex(item.name)}`) }).last()
    await tile.getByRole('button').nth(1).click() // +
    await tile.getByRole('button').nth(1).click() // +
    await modal.getByRole('button', { name: 'Confirm Selection' }).click()
    await expect(page).toHaveURL(/\/checkout/)
  })

  await test.step('checkout shows the offer and the correct discount', async () => {
    await expect(page.getByText(`Offer applied: ${offer.title}`)).toBeVisible()
    const offerSection = page.locator('.checkout-section').filter({ hasText: 'Applied Offer' })
    await expect(offerSection).toContainText(offer.title)
    await expect(offerSection.getByText('FREE', { exact: true })).toBeVisible()
    // Discount = cheapest unit (both units are the same product here)
    const discountRow = page.locator('.summary-row').filter({ hasText: offer.title })
    await expect(discountRow).toContainText(`−${price} EGP`)
    // 2×price − price + 85 delivery
    await expect(page.locator('.summary-row.total')).toContainText(`${price + 85} EGP`)
  })
})

test('Buy Box Get Item Free: box → flavors → free item', async ({ page }) => {
  const catalog = await loadCatalog()
  const offer = activeOffer(catalog, 'box_gift')
  test.skip(!offer, 'No active box_gift offer in the live store')

  const eligibleIds = offerEligibleIds(offer)
  const boxes = catalog.products.filter(p =>
    p.type === 'box' && p.available !== false &&
    ['cookies', 'brownies'].includes(p.category) && (p.boxSize ?? 0) >= 2 &&
    (eligibleIds.length === 0 || eligibleIds.includes(p.id)) &&
    // its flavor picker must have something to pick
    catalog.products.some(f => !f.type && f.available !== false && f.category === p.category)
  )
  test.skip(boxes.length === 0, 'The box_gift offer has no eligible multi-piece box')
  const box = boxes[0]

  const giftIds = offer.giftProductIds?.length ? offer.giftProductIds : null
  const gifts = plainProducts(catalog).filter(p => !giftIds || giftIds.includes(p.id))
  test.skip(gifts.length === 0, 'The box_gift offer has no eligible gift items')
  const gift = gifts[0]
  const giftPrice = effectivePrice(gift)

  await page.goto('/offers')
  await clearCartStorage(page)

  const offerCard = page.locator('div').filter({ has: page.getByRole('heading', { name: offer.title }) }).last()
  await offerCard.getByRole('button', { name: 'Select Products →' }).click()

  const modal = page.locator('.offer-picker-modal')

  await test.step('step 1: choose the box (skipped if only one is eligible)', async () => {
    // With a single eligible box the modal jumps straight to the flavor picker
    const bbm = page.locator('.box-builder-modal')
    const boxStep = modal.getByText('Step 1 — choose your box')
    await expect(boxStep.or(bbm)).toBeVisible({ timeout: 20_000 })
    if (await boxStep.isVisible()) {
      await expect(modal.getByText('Loading products...')).toHaveCount(0, { timeout: 20_000 })
      await modal.getByText(box.name).first().click()
    }
  })

  await test.step('step 2: flavor picker opens — fill the box', async () => {
    const bbm = page.locator('.box-builder-modal')
    await expect(bbm).toBeVisible()
    const plus = bbm.locator('.bbm-card').first().locator('.bbm-step-plus')
    for (let i = 0; i < box.boxSize; i++) await plus.click()
    await bbm.getByRole('button', { name: 'Add to Cart' }).click()
  })

  await test.step('step 3: pick the free item (shown as FREE)', async () => {
    await expect(modal.getByText('pick ONE item — it’s on us')).toBeVisible()
    const giftTile = modal.locator('div')
      .filter({ hasText: new RegExp(`^${escapeRegex(gift.name)}`) })
      .filter({ hasText: 'FREE' })
      .last()
    await expect(giftTile).toContainText(`${giftPrice} EGP`) // struck-through price
    await giftTile.click()
    await modal.getByRole('button', { name: 'Confirm Free Gift' }).click()
    await expect(page).toHaveURL(/\/checkout/)
  })

  await test.step('checkout: gift is FREE and discount equals its price', async () => {
    const offerSection = page.locator('.checkout-section').filter({ hasText: 'Applied Offer' })
    await expect(offerSection).toContainText(offer.title)
    await expect(offerSection).toContainText(gift.name)
    await expect(offerSection.getByText('FREE', { exact: true })).toBeVisible()
    const discountRow = page.locator('.summary-row').filter({ hasText: offer.title })
    await expect(discountRow).toContainText(`−${giftPrice} EGP`)
    // box + gift − gift + delivery
    await expect(page.locator('.summary-row.total')).toContainText(`${effectivePrice(box) + 85} EGP`)
  })
})

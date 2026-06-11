import { test, expect } from '@playwright/test'
import { clearCartStorage, addBite, productCard } from './helpers.js'
import { loadCatalog, pickTwoProducts, productWithExtras, biteProduct, activeFlavors, effectivePrice } from './fixtures.js'

/** CART — PRODUCTS: quantities, qty update, removal, and the extras picker. */

test('add products, update quantity, remove item', async ({ page }) => {
  const catalog = await loadCatalog()
  const pair = pickTwoProducts(catalog)
  test.skip(!pair, 'Need at least two plain products in the live catalog')
  const [A, B] = pair
  const priceA = effectivePrice(A)
  const priceB = effectivePrice(B)

  await page.goto('/shop')
  await clearCartStorage(page)
  await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })

  await test.step(`add ${A.name} ×2 and ${B.name} ×1`, async () => {
    await addBite(page, A.name, 2)
    await addBite(page, B.name, 1)
    await expect(page.locator('.cart-btn .cart-badge').first()).toHaveText('3')
  })

  await test.step('checkout summary shows correct lines and totals', async () => {
    await page.goto('/checkout')
    const lineA = page.locator('.summary-item').filter({ hasText: A.name })
    const lineB = page.locator('.summary-item').filter({ hasText: B.name })
    await expect(lineA.locator('.qty-value-mini')).toHaveText('2')
    await expect(lineB.locator('.qty-value-mini')).toHaveText('1')
    const subtotal = priceA * 2 + priceB
    await expect(page.locator('.summary-row').filter({ hasText: 'Subtotal' })).toContainText(`${subtotal} EGP`)
    await expect(page.locator('.summary-row.total')).toContainText(`${subtotal + 85} EGP`)
  })

  await test.step(`increase ${A.name} quantity to 3`, async () => {
    const lineA = page.locator('.summary-item').filter({ hasText: A.name })
    await lineA.locator('.qty-btn-mini').nth(1).click()
    await expect(lineA.locator('.qty-value-mini')).toHaveText('3')
    await expect(page.locator('.summary-row').filter({ hasText: 'Subtotal' })).toContainText(`${priceA * 3 + priceB} EGP`)
  })

  await test.step(`remove ${B.name} from cart`, async () => {
    const lineB = page.locator('.summary-item').filter({ hasText: B.name })
    await lineB.locator('.qty-btn-mini').first().click() // qty 1 → minus removes
    await expect(page.getByText(`${B.name} removed`)).toBeVisible()
    await expect(page.locator('.summary-item').filter({ hasText: B.name })).toHaveCount(0)
    await expect(page.locator('.summary-row').filter({ hasText: 'Subtotal' })).toContainText(`${priceA * 3} EGP`)
  })
})

test('bite purchase requires choosing exactly one flavor', async ({ page }) => {
  const catalog = await loadCatalog()
  const bite    = biteProduct(catalog)
  const flavors = activeFlavors(catalog)
  test.skip(!bite, 'No type:bite item in the live catalog')
  test.skip(flavors.length === 0, 'No active flavors — the bite picker only requires a flavor when flavors exist')
  const price = effectivePrice(bite)

  await page.goto('/shop?cat=bites')
  await clearCartStorage(page)
  const card = productCard(page, bite.name)
  await expect(card).toBeVisible({ timeout: 20_000 })
  await card.getByRole('button', { name: 'Add to Cart' }).click()

  const modal = page.locator('.box-builder-modal')
  await expect(modal).toBeVisible()

  await test.step('add is blocked until a flavor is picked', async () => {
    await expect(modal.getByRole('button', { name: 'Pick a flavor' })).toBeDisabled()
    await modal.locator('.exm-extra').filter({ hasText: flavors[0].name }).first().click()
    await expect(modal.getByRole('button', { name: `Add item — ${price} EGP` })).toBeEnabled()
  })

  await test.step('chosen flavor shows on the cart line', async () => {
    await modal.getByRole('button', { name: `Add item — ${price} EGP` }).click()
    await page.goto('/checkout')
    const line = page.locator('.summary-item').filter({ hasText: bite.name })
    await expect(line).toContainText(`Flavor: ${flavors[0].name}`)
    await expect(line).toContainText(`${price} EGP`)
  })
})

test('product with extras opens the extras picker and prices the add-ons', async ({ page }) => {
  const catalog = await loadCatalog()
  const product = productWithExtras(catalog)
  test.skip(!product, 'No product has active extras assigned in the live catalog')

  const base  = effectivePrice(product)
  const extra = catalog.extras.find(x => product.extraIds.includes(x.id) && x.active !== false)

  await page.goto('/shop')
  await clearCartStorage(page)
  await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 20_000 })

  const card = productCard(page, product.name)
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Add to Cart' }).click()

  const modal = page.locator('.box-builder-modal')
  await expect(modal).toBeVisible()
  await expect(modal.locator('.exm-row-name')).toHaveText('Quantity')

  await test.step('selecting an extra updates the live total', async () => {
    await expect(modal.getByRole('button', { name: `Add item — ${base} EGP` })).toBeVisible()
    await modal.locator('.exm-extra').filter({ hasText: extra.name }).click()
    await expect(modal.getByRole('button', { name: `Add item — ${base + extra.price} EGP` })).toBeVisible()
    // Quantity stepper multiplies the total
    await modal.locator('.bbm-step-plus').click()
    await expect(modal.getByRole('button', { name: `Add 2 items — ${(base + extra.price) * 2} EGP` })).toBeVisible()
    await modal.locator('.bbm-step-btn').first().click() // back to 1
  })

  await test.step('cart line shows the chosen extra and its price', async () => {
    await modal.getByRole('button', { name: `Add item — ${base + extra.price} EGP` }).click()
    await page.goto('/checkout')
    const line = page.locator('.summary-item').filter({ hasText: product.name })
    await expect(line).toContainText(`+ ${extra.name} (+${extra.price} EGP)`)
    await expect(line).toContainText(`${base + extra.price} EGP`)
    await expect(page.locator('.summary-row').filter({ hasText: 'Subtotal' })).toContainText(`${base + extra.price} EGP`)
  })
})

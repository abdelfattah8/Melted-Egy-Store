import { expect } from '@playwright/test'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE       = path.dirname(fileURLToPath(import.meta.url))
const STATE_FILE = path.join(HERE, '.run-state.json')

// ── Run state (shared between serially-run spec files) ──────────────────────
export function loadState() {
  if (!existsSync(STATE_FILE)) return null
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')) } catch { return null }
}

export function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

export function recordOrder(order) {
  const state = loadState() || {}
  state.orders = state.orders || []
  state.orders.push(order)
  saveState(state)
}

export function newRunCreds() {
  const runId = Date.now()
  return {
    runId,
    email:    `e2e.test.melted.${runId}@example-test.com`, // clearly marked, never receives mail
    password: `E2E-test-${runId}!`,
    name:     'E2E TEST Customer',
    phone:    '01000000000',
    address:  'E2E TEST — 1 Test Street, Test Area',
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export async function registerViaUI(page, creds) {
  await page.goto('/register')
  await page.getByPlaceholder('Your name').fill(creds.name)
  await page.getByPlaceholder('01xxxxxxxxx').fill(creds.phone)
  await page.getByPlaceholder('you@example.com').fill(creds.email)
  await page.getByPlaceholder('Min. 6 characters').fill(creds.password)
  await page.getByPlaceholder('Area, Street, Building number...').fill(creds.address)
  await page.getByRole('button', { name: 'Create Account' }).click()
  await expect(page.getByText('Account created! Welcome to Melted')).toBeVisible({ timeout: 20_000 })
  await expect(page).toHaveURL('/')
}

export async function loginViaUI(page, creds) {
  await page.goto('/login')
  await page.getByPlaceholder('you@example.com').fill(creds.email)
  await page.getByPlaceholder('••••••••').fill(creds.password)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.getByText('Welcome back! 🎉')).toBeVisible({ timeout: 20_000 })
}

/** Login with this run's account; registers it first if 01-auth didn't run. */
export async function ensureLoggedIn(page) {
  let state = loadState()
  if (!state?.email) {
    const creds = newRunCreds()
    saveState({ ...creds, orders: [] })
    await registerViaUI(page, creds)
    return creds
  }
  await loginViaUI(page, state)
  return state
}

// ── Cart ─────────────────────────────────────────────────────────────────────
export async function clearCartStorage(page) {
  // Must be on the app origin before touching localStorage
  await page.evaluate(() => {
    localStorage.removeItem('melted_cart')
    localStorage.removeItem('melted_offer')
    localStorage.removeItem('melted_promo')
  })
  await page.reload()
}

/**
 * Locate a product card by name (+ optional extra text like a price to
 * disambiguate duplicates, e.g. the two "Classic Cookie" products).
 */
export function productCard(page, name, extraText) {
  let card = page.locator('.product-card').filter({ hasText: name })
  if (extraText) card = card.filter({ hasText: extraText })
  return card.first()
}

/** Add a plain bite (no extras flow) with the given quantity via its card stepper. */
export async function addBite(page, name, qty, extraText) {
  const card = productCard(page, name, extraText)
  await expect(card).toBeVisible()
  const plus = card.locator('.qty-btn').nth(1)
  for (let i = 0; i < qty; i++) await plus.click()
  await card.getByRole('button', { name: `Add ${qty} to Cart` }).click()
  await expect(page.getByText(`${qty} × `, { exact: false }).first()).toBeVisible()
}

// ── Checkout ─────────────────────────────────────────────────────────────────
export async function fillCheckoutContact(page, creds) {
  // Fields are prefilled for logged-in users; (re)fill to be deterministic
  await page.getByPlaceholder('Your name').fill(creds.name)
  await page.getByPlaceholder('01xxxxxxxxx').fill(creds.phone)
  await page.getByPlaceholder('you@example.com').fill(creds.email)
  await page.getByPlaceholder('Area, Street, Building number...').fill(creds.address)
  await page.getByPlaceholder('Any special instructions, allergies, or requests...')
    .fill('E2E TEST ORDER — please ignore / delete')
}

/** A tiny but valid 1×1 white JPEG for payment-proof uploads. */
export function tinyJpegBuffer() {
  const b64 =
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy' +
    'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA' +
    'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA' +
    'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3' +
    'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm' +
    'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMB' +
    'AAIRAxEAPwD3+iiigD//2Q=='
  return Buffer.from(b64, 'base64')
}

export async function uploadProof(page) {
  // Both deposit and transfer sections use the same hidden file input markup
  await page.locator('.upload-area-v2 input[type="file"]').last().setInputFiles({
    name: 'e2e-test-proof.jpg',
    mimeType: 'image/jpeg',
    buffer: tinyJpegBuffer(),
  })
  // Preview replaces the placeholder once the file is read
  await expect(page.locator('.upload-area-v2 img').last()).toBeVisible()
}

export async function placeOrderAndCaptureId(page, expectedTitle) {
  await page.getByRole('button', { name: 'Place Order' }).click()
  await expect(page).toHaveURL(/\/order-success/, { timeout: 45_000 })
  await expect(page.getByRole('heading', { name: expectedTitle })).toBeVisible()
  const idText = await page.getByText('Order ID:').textContent()
  return idText?.replace('Order ID:', '').trim() || '(unknown)'
}

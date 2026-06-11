import { test, expect } from '@playwright/test'
import { newRunCreds, saveState, registerViaUI, loginViaUI } from './helpers.js'

/**
 * AUTH: signup → logout → login, in one test so the session carries through.
 * Creates this run's dedicated test account (e2e.test.melted.<runId>@example-test.com)
 * and stores the creds for the later specs.
 */
test('signup, logout, and login again', async ({ page }) => {
  const creds = newRunCreds()
  saveState({ ...creds, orders: [] })

  await test.step('create a new account', async () => {
    await registerViaUI(page, creds)
    // Logged-in navbar state
    await expect(page.locator('.navbar .nav-logout-btn').first()).toBeVisible()
  })

  await test.step('log out', async () => {
    await page.locator('.navbar .nav-logout-btn').first().click()
    await expect(page.getByText('Logged out successfully')).toBeVisible()
    await expect(page.locator('.navbar-actions').getByRole('link', { name: 'Sign In' })).toBeVisible()
  })

  await test.step('log back in', async () => {
    await loginViaUI(page, creds)
    await expect(page.locator('.navbar .nav-logout-btn').first()).toBeVisible()
  })
})

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:\\Users\\DELL\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const BASE   = 'http://localhost:5176';
const SS     = (name) => path.join(__dirname, `ss-${name}.png`);

const log  = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => console.log(`  ❌ ${msg}`);

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

async function shot(name) {
  await page.screenshot({ path: SS(name), fullPage: false });
}

// ── 1. Home page loads ────────────────────────────────────────────────────────
console.log('\n[1] Home page');
await page.goto(BASE, { waitUntil: 'load' });
await shot('1-home');
const title = await page.title();
log(`Page title: ${title}`);

// ── 2. Offers section on Home ─────────────────────────────────────────────────
console.log('\n[2] Home offers section');
const homeOfferCards = await page.locator('section').filter({ hasText: 'Sweet Deals' }).locator('[style*="cursor: pointer"]').all();
if (homeOfferCards.length === 0) {
  fail('No offer cards found on Home — may be no active offers in Firestore');
} else {
  log(`Found ${homeOfferCards.length} offer card(s) on Home`);
  await homeOfferCards[0].scrollIntoViewIfNeeded();
  await shot('2-home-offers');
}

// ── 3. Offers page ────────────────────────────────────────────────────────────
console.log('\n[3] Offers page');
await page.goto(`${BASE}/offers`, { waitUntil: 'load' });
await shot('3-offers-page');

const offerCards = await page.locator('[style*="borderRadius: var(--radius)"][style*="cursor: pointer"]').all();
log(`Found ${offerCards.length} offer card(s) on /offers`);

// ── 4. Click a buy1get1 / buy2get1 offer to open modal ───────────────────────
console.log('\n[4] Clicking first offer that requires selection');
const applyBtns = await page.locator('button:has-text("Select Products")').all();
const directBtns = await page.locator('button:has-text("Apply Offer")').all();

if (applyBtns.length > 0) {
  log(`Found ${applyBtns.length} "Select Products" button(s) — clicking first`);
  await applyBtns[0].click();
  await page.waitForTimeout(2000);
  await shot('4-modal-open');

  // Check modal header
  const modalHeader = await page.locator('[style*="zIndex: 1000"]').first();
  if (await modalHeader.isVisible()) {
    log('Modal overlay is visible');
    const headerText = await page.locator('[style*="zIndex: 1000"] [style*="fontWeight: 700"]').first().textContent();
    log(`Modal title: "${headerText?.trim()}"`);
  } else {
    fail('Modal overlay not visible');
  }

  // Check product cards in modal
  const prodCards = await page.locator('[style*="zIndex: 1000"] [style*="borderRadius: 10"]').all();
  log(`Product cards in modal: ${prodCards.length}`);
  await shot('4b-modal-products');

  // Check confirm button is disabled
  const confirmBtn = await page.locator('button:has-text("Select")').or(page.locator('button:has-text("Confirm Selection")')).last();
  const disabled = await confirmBtn.isDisabled();
  log(`Confirm button disabled before selection: ${disabled}`);

  // Select products
  if (prodCards.length >= 2) {
    log('Clicking first product card');
    await prodCards[0].click();
    await page.waitForTimeout(400);
    await shot('4c-one-selected');

    const oneSelected = await page.locator('[style*="zIndex: 1000"] [style*="background: var(--brown)"][style*="color: white"]').first();
    if (await oneSelected.isVisible()) log('Checkmark badge visible after first selection');

    log('Clicking second product card');
    await prodCards[1].click();
    await page.waitForTimeout(400);
    await shot('4d-two-selected');

    const allSelectedText = await page.locator('[style*="zIndex: 1000"]').locator('text=All items selected').count();
    if (allSelectedText > 0) log('Header shows "All items selected" ✓');
    else fail('"All items selected" text not found');

    // Confirm button should be enabled now
    const confirmEnabled = !(await confirmBtn.isDisabled());
    log(`Confirm button enabled after selecting required items: ${confirmEnabled}`);

    // Click confirm → should navigate to /checkout
    log('Clicking Confirm Selection');
    await confirmBtn.click();
    await page.waitForTimeout(2000);
    await shot('4e-after-confirm');

    const url = page.url();
    if (url.includes('/checkout')) {
      log(`Navigated to checkout: ${url}`);
    } else {
      fail(`Expected /checkout but got: ${url}`);
    }
  } else if (prodCards.length === 1) {
    log('Only 1 product in modal (offer has productId restriction)');
    await prodCards[0].click();
    await page.waitForTimeout(400);
    // can't reach required count of 2 with 1 product — expected
    log('(Single-product offer — cannot reach required count without adding more qty)');
    await page.locator('button:has-text("Cancel")').click();
    await page.waitForTimeout(500);
  } else {
    fail('No product cards in modal — Firestore may have no available products');
    await page.locator('button:has-text("Cancel")').click();
  }
} else if (directBtns.length > 0) {
  log(`No "Select Products" buttons — only "Apply Offer" (free_delivery / custom offers only)`);
  log('Clicking first "Apply Offer" button');
  await directBtns[0].click();
  await page.waitForTimeout(2000);
  await shot('4-direct-apply');
  const url = page.url();
  if (url.includes('/checkout')) log(`Navigated to checkout: ${url}`);
  else fail(`Expected /checkout but got: ${url}`);
} else {
  fail('No offer buttons found — no active offers in Firestore');
}

// ── 5. Checkout page: read-only offer banner ─────────────────────────────────
console.log('\n[5] Checkout page offer banner');
await page.goto(`${BASE}/checkout`, { waitUntil: 'load' });
await shot('5-checkout');

const offerBanner = await page.locator('h3:has-text("Applied Offer")').count();
const noBannerLink = await page.locator('text=Browse offers').count();

if (offerBanner > 0) {
  log('Applied Offer banner is present ✓');
  const bannerText = await page.locator('.checkout-section').filter({ hasText: 'Applied Offer' }).first().textContent();
  log(`Banner content snippet: "${bannerText?.replace(/\s+/g,' ').trim().slice(0,120)}"`);

  // Check discount row in summary
  const discountRow = await page.locator('text=−').count();
  if (discountRow > 0) log('Discount row visible in order summary ✓');

  // Check "You saved" banner
  const savedBanner = await page.locator('text=You saved').count();
  if (savedBanner > 0) log('"You saved X EGP" banner visible ✓');

  // Remove offer button
  const removeBtn = await page.locator('button[title="Remove offer"]').count();
  if (removeBtn > 0) log('Remove offer (✕) button present ✓');

  await shot('5b-checkout-with-offer');
} else if (noBannerLink > 0) {
  log('No offer applied — "Browse offers" link shown (correct when no offer in context)');
} else {
  fail('Unexpected state — neither offer banner nor browse link found');
}

// ── 6. Cancel/remove offer flow ───────────────────────────────────────────────
if (offerBanner > 0) {
  console.log('\n[6] Remove offer from checkout');
  await page.locator('button[title="Remove offer"]').click();
  await page.waitForTimeout(500);
  const afterRemove = await page.locator('h3:has-text("Applied Offer")').count();
  const browseLink  = await page.locator('text=Browse offers').count();
  if (afterRemove === 0 && browseLink > 0) log('Offer removed — "Browse offers" link shown ✓');
  else fail('Offer removal did not update UI as expected');
  await shot('6-offer-removed');
}

// ── 7. free_delivery / custom offer from Offers page ─────────────────────────
console.log('\n[7] Testing direct-apply offers (free_delivery / custom)');
await page.goto(`${BASE}/offers`, { waitUntil: 'load' });
const directApplyBtnsOffers = await page.locator('button:has-text("Apply Offer")').all();
if (directApplyBtnsOffers.length > 0) {
  log(`Found ${directApplyBtnsOffers.length} direct-apply offer(s)`);
  await directApplyBtnsOffers[0].click();
  await page.waitForTimeout(2000);
  if (page.url().includes('/checkout')) log('Direct-apply offer navigated to checkout ✓');
  await shot('7-direct-offer-checkout');
} else {
  log('No direct-apply offers found (all offers are buy1get1 / buy2get1)');
}

await browser.close();
console.log('\n── All screenshots saved (ss-*.png) ──');

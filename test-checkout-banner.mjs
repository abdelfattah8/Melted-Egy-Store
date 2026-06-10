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
  args: ['--no-sandbox'],
});
const ctx  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Pre-seed localStorage before each navigation
const MOCK_CART = JSON.stringify([
  { id: 'prod1', name: 'Chocolate Brownie', price: 120, quantity: 2, category: 'brownies', imageUrl: null },
  { id: 'prod2', name: 'Cookie Box',        price: 80,  quantity: 1, category: 'cookies',  imageUrl: null },
]);

// ── Test A: buy1get1 offer banner ─────────────────────────────────────────────
console.log('\n[A] buy1get1 offer banner in checkout');
const MOCK_OFFER_B1G1 = JSON.stringify({
  id: 'offer-test-1',
  title: 'Buy 1 Get 1 Free',
  type: 'buy1get1',
  active: true,
  selectedItems: [
    { id: 'prod1', name: 'Chocolate Brownie', price: 120, imageUrl: null },
    { id: 'prod2', name: 'Cookie Box',        price: 80,  imageUrl: null },
  ],
});

await page.addInitScript(({ cart, offer }) => {
  localStorage.setItem('melted_cart',  cart);
  localStorage.setItem('melted_offer', offer);
}, { cart: MOCK_CART, offer: MOCK_OFFER_B1G1 });

await page.goto(`${BASE}/checkout`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.screenshot({ path: SS('A1-checkout-b1g1'), fullPage: true });

// Check banner
const bannerH3 = await page.locator('h3', { hasText: 'Applied Offer' }).count();
if (bannerH3) log('Applied Offer section heading visible');
else           fail('Applied Offer section heading NOT found');

const bannerTitle = await page.locator('text=Buy 1 Get 1 Free').first().isVisible().catch(() => false);
if (bannerTitle) log('Offer title "Buy 1 Get 1 Free" visible in banner');
else             fail('Offer title not visible');

const freeBadge = await page.locator('text=FREE').count();
if (freeBadge >= 1) log(`"FREE" badge count: ${freeBadge} (cheapest item marked free)`);
else                fail('"FREE" badge not found');

// Discount row in summary
const discountRow = await page.locator('text=−80 EGP').count();
if (discountRow) log('Discount row shows −80 EGP (cheaper of 120 / 80)');
else             fail('Discount row not showing expected amount');

// You saved banner
const savedBanner = await page.locator('text=You saved').count();
if (savedBanner) log('"You saved X EGP" banner present');
else             fail('"You saved" banner missing');

// Remove button
const removeBtn = await page.locator('button[title="Remove offer"]');
if (await removeBtn.count()) log('Remove (✕) button present');
else                         fail('Remove button missing');

// ── Test B: Remove offer clears banner ───────────────────────────────────────
console.log('\n[B] Remove offer updates UI');
await removeBtn.click();
await page.waitForTimeout(600);
await page.screenshot({ path: SS('B1-after-remove'), fullPage: false });

const afterRemoveBanner = await page.locator('h3', { hasText: 'Applied Offer' }).count();
const browseLink        = await page.locator('text=Browse offers').count();
if (!afterRemoveBanner && browseLink) log('Banner gone; "Browse offers →" link shown ✓');
else                                  fail(`Unexpected state after remove — banner:${afterRemoveBanner} link:${browseLink}`);

// Check discount row disappeared
const discountAfter = await page.locator('text=−80 EGP').count();
if (!discountAfter) log('Discount row gone after remove ✓');
else                fail('Discount row still showing after remove');

// ── Test C: free_delivery offer ───────────────────────────────────────────────
console.log('\n[C] free_delivery offer banner');
const MOCK_OFFER_FREE = JSON.stringify({
  id: 'offer-test-2',
  title: 'Free Shipping Weekend',
  type: 'free_delivery',
  active: true,
  selectedItems: [],
});

await page.addInitScript(({ cart, offer }) => {
  localStorage.setItem('melted_cart',  cart);
  localStorage.setItem('melted_offer', offer);
}, { cart: MOCK_CART, offer: MOCK_OFFER_FREE });

await page.goto(`${BASE}/checkout`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.screenshot({ path: SS('C1-free-delivery'), fullPage: true });

const freeDeliveryLabel = await page.locator('text=FREE').count();
if (freeDeliveryLabel) log('Delivery row shows "FREE" ✓');
else                   fail('Delivery row does not show FREE');

const savedDelivery = await page.locator('text=You saved').count();
if (savedDelivery) log('"You saved X EGP on delivery" visible ✓');
else               fail('"You saved" banner missing for free_delivery');

// Total should be subtotal only (no delivery fee)
// subtotal = 120*2 + 80*1 = 320 EGP, delivery = 0 → total = 320
const total320 = await page.locator('text=320 EGP').last().isVisible().catch(() => false);
if (total320) log('Total is 320 EGP (no delivery fee) ✓');
else          fail('Total does not reflect free delivery');

// ── Test D: custom discount offer ─────────────────────────────────────────────
console.log('\n[D] custom discount offer banner');
const MOCK_OFFER_CUSTOM = JSON.stringify({
  id: 'offer-test-3',
  title: '10% Off Everything',
  type: 'custom',
  discountPercent: 10,
  active: true,
  selectedItems: [],
});

await page.addInitScript(({ cart, offer }) => {
  localStorage.setItem('melted_cart',  cart);
  localStorage.setItem('melted_offer', offer);
}, { cart: MOCK_CART, offer: MOCK_OFFER_CUSTOM });

await page.goto(`${BASE}/checkout`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.screenshot({ path: SS('D1-custom-discount'), fullPage: true });

// subtotal = 320, 10% = 32 EGP
const discountRow32 = await page.locator('text=−32 EGP').count();
if (discountRow32) log('Discount row shows −32 EGP (10% of 320) ✓');
else               fail('Custom discount row not showing expected −32 EGP');

// Total = 320 - 32 + 85 = 373 EGP
const total373 = await page.locator('text=373 EGP').last().isVisible().catch(() => false);
if (total373) log('Total is 373 EGP (320 − 32 + 85 delivery) ✓');
else          fail('Total does not reflect custom discount correctly');

// ── Test E: Modal on Offers page (UI structure check) ────────────────────────
console.log('\n[E] Offers page UI + modal trigger structure');
await page.goto(`${BASE}/offers`, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const heroText = await page.locator('text=Pick your offer right here').count();
if (heroText) log('Hero text updated: "Pick your offer right here" ✓');
else          fail('Hero text not updated');

const step1 = await page.locator('text=Pick an Offer').count();
const step2 = await page.locator('text=Add to Cart').count();
if (step1 && step2) log('"How it works" steps updated correctly ✓');
else                fail('"How it works" steps not updated');

await page.screenshot({ path: SS('E1-offers-page'), fullPage: false });

// ── Summary ───────────────────────────────────────────────────────────────────
await browser.close();
console.log('\n── All screenshots saved. ──');

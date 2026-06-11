// Live-catalog fixtures: the store is a REAL production database that the owner
// edits freely, so specs must never hardcode product names/prices. Each spec
// loads the catalog once and picks suitable items — or skips with a clear
// reason when a prerequisite (offer, promo, sale, extras…) doesn't exist.
import { readFileSync } from 'node:fs'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'

function firebaseEnv() {
  return Object.fromEntries(
    readFileSync(new URL('../.env', import.meta.url), 'utf8')
      .split(/\r?\n/)
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
  )
}

let catalogPromise = null

export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const env = firebaseEnv()
      const app = getApps()[0] || initializeApp({
        apiKey:            env.VITE_FIREBASE_API_KEY,
        authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId:         env.VITE_FIREBASE_PROJECT_ID,
        storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId:             env.VITE_FIREBASE_APP_ID,
      })
      const db = getFirestore(app)
      const fetchAll = async name =>
        (await getDocs(collection(db, name))).docs.map(d => ({ id: d.id, ...d.data() }))
      const [products, offers, promoCodes, extras, flavors] = await Promise.all([
        fetchAll('products'), fetchAll('offers'), fetchAll('promoCodes'), fetchAll('extras'), fetchAll('flavors'),
      ])
      return { products, offers, promoCodes, extras, flavors }
    })()
  }
  return catalogPromise
}

export function effectivePrice(p) {
  return p.onSale && p.salePrice && p.salePrice < p.price ? p.salePrice : p.price
}

const isPlain = p => !p.type && p.available !== false
const inStock = p => p.stock == null || p.stock > 50 // plenty for a test run

/**
 * A product name is a safe Playwright `hasText` filter only when no OTHER
 * catalog item's name contains it (case-insensitive substring matching).
 */
function nameIsUnique(p, products) {
  const n = p.name.toLowerCase()
  return products.every(o => o.id === p.id || !o.name.toLowerCase().includes(n))
}

/** Plain products safe to target by name, cheapest first. */
export function plainProducts(catalog) {
  return catalog.products
    .filter(p => isPlain(p) && inStock(p) && nameIsUnique(p, catalog.products) && effectivePrice(p) > 0)
    .sort((a, b) => effectivePrice(a) - effectivePrice(b))
}

/** Two distinct plain products for multi-line cart tests (cheapest two). */
export function pickTwoProducts(catalog) {
  const list = plainProducts(catalog)
  return list.length >= 2 ? [list[0], list[1]] : null
}

/** The product used for ORDER placement — unlimited stock so nothing is decremented. */
export function orderProduct(catalog) {
  return plainProducts(catalog).find(p => p.stock == null) || null
}

/** Highest-priced unlimited-stock plain product — keeps the >1000 EGP deposit order to few clicks. */
export function depositProduct(catalog) {
  const list = plainProducts(catalog).filter(p => p.stock == null)
  return list.length ? list[list.length - 1] : null
}

/** A multi-piece (counting) box whose category has plain products to pick as flavors. */
export function countingBox(catalog) {
  return catalog.products.find(p =>
    p.type === 'box' && p.available !== false && inStock(p) &&
    ['cookies', 'brownies'].includes(p.category) && (p.boxSize ?? 0) >= 2 &&
    nameIsUnique(p, catalog.products) &&
    catalog.products.some(f => isPlain(f) && f.category === p.category)
  ) || null
}

/** A single-flavor box (cheesecake/tiramisu behavior). */
export function singleFlavorBox(catalog) {
  return catalog.products.find(p =>
    p.type === 'box' && p.available !== false && inStock(p) &&
    ['cheesecake', 'tiramisu'].includes(p.category) && nameIsUnique(p, catalog.products)
  ) || null
}

/** A plain product that has assigned extras (for the extras-picker test). */
export function productWithExtras(catalog) {
  return catalog.products.find(p =>
    isPlain(p) && inStock(p) && p.extraIds?.length &&
    p.extraIds.some(id => catalog.extras.find(x => x.id === id && x.active !== false)) &&
    nameIsUnique(p, catalog.products)
  ) || null
}

export function activeOffer(catalog, type) {
  return catalog.offers.find(o => o.active && o.type === type) || null
}

/** An active promo code the given email hasn't redeemed yet. */
export function freshPromo(catalog, email) {
  return catalog.promoCodes.find(c =>
    c.active && !(c.usedBy || []).includes(email.toLowerCase())
  ) || null
}

/** A purchasable bite (type:'bite') safe to target by name. */
export function biteProduct(catalog) {
  return catalog.products.find(p =>
    p.type === 'bite' && p.available !== false && inStock(p) &&
    effectivePrice(p) > 0 && nameIsUnique(p, catalog.products)
  ) || null
}

/** Active flavors (drive the bite flavor picker). */
export function activeFlavors(catalog) {
  return catalog.flavors.filter(f => f.active !== false)
}

/** An item marked isNew (drives the New tab assertion). */
export function newItem(catalog) {
  return catalog.products.find(p => p.isNew && p.available !== false && nameIsUnique(p, catalog.products)) || null
}

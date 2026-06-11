// One-off recon: dump public-read collections so E2E specs can target real data.
// Usage: node e2e/firestore-recon.mjs
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const app = initializeApp({
  apiKey:            env.VITE_FIREBASE_API_KEY,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.VITE_FIREBASE_APP_ID,
})
const db = getFirestore(app)

async function dump(name, fields) {
  const snap = await getDocs(collection(db, name))
  console.log(`\n=== ${name} (${snap.size}) ===`)
  snap.docs.forEach(d => {
    const x = d.data()
    const picked = Object.fromEntries(fields.map(f => [f, x[f]]))
    console.log(d.id, JSON.stringify(picked))
  })
}

await dump('products', ['name', 'price', 'salePrice', 'onSale', 'category', 'type', 'boxSize', 'available', 'stock', 'isNew', 'flavorIds', 'extraIds'])
await dump('offers', ['title', 'type', 'active', 'discountPercent', 'productIds', 'productId', 'giftProductIds'])
await dump('promoCodes', ['code', 'discountPercent', 'active', 'usedBy'])
await dump('flavors', ['name', 'active'])
await dump('extras', ['name', 'price', 'active'])
await dump('settings', ['transferNumber', 'instapayAccount'])
process.exit(0)

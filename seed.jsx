/**
 * SEED SCRIPT — Run once to populate Firebase with default products & settings
 *
 * HOW TO USE:
 * 1. Create your .env file from .env.example
 * 2. Run:  node seed.jsx
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, setDoc, doc } from 'firebase/firestore'
import * as dotenv from 'dotenv'
dotenv.config()

const app = initializeApp({
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
})

const db = getFirestore(app)

const PRODUCTS = [
  // Cookies
  { name: 'Classic Chocolate Chip Cookies', description: 'Soft & chewy cookies loaded with premium chocolate chips (6 pieces)', price: 150, category: 'cookies', available: true, imageUrl: '' },
  { name: 'Nutella Stuffed Cookies',        description: 'Soft cookies with a gooey Nutella center that melts in your mouth (6 pieces)', price: 180, category: 'cookies', available: true, imageUrl: '' },
  { name: 'Double Chocolate Cookies',       description: 'Rich double chocolate cookies for the ultimate chocoholic (6 pieces)', price: 170, category: 'cookies', available: true, imageUrl: '' },

  // Brownies
  { name: 'Classic Fudgy Brownies',  description: 'Dense, fudgy dark chocolate brownies with a crinkle top (9 pieces)', price: 200, category: 'brownies', available: true, imageUrl: '' },
  { name: 'Nutella Swirl Brownies',  description: 'Fudgy brownies with a Nutella swirl throughout (9 pieces)', price: 230, category: 'brownies', available: true, imageUrl: '' },

  // Cheesecake
  { name: 'Classic New York Cheesecake', description: 'Creamy, smooth New York-style cheesecake on a buttery biscuit base (whole)', price: 400, category: 'cheesecake', available: true, imageUrl: '' },
  { name: 'Lotus Biscoff Cheesecake',    description: 'Velvety cheesecake with Lotus spread drizzle & Biscoff crumble (whole)', price: 450, category: 'cheesecake', available: true, imageUrl: '' },
  { name: 'Cheesecake Slice',            description: 'Single slice of our signature creamy cheesecake', price: 120, category: 'cheesecake', available: true, imageUrl: '' },

  // Tiramisu
  { name: 'Classic Tiramisu (Cup)',  description: 'Authentic Italian tiramisu with espresso-soaked ladyfingers & mascarpone (single cup)', price: 100, category: 'tiramisu', available: true, imageUrl: '' },
  { name: 'Tiramisu Box',            description: 'Sharing box of our classic tiramisu — perfect for gatherings', price: 350, category: 'tiramisu', available: true, imageUrl: '' },
]

async function seed() {
  console.log('🌱 Seeding Firestore...\n')

  // Products
  for (const product of PRODUCTS) {
    const ref = await addDoc(collection(db, 'products'), { ...product, createdAt: new Date() })
    console.log(`✅ Added: ${product.name} (${ref.id})`)
  }

  // Settings
  await setDoc(doc(db, 'settings', 'main'), {
    transferNumber: '01XXXXXXXXXX',   // ← Replace with actual number
    deliveryNote:   'Delivery available in Cairo & Giza only. Orders are delivered within 24–48 hours.',
  })
  console.log('\n✅ Settings document created')

  console.log('\n🎉 Seed complete! Your Firebase is ready.')
  console.log('⚠️  Remember to update the transferNumber in Firebase settings.')
  process.exit(0)
}

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1) })

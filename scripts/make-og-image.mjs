// One-off: compose public/og-image.jpg (1200x630, <300KB) from brand assets.
// Run: node scripts/make-og-image.mjs
import sharp from 'sharp'

const W = 1200
const H = 630

// Background: text-free chocolate texture (1400x730 ≈ same aspect), cover-cropped to 1200x630
const bg = await sharp('src/assets/brand/choco-hero-bg.jpg')
  .resize(W, H, { fit: 'cover', position: 'centre' })
  .toBuffer()

// Overlay: pink "Melted — Made to melt hearts" lockup (1200x806), scaled to fit with margins
const logo = await sharp('src/assets/brand/melted-slogan-hero.png')
  .resize({ height: 500, fit: 'inside' })
  .toBuffer()

// Try descending quality until under 300KB
for (const quality of [82, 76, 70, 64]) {
  const out = await sharp(bg)
    .composite([{ input: logo, gravity: 'centre' }])
    .jpeg({ quality, mozjpeg: true })
    .toBuffer()
  if (out.length < 300 * 1024) {
    await sharp(out).toFile('public/og-image.jpg')
    console.log(`Wrote public/og-image.jpg — ${W}x${H}, quality ${quality}, ${(out.length / 1024).toFixed(1)} KB`)
    process.exit(0)
  }
  console.log(`quality ${quality}: ${(out.length / 1024).toFixed(1)} KB — too big, retrying`)
}
console.error('Could not get under 300KB')
process.exit(1)

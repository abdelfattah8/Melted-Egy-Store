import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCookieBite, faLayerGroup, faCakeCandles, faMugHot, faWandMagicSparkles, faMagnifyingGlass, faBoxOpen } from '@fortawesome/free-solid-svg-icons'
import { db } from '../firebase/config.jsx'
import ProductCard from '../components/ProductCard.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { InlineLoader } from '../components/Loader.jsx'
import SEO from '../components/SEO.jsx'

// Bare category keys — each is a top-level tab (also matches ?cat= links from Home)
const CATS = ['cookies', 'brownies', 'cheesecake', 'tiramisu']

// ONE flat tab row — no sub-filters
const TABS = [
  { key: 'all',        label: 'All',        icon: null },
  { key: 'new',        label: 'New',        icon: faWandMagicSparkles },
  { key: 'cookies',    label: 'Cookies',    icon: faCookieBite },
  { key: 'brownies',   label: 'Brownies',   icon: faLayerGroup },
  { key: 'cheesecake', label: 'Cheesecake', icon: faCakeCandles },
  { key: 'tiramisu',   label: 'Tiramisu',   icon: faMugHot },
  { key: 'bites',      label: 'Bites',      icon: faCookieBite },
  { key: 'boxes',      label: 'Boxes',      icon: faBoxOpen },
]

// Legacy URL support: ?cat=products → all, products-cookies → cookies,
// bites-cookies → bites, boxes-cheesecake → boxes. Unknown values → all.
function normalizeCat(raw) {
  if (!raw || raw === 'products') return 'all'
  if (raw.startsWith('products-')) raw = raw.slice('products-'.length)
  if (raw.startsWith('bites')) return 'bites'
  if (raw.startsWith('boxes')) return 'boxes'
  return TABS.some(t => t.key === raw) ? raw : 'all'
}

// Sale price wins when it's a real discount — same logic as ProductCard
const effectivePrice = p =>
  p.onSale && p.salePrice && p.salePrice < p.price ? p.salePrice : p.price

const SEO_TITLES = {
  all:        'Shop — Cookies, Brownies & Desserts',
  new:        'New Items — Melted Egypt',
  cookies:    'Cookies — Melted Egypt',
  brownies:   'Brownies — Melted Egypt',
  cheesecake: 'Cheesecake — Melted Egypt',
  tiramisu:   'Tiramisu — Melted Egypt',
  bites:      'Bites — Cookie & Brownie Bites',
  boxes:      'Boxes — Gift Boxes',
}

export default function Shop() {
  const [products,    setProducts]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()

  const activeCategory = normalizeCat(searchParams.get('cat'))

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // All Firestore queries use only the same index paths already in use.
        // Type discrimination (bites vs boxes) is applied client-side.
        let q
        if (activeCategory === 'new') {
          q = query(collection(db, 'products'), where('available', '==', true), where('isNew', '==', true))
        } else if (CATS.includes(activeCategory)) {
          q = query(collection(db, 'products'), where('category', '==', activeCategory), where('available', '==', true))
        } else {
          q = query(collection(db, 'products'), where('available', '==', true))
        }

        const snap = await getDocs(q)
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }))

        // Category tabs show plain products AND boxes of that category — only
        // bites are excluded (they live in their own tab).
        if (CATS.includes(activeCategory)) results = results.filter(p => p.type !== 'bite')
        if (activeCategory === 'bites')    results = results.filter(p => p.type === 'bite')
        if (activeCategory === 'boxes')    results = results.filter(p => p.type === 'box')

        // Client-side sort by effective price, lowest first (project avoids Firestore orderBy)
        results.sort((a, b) => effectivePrice(a) - effectivePrice(b))

        setProducts(results)
      } catch (err) { console.error(err) }
      setLoading(false)
    }
    load()
  }, [activeCategory])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return products
    const q = searchQuery.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  }, [products, searchQuery])

  function setTab(key) {
    setSearchQuery('')
    setSearchParams(key === 'all' ? {} : { cat: key })
  }

  return (
    <div className="shop-page">
      <SEO
        title={SEO_TITLES[activeCategory] || SEO_TITLES.all}
        description="Order handcrafted cookies, fudgy brownies, cheesecake and tiramisu. Fresh baked to order and delivered across Cairo & Giza."
        path="/shop"
      />
      <div className="shop-header">
        <h1>Our Menu</h1>
        <p>Choose from our handcrafted selection of cookies &amp; desserts</p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 24 }}>
        <SearchBar onSearch={setSearchQuery} placeholder="Search cookies, brownies, cheesecake..." />
      </div>

      {/* ── Tabs: All | New | Cookies | Brownies | Cheesecake | Tiramisu | Bites | Boxes ── */}
      <div className="category-tabs" style={{ marginBottom: 44 }}>
        {TABS.map(c => (
          <button
            key={c.key}
            className={`category-tab ${activeCategory === c.key ? 'active' : ''}`}
            onClick={() => setTab(c.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            {c.icon && <FontAwesomeIcon icon={c.icon} style={{ fontSize: 13 }} />}
            {c.label}
          </button>
        ))}
      </div>

      {/* ── Results ── */}
      {loading ? (
        <InlineLoader text="Loading products..." />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            {searchQuery
              ? <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: 64, color: 'var(--brown-light)' }} />
              : <FontAwesomeIcon icon={activeCategory === 'boxes' ? faBoxOpen : faCookieBite} style={{ fontSize: 64, color: 'var(--brown-light)' }} />
            }
          </span>
          <h3>{searchQuery ? `No results for "${searchQuery}"` : 'No products available right now'}</h3>
          <p>{searchQuery ? 'Try a different search term' : 'Check back soon!'}</p>
        </div>
      ) : (
        <>
          {searchQuery && (
            <p style={{ marginBottom: 20, color: 'var(--text-light)', fontSize: 14 }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "<strong>{searchQuery}</strong>"
            </p>
          )}
          <div className="products-grid">
            {filtered.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      )}
    </div>
  )
}

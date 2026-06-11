import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCookieBite, faLayerGroup, faCakeCandles, faMugHot, faWandMagicSparkles, faMagnifyingGlass, faBoxOpen, faUtensils } from '@fortawesome/free-solid-svg-icons'
import { db } from '../firebase/config.jsx'
import ProductCard from '../components/ProductCard.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { InlineLoader } from '../components/Loader.jsx'
import SEO from '../components/SEO.jsx'

// Bare category keys — used to normalise old ?cat=cookies links from Home
const BARE_CATS = ['cookies', 'brownies', 'cheesecake', 'tiramisu']

const MAIN_TABS = [
  { key: 'all',      label: 'All',      icon: null },
  { key: 'new',      label: 'New',      icon: faWandMagicSparkles },
  { key: 'products', label: 'Products', icon: faUtensils },
  { key: 'bites',    label: 'Bites',    icon: faCookieBite },
  { key: 'boxes',    label: 'Boxes',    icon: faBoxOpen },
]

const SUB_CATS = [
  { key: 'cookies',    label: 'Cookies',    icon: faCookieBite },
  { key: 'brownies',   label: 'Brownies',   icon: faLayerGroup },
  { key: 'cheesecake', label: 'Cheesecake', icon: faCakeCandles },
  { key: 'tiramisu',   label: 'Tiramisu',   icon: faMugHot },
]

// Bites (type:'bite') only come in these two categories
const BITE_SUB_CATS = SUB_CATS.filter(s => s.key === 'cookies' || s.key === 'brownies')

const MAIN_LABEL = { products: 'Products', bites: 'Bites', boxes: 'Boxes' }

export default function Shop() {
  const [products,    setProducts]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()

  // Normalise: bare ?cat=cookies (from Home links) → products-cookies
  const raw            = searchParams.get('cat') || 'all'
  const activeCategory = BARE_CATS.includes(raw) ? `products-${raw}` : raw

  const mainTab    = activeCategory.startsWith('products') ? 'products'
                   : activeCategory.startsWith('bites')    ? 'bites'
                   : activeCategory.startsWith('boxes')    ? 'boxes'
                   : activeCategory                          // 'all' | 'new'
  const subCat     = activeCategory.includes('-') ? activeCategory.split('-')[1] : null
  const showSubRow = mainTab === 'products' || mainTab === 'bites' || mainTab === 'boxes'

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // All Firestore queries use only the same index paths already in use.
        // Type discrimination (products vs bites vs boxes) is applied client-side.
        let q
        if (activeCategory === 'all') {
          q = query(collection(db, 'products'), where('available', '==', true))
        } else if (activeCategory === 'new') {
          q = query(collection(db, 'products'), where('available', '==', true), where('isNew', '==', true))
        } else if (subCat) {
          q = query(collection(db, 'products'), where('category', '==', subCat), where('available', '==', true))
        } else {
          q = query(collection(db, 'products'), where('available', '==', true))
        }

        const snap = await getDocs(q)
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }))

        // Products tab includes boxes (under their matching sub-category) — only
        // bites are excluded. Boxes also keep their own dedicated tab.
        if (mainTab === 'products') results = results.filter(p => p.type !== 'bite')
        if (mainTab === 'bites')    results = results.filter(p => p.type === 'bite')
        if (mainTab === 'boxes')    results = results.filter(p => p.type === 'box')

        setProducts(results)
      } catch (err) { console.error(err) }
      setLoading(false)
    }
    load()
  }, [activeCategory]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const seoTitle = (() => {
    if (activeCategory === 'all')      return 'Shop — Cookies, Brownies & Desserts'
    if (activeCategory === 'new')      return 'New Items — Melted Egypt'
    if (activeCategory === 'products') return 'Products — Individual Treats'
    if (activeCategory === 'bites')    return 'Bites — Cookie & Brownie Bites'
    if (activeCategory === 'boxes')    return 'Boxes — Gift Boxes'
    const label = subCat ? subCat.charAt(0).toUpperCase() + subCat.slice(1) : ''
    return mainTab === 'boxes' ? `${label} Boxes — Melted Egypt` : `${label} — Melted Egypt`
  })()

  return (
    <div className="shop-page">
      <SEO
        title={seoTitle}
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

      {/* ── Main tabs: All | New | Products | Bites | Boxes ── */}
      <div className="category-tabs" style={{ marginBottom: showSubRow ? 8 : 44 }}>
        {MAIN_TABS.map(c => (
          <button
            key={c.key}
            className={`category-tab ${mainTab === c.key ? 'active' : ''}`}
            onClick={() => setTab(c.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            {c.icon && <FontAwesomeIcon icon={c.icon} style={{ fontSize: 13 }} />}
            {c.label}
          </button>
        ))}
      </div>

      {/* ── Sub-category row (Products, Bites or Boxes selected) ── */}
      {showSubRow && (
        <div
          className="category-tabs"
          style={{
            marginBottom: 44,
            marginLeft: 2,
            paddingLeft: 14,
            borderLeft: `3px solid ${mainTab === 'boxes' ? 'var(--brown-light)' : 'var(--pink-dark)'}`,
          }}
        >
          <button
            className={`category-tab ${!subCat ? 'active' : ''}`}
            onClick={() => setTab(mainTab)}
            style={{ fontSize: 13, padding: '8px 18px' }}
          >
            All {MAIN_LABEL[mainTab]}
          </button>
          {(mainTab === 'bites' ? BITE_SUB_CATS : SUB_CATS).map(s => (
            <button
              key={s.key}
              className={`category-tab ${subCat === s.key ? 'active' : ''}`}
              onClick={() => setTab(`${mainTab}-${s.key}`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, padding: '8px 18px' }}
            >
              <FontAwesomeIcon icon={s.icon} style={{ fontSize: 12 }} />
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Results ── */}
      {loading ? (
        <InlineLoader text="Loading products..." />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            {searchQuery
              ? <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: 64, color: 'var(--brown-light)' }} />
              : <FontAwesomeIcon icon={mainTab === 'boxes' ? faBoxOpen : faCookieBite} style={{ fontSize: 64, color: 'var(--brown-light)' }} />
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

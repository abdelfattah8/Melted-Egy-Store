import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import { db } from '../firebase/config.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { InlineLoader } from '../components/Loader.jsx'
import SEO from '../components/SEO.jsx'

export default function NewItems() {
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, 'products'), where('available', '==', true), where('isNew', '==', true))
        const snap = await getDocs(q)
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) { console.error(err) }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="shop-page">
      <SEO
        title="New Arrivals — Fresh Cookies & Desserts"
        description="Be the first to try our latest handcrafted cookies, brownies and desserts. New items freshly baked and delivered in Cairo & Giza."
        path="/new-items"
      />
      <div className="shop-header" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span className="new-badge-large">NEW</span>
            <h1 style={{ margin: 0 }}>New Items</h1>
          </div>
          <p>Fresh additions to our menu — be the first to try them!</p>
        </div>
      </div>

      {loading ? (
        <InlineLoader text="Loading new items..." />
      ) : products.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon"><FontAwesomeIcon icon={faWandMagicSparkles} style={{ fontSize: 64, color: 'var(--brown-light)' }} /></span>
          <h3>No new items right now</h3>
          <p>Check back soon — new treats are coming!</p>
          <button className="btn btn-primary mt-6" onClick={() => navigate('/shop')}>
            Browse All Products
          </button>
        </div>
      ) : (
        <div className="products-grid">
          {products.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  )
}

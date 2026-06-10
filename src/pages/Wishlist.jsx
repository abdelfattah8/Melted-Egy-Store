import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where, documentId } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeart, faBagShopping } from '@fortawesome/free-solid-svg-icons'
import { db } from '../firebase/config.jsx'
import { useWishlist } from '../context/WishlistContext.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { InlineLoader } from '../components/Loader.jsx'
import SEO from '../components/SEO.jsx'

export default function Wishlist() {
  const { wishlist } = useWishlist()
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      if (wishlist.length === 0) { setLoading(false); return }
      try {
        const batches = []
        for (let i = 0; i < wishlist.length; i += 10) {
          const batch = wishlist.slice(i, i + 10)
          const q = query(collection(db, 'products'), where(documentId(), 'in', batch))
          batches.push(getDocs(q))
        }
        const results = await Promise.all(batches)
        const all = results.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setProducts(all)
      } catch (err) { console.error(err) }
      setLoading(false)
    }
    load()
  }, [wishlist])

  return (
    <div className="shop-page">
      <SEO title="My Wishlist" description="Your saved Melted Egypt products." path="/wishlist" />
      <div className="shop-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FontAwesomeIcon icon={faHeart} style={{ fontSize: 32, color: '#e53935' }} /> My Wishlist
        </h1>
        <p>{wishlist.length} saved item{wishlist.length !== 1 ? 's' : ''}</p>
      </div>

      {loading ? (
        <InlineLoader text="Loading wishlist..." />
      ) : wishlist.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <FontAwesomeIcon icon={faHeart} style={{ fontSize: 64, color: 'var(--brown-light)' }} />
          </span>
          <h3>Your wishlist is empty</h3>
          <p>Tap the heart on any product to save it here</p>
          <button className="btn btn-primary mt-6" onClick={() => navigate('/shop')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={faBagShopping} style={{ fontSize: 16 }} /> Browse Products
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

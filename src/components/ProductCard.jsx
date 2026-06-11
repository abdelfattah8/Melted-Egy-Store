import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeart as faHeartSolid, faCircleXmark, faCookieBite, faMugHot, faCakeCandles, faLayerGroup, faUtensils, faWandMagicSparkles, faBoxOpen, faJarWheat } from '@fortawesome/free-solid-svg-icons'
import BoxBuilderModal from './BoxBuilderModal.jsx'
import ExtrasModal from './ExtrasModal.jsx'
import { useFlavors } from '../hooks/useCatalog.js'

const faHeartOutline = { prefix: 'far', iconName: 'heart', icon: [512, 512, [], 'f004', 'M378.9 80c-27.3 0-53 13.1-69 35.2l-34.4 47.6c-4.5 6.2-11.7 9.9-19.4 9.9s-14.9-3.7-19.4-9.9l-34.4-47.6c-16-22.1-41.7-35.2-69-35.2-47 0-85.1 38.1-85.1 85.1 0 49.9 32 98.4 68.1 142.3 41.1 50 91.4 94 125.9 120.3 3.2 2.4 7.9 4.2 14 4.2s10.8-1.8 14-4.2c34.5-26.3 84.8-70.4 125.9-120.3 36.2-43.9 68.1-92.4 68.1-142.3 0-47-38.1-85.1-85.1-85.1zM271 87.1c25-34.6 65.2-55.1 107.9-55.1 73.5 0 133.1 59.6 133.1 133.1 0 68.6-42.9 128.9-79.1 172.8-44.1 53.6-97.3 100.1-133.8 127.9-12.3 9.4-27.5 14.1-43.1 14.1s-30.8-4.7-43.1-14.1C176.4 438 123.2 391.5 79.1 338 42.9 294.1 0 233.7 0 165.1 0 91.6 59.6 32 133.1 32 175.8 32 216 52.5 241 87.1l15 20.7 15-20.7z'] }
import toast from 'react-hot-toast'
import { useCart } from '../context/CartContext.jsx'
import { useWishlist } from '../context/WishlistContext.jsx'

const CAT_ICONS = { cookies: faCookieBite, brownies: faLayerGroup, cheesecake: faCakeCandles, tiramisu: faMugHot }
const LABELS    = { cookies: 'Cookies', brownies: 'Brownies', cheesecake: 'Cheesecake', tiramisu: 'Tiramisu' }

export default function ProductCard({ product }) {
  const { addToCart, cartItems }          = useCart()
  const { toggleWishlist, isWishlisted } = useWishlist()
  const [qty, setQty]           = useState(0)
  const [boxModal, setBoxModal] = useState(false)
  const [extrasModal, setExtrasModal] = useState(false)
  const allFlavors = useFlavors()

  const activePrice   = product.onSale && product.salePrice ? product.salePrice : product.price
  const onSale        = product.onSale && product.salePrice && product.salePrice < product.price
  const discountPct   = onSale ? Math.round((1 - product.salePrice / product.price) * 100) : 0
  const wishlisted    = isWishlisted(product.id)
  const isUnavailable = !product.available || (typeof product.stock === 'number' && product.stock <= 0)
  const maxQty        = typeof product.stock === 'number' && product.stock > 0 ? product.stock : 100
  // Sum across lines — a product with extras can occupy several cart lines
  const inCart        = cartItems.filter(i => i.id === product.id).reduce((s, i) => s + i.quantity, 0)

  const catIcon   = CAT_ICONS[product.category] || faUtensils
  // Bites ALWAYS go through the options modal (required flavor choice); plain
  // products only when they have extras. Boxes have their own flow.
  const usesOptionsModal = product.type === 'bite' ||
    (product.type !== 'box' && product.extraIds?.length > 0)
  const flavorNames = (product.flavorIds || [])
    .map(id => allFlavors.find(f => f.id === id))
    .filter(f => f && f.active !== false)
    .map(f => f.name)

  function dec() { if (qty > 0) setQty(q => q - 1) }
  function inc() { if (qty + inCart < maxQty) setQty(q => q + 1) }

  function handleAdd() {
    if (isUnavailable || qty === 0) return
    const maxCanAdd = Math.max(0, maxQty - inCart)
    if (maxCanAdd === 0) { toast.error(`Only ${maxQty} available`); return }
    const toAdd = Math.min(qty, maxCanAdd)
    addToCart({ ...product, price: activePrice }, toAdd)
    toast.success(`${toAdd} × ${product.name} added to cart`)
    setQty(0)
  }

  function handleWishlist(e) {
    e.stopPropagation()
    toggleWishlist(product.id)
    toast(wishlisted ? 'Removed from wishlist' : 'Added to wishlist', {
      icon: <FontAwesomeIcon icon={faHeartSolid} style={{ fontSize: 16, color: '#e53935' }} />,
    })
  }

  return (
    <div className="product-card" style={{ position: 'relative', opacity: isUnavailable ? 0.7 : 1 }}>

      {/* Badges */}
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 2 }}>
        {product.isNew && (
          <div className="badge-new" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            NEW <FontAwesomeIcon icon={faWandMagicSparkles} style={{ fontSize: 10 }} />
          </div>
        )}
        {onSale && <div className="sale-badge">-{discountPct}%</div>}
      </div>

      {/* Wishlist heart */}
      <button
        onClick={handleWishlist}
        className={`wishlist-btn${wishlisted ? ' wishlisted' : ''}`}
        style={{ position: 'absolute', top: 12, left: 12, zIndex: 2,padding:18 }}
        title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <FontAwesomeIcon
          icon={wishlisted ? faHeartSolid : faHeartOutline}
          beat={wishlisted}
          className="icon-heart"
          style={{ fontSize: 20, color: wishlisted ? '#e53935' : 'inherit' }}
        />
      </button>

      {/* Image */}
      {product.imageUrl
        ? <img src={product.imageUrl} alt={product.name} className="product-card-img" loading="lazy" />
        : (
          <div className="product-card-img-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={catIcon} style={{ fontSize: 52, color: 'var(--brown-light)' }} />
          </div>
        )
      }

      <div className="product-card-body">
        <p className="product-card-category">
          {product.type === 'box'
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: 11 }} />
                Gift Box · {LABELS[product.category] || product.category}
              </span>
            : product.type === 'bite'
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <FontAwesomeIcon icon={faCookieBite} style={{ fontSize: 11 }} />
                  Bite · {LABELS[product.category] || product.category}
                </span>
              : (LABELS[product.category] || product.category)
          }
        </p>
        <h3 className="product-card-name">{product.name}</h3>
        {flavorNames.length > 0 && (
          <div className="product-card-flavors">
            {flavorNames.map(name => <span key={name} className="product-card-flavor">{name}</span>)}
          </div>
        )}
        {product.description && <p className="product-card-desc">{product.description}</p>}

        {/* Price */}
        <div style={{ marginBottom: 16 }}>
          {onSale ? (
            <div className="price-sale-wrapper">
              <span className="price-original">{product.price} EGP</span>
              <span className="price-sale">{product.salePrice} EGP</span>
              {qty > 1 && <span style={{ fontSize: 12, color: 'var(--text-light)', display: 'block', marginTop: 2 }}>Total: {product.salePrice * qty} EGP</span>}
            </div>
          ) : (
            <div className="product-card-price">
              {product.type === 'box' || qty === 0 ? activePrice : activePrice * qty} <span>EGP</span>
              {product.type !== 'box' && qty > 1 && <span style={{ fontSize: 12, color: 'var(--text-light)', marginRight: 6 }}>({activePrice} × {qty})</span>}
            </div>
          )}
        </div>

        {/* Bite piece count hint */}
        {product.type === 'bite' && product.pieceCount > 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
            <FontAwesomeIcon icon={faCookieBite} style={{ fontSize: 11 }} />
            {product.pieceCount} piece{product.pieceCount > 1 ? 's' : ''}
          </p>
        )}

        {/* Box size hint */}
        {product.type === 'box' && product.boxSize && (
          <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
            <FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: 11 }} />
            {product.boxSize} pieces — choose your flavors
          </p>
        )}
        {product.type === 'box' && !product.boxSize && (
          <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 14 }}>Single-flavor box — pick your taste</p>
        )}

        {isUnavailable ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#e53935', fontWeight: 600 }}>
            <FontAwesomeIcon icon={faCircleXmark} style={{ fontSize: 14 }} /> Currently Unavailable
          </span>
        ) : product.type === 'box' ? (
          <button
            className="add-to-cart-btn"
            onClick={() => setBoxModal(true)}
            style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
          >
            <FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: 14 }} /> Build Your Box
          </button>
        ) : usesOptionsModal ? (
          <button
            className="add-to-cart-btn"
            onClick={() => setExtrasModal(true)}
            style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
          >
            <FontAwesomeIcon icon={faJarWheat} style={{ fontSize: 14 }} /> Add to Cart
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="qty-selector">
                <button className="qty-btn" onClick={dec} disabled={qty === 0}>−</button>
                <span className="qty-value">{qty}</span>
                <button className="qty-btn" onClick={inc} disabled={qty + inCart >= maxQty}>+</button>
              </div>
              {/* <span style={{ fontSize: 12, color: 'var(--text-light)' }}>Max {maxQty}</span> */}
            </div>
            <button
              className="add-to-cart-btn"
              onClick={handleAdd}
              disabled={qty === 0}
              style={{ width: '100%', opacity: qty === 0 ? 0.45 : 1, cursor: qty === 0 ? 'not-allowed' : 'pointer' }}
            >
              {qty === 0 ? 'Select Quantity' : `Add ${qty} to Cart`}
            </button>
          </div>
        )}
      </div>

      {boxModal && <BoxBuilderModal box={product} onClose={() => setBoxModal(false)} />}
      {extrasModal && <ExtrasModal product={product} onClose={() => setExtrasModal(false)} />}
    </div>
  )
}

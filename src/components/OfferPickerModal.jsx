import { useState, useEffect } from 'react'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGift, faCircleCheck, faUtensils } from '@fortawesome/free-solid-svg-icons'
import { db } from '../firebase/config.jsx'

function effectivePrice(p) {
  return p.onSale && p.salePrice && p.salePrice < p.price ? p.salePrice : p.price
}

function getRequiredCount(offer) {
  if (offer?.type === 'buy1get1') return 2
  if (offer?.type === 'buy2get1') return 3
  return 0
}

export default function OfferPickerModal({ offer, onConfirm, onCancel }) {
  const required = getRequiredCount(offer)
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [quantities, setQuantities] = useState({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        if (offer.productId) {
          const snap = await getDoc(doc(db, 'products', offer.productId))
          if (snap.exists()) {
            const d = snap.data()
            if (d.available !== false) setProducts([{ id: snap.id, ...d }])
          }
        } else {
          const snap = await getDocs(query(collection(db, 'products'), where('available', '==', true)))
          setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        }
      } catch { /* stay empty */ }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [offer.id, offer.productId])

  const totalSelected = Object.values(quantities).reduce((s, v) => s + v, 0)
  const remaining  = required - totalSelected
  const canConfirm = totalSelected === required

  function changeQty(product, delta) {
    setQuantities(prev => {
      const current = prev[product.id] || 0
      const total   = Object.values(prev).reduce((s, v) => s + v, 0)
      const newQty  = current + delta
      if (newQty < 0) return prev
      if (delta > 0 && total >= required) return prev
      const next = { ...prev }
      if (newQty === 0) delete next[product.id]
      else next[product.id] = newQty
      return next
    })
  }

  function handleConfirm() {
    if (!canConfirm) return
    const itemsToAdd = []
    for (const [id, qty] of Object.entries(quantities)) {
      const p = products.find(pr => pr.id === id)
      if (!p) continue
      // Use effective (sale) price so the cart item matches what ProductCard would add
      itemsToAdd.push({ product: { ...p, price: effectivePrice(p) }, qty })
    }
    onConfirm(itemsToAdd)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{ background: 'var(--white)', borderRadius: 'var(--radius)', width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--brown-dark)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={faGift} style={{ fontSize: 18, color: 'var(--brown)' }} /> {offer.title}
          </div>
          {canConfirm ? (
            <div style={{ fontSize: 13, color: '#2E7D32', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 14 }} className="icon-pop" /> All {required} items selected — cheapest will be free
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--brown)' }}>
              Select {remaining} more item{remaining !== 1 ? 's' : ''} · cheapest becomes free
            </div>
          )}
        </div>

        {/* Product grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <p style={{ color: 'var(--text-light)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>Loading products...</p>
          ) : products.length === 0 ? (
            <p style={{ color: 'var(--text-light)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>No eligible products found.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
              {products.map(p => {
                const price  = effectivePrice(p)
                const qty    = quantities[p.id] || 0
                const canAdd = totalSelected < required
                return (
                  <div key={p.id} style={{ borderRadius: 10, border: `2px solid ${qty > 0 ? 'var(--brown)' : 'var(--border)'}`, background: qty > 0 ? 'var(--cream)' : 'var(--white)', overflow: 'hidden', transition: 'var(--transition)', position: 'relative' }}>
                    {qty > 0 && (
                      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1, minWidth: 24, height: 24, borderRadius: 12, background: 'var(--brown)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, boxShadow: '0 2px 6px rgba(0,0,0,0.25)', padding: '0 6px' }}>{qty}</div>
                    )}
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                      : <div style={{ width: '100%', aspectRatio: '1', background: 'var(--cream-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FontAwesomeIcon icon={faUtensils} style={{ fontSize: 36, color: 'var(--brown-light)' }} />
                        </div>
                    }
                    <div style={{ padding: '10px 10px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brown-dark)', marginBottom: 4, lineHeight: 1.35 }}>{p.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brown)', marginBottom: 8 }}>{price} EGP</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                        <button onClick={() => changeQty(p, -1)} disabled={qty === 0} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--brown)', background: qty === 0 ? 'var(--border)' : 'var(--white)', color: qty === 0 ? 'var(--text-light)' : 'var(--brown)', fontWeight: 700, fontSize: 16, cursor: qty === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0, fontFamily: 'Poppins,sans-serif' }}>−</button>
                        <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--brown-dark)' }}>{qty}</span>
                        <button onClick={() => changeQty(p, 1)} disabled={!canAdd} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--brown)', background: !canAdd ? 'var(--border)' : 'var(--brown)', color: !canAdd ? 'var(--text-light)' : 'white', fontWeight: 700, fontSize: 16, cursor: !canAdd ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0, fontFamily: 'Poppins,sans-serif' }}>+</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--brown)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={!canConfirm} style={{ flex: 2, padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', background: canConfirm ? 'var(--brown)' : 'var(--border)', color: canConfirm ? 'white' : 'var(--text-light)', fontWeight: 700, fontSize: 14, cursor: canConfirm ? 'pointer' : 'not-allowed', transition: 'var(--transition)', fontFamily: 'Poppins,sans-serif' }}>
            {canConfirm ? 'Confirm Selection' : `Select ${remaining} more item${remaining !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

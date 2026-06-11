import { useState, useEffect } from 'react'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGift, faCircleCheck, faUtensils, faBoxOpen } from '@fortawesome/free-solid-svg-icons'
import { db } from '../firebase/config.jsx'
import { getOfferProductIds, getOfferGiftProductIds } from '../utils/offerUtils.js'
import BoxBuilderModal from './BoxBuilderModal.jsx'

function effectivePrice(p) {
  return p.onSale && p.salePrice && p.salePrice < p.price ? p.salePrice : p.price
}

function getRequiredCount(offer) {
  if (offer?.type === 'buy1get1') return 2
  if (offer?.type === 'buy2get1') return 3
  return 0
}

async function fetchByIds(ids) {
  const snaps = await Promise.all(ids.map(id => getDoc(doc(db, 'products', id))))
  return snaps
    .filter(s => s.exists() && s.data().available !== false)
    .map(s => ({ id: s.id, ...s.data() }))
}

async function fetchAvailable() {
  const snap = await getDocs(query(collection(db, 'products'), where('available', '==', true)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export default function OfferPickerModal({ offer, onConfirm, onCancel }) {
  const isBoxGift = offer.type === 'box_gift'
  const required  = getRequiredCount(offer)
  const [products,     setProducts]     = useState([]) // BOGO: eligible bites · box_gift: eligible boxes
  const [giftProducts, setGiftProducts] = useState([]) // box_gift: eligible free bites
  const [loading,      setLoading]      = useState(true)
  const [quantities,   setQuantities]   = useState({})
  // box_gift flow: 'box' (pick a box) → 'flavors' (BoxBuilderModal) → 'gift' (pick free bite)
  const [step,      setStep]      = useState(isBoxGift ? 'box' : 'items')
  const [chosenBox, setChosenBox] = useState(null)
  const [giftId,    setGiftId]    = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        if (isBoxGift) {
          const boxIds  = getOfferProductIds(offer)
          const giftIds = getOfferGiftProductIds(offer)
          const [boxesRaw, giftsRaw] = await Promise.all([
            boxIds.length ? fetchByIds(boxIds) : fetchAvailable(),
            giftIds.length ? fetchByIds(giftIds) : fetchAvailable(),
          ])
          const boxes = boxesRaw.filter(p => p.type === 'box')
          setProducts(boxes)
          setGiftProducts(giftsRaw.filter(p => p.type !== 'box'))
          // Single eligible box — skip the box step and open the flavor picker directly
          if (boxes.length === 1) { setChosenBox(boxes[0]); setStep('flavors') }
        } else {
          // BOGO offers work with bites only — boxes are never selectable
          const offerIds = getOfferProductIds(offer)
          const all = offerIds.length ? await fetchByIds(offerIds) : await fetchAvailable()
          setProducts(all.filter(p => p.type !== 'box'))
        }
      } catch { /* stay empty */ }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.id])

  const totalSelected = Object.values(quantities).reduce((s, v) => s + v, 0)
  const remaining  = required - totalSelected
  const canConfirm = isBoxGift ? (step === 'gift' && !!giftId) : totalSelected === required

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
    if (isBoxGift) {
      const g = giftProducts.find(p => p.id === giftId)
      if (!g) return
      const price = effectivePrice(g)
      // The gift bite goes into the cart at its normal price; the offer discount (recomputed
      // and verified at checkout) equals that price, so it nets out free.
      onConfirm(
        [{ product: { ...g, price }, qty: 1 }],
        { giftItem: { id: g.id, name: g.name, price, imageUrl: g.imageUrl || null } }
      )
      return
    }
    const itemsToAdd = []
    for (const [id, qty] of Object.entries(quantities)) {
      const p = products.find(pr => pr.id === id)
      if (!p) continue
      // Use effective (sale) price so the cart item matches what ProductCard would add
      itemsToAdd.push({ product: { ...p, price: effectivePrice(p) }, qty })
    }
    onConfirm(itemsToAdd)
  }

  // Flavor step renders the existing box builder on its own — the box is added to the cart
  // there, then the flow advances to the free-gift step.
  if (isBoxGift && step === 'flavors' && chosenBox) {
    return (
      <BoxBuilderModal
        box={chosenBox}
        onAdded={() => setStep('gift')}
        onClose={() => {
          // Cancelled the flavor picker: go back to box choice, or abort if there was none
          if (products.length === 1) onCancel()
          else { setChosenBox(null); setStep('box') }
        }}
      />
    )
  }

  const gridItems  = isBoxGift && step === 'gift' ? giftProducts : products
  const headerHint = isBoxGift
    ? (step === 'gift'
        ? 'Box added! Now pick ONE item — it’s on us, completely free'
        : 'Step 1 — choose your box, then pick its flavors')
    : canConfirm
      ? `All ${required} items selected — cheapest will be free`
      : `Select ${remaining} more item${remaining !== 1 ? 's' : ''} · cheapest becomes free`

  return (
    <div
      className="offer-picker-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="offer-picker-modal" style={{ background: 'var(--white)', borderRadius: 'var(--radius)', width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--brown-dark)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={isBoxGift && step !== 'gift' ? faBoxOpen : faGift} style={{ fontSize: 18, color: 'var(--brown)' }} /> {offer.title}
          </div>
          {!isBoxGift && canConfirm ? (
            <div style={{ fontSize: 13, color: '#2E7D32', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 14 }} className="icon-pop" /> {headerHint}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--brown)' }}>{headerHint}</div>
          )}
        </div>

        {/* Product grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <p style={{ color: 'var(--text-light)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>Loading products...</p>
          ) : gridItems.length === 0 ? (
            <p style={{ color: 'var(--text-light)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>No eligible products found.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
              {gridItems.map(p => {
                const price = effectivePrice(p)
                const qty   = quantities[p.id] || 0
                const selected = isBoxGift ? (step === 'gift' && giftId === p.id) : qty > 0
                const canAdd   = totalSelected < required
                return (
                  <div
                    key={p.id}
                    onClick={isBoxGift
                      ? () => {
                          if (step === 'gift') setGiftId(p.id)
                          else { setChosenBox(p); setStep('flavors') }
                        }
                      : undefined}
                    style={{ borderRadius: 10, border: `2px solid ${selected ? 'var(--brown)' : 'var(--border)'}`, background: selected ? 'var(--cream)' : 'var(--white)', overflow: 'hidden', transition: 'var(--transition)', position: 'relative', cursor: isBoxGift ? 'pointer' : 'default' }}
                  >
                    {!isBoxGift && qty > 0 && (
                      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1, minWidth: 24, height: 24, borderRadius: 12, background: 'var(--brown)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, boxShadow: '0 2px 6px rgba(0,0,0,0.25)', padding: '0 6px' }}>{qty}</div>
                    )}
                    {isBoxGift && selected && (
                      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1, width: 24, height: 24, borderRadius: 12, background: '#2E7D32', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
                        <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 13 }} />
                      </div>
                    )}
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                      : <div style={{ width: '100%', aspectRatio: '1', background: 'var(--cream-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FontAwesomeIcon icon={p.type === 'box' ? faBoxOpen : faUtensils} style={{ fontSize: 36, color: 'var(--brown-light)' }} />
                        </div>
                    }
                    <div style={{ padding: '10px 10px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brown-dark)', marginBottom: 4, lineHeight: 1.35 }}>{p.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brown)', marginBottom: isBoxGift ? 0 : 8 }}>
                        {isBoxGift && step === 'gift'
                          ? <><span style={{ textDecoration: 'line-through', color: 'var(--text-light)', fontWeight: 500 }}>{price} EGP</span> <span style={{ color: '#2E7D32' }}>FREE</span></>
                          : <>{price} EGP</>}
                      </div>
                      {!isBoxGift && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                          <button onClick={() => changeQty(p, -1)} disabled={qty === 0} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--brown)', background: qty === 0 ? 'var(--border)' : 'var(--white)', color: qty === 0 ? 'var(--text-light)' : 'var(--brown)', fontWeight: 700, fontSize: 16, cursor: qty === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0, fontFamily: 'Poppins,sans-serif' }}>−</button>
                          <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--brown-dark)' }}>{qty}</span>
                          <button onClick={() => changeQty(p, 1)} disabled={!canAdd} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--brown)', background: !canAdd ? 'var(--border)' : 'var(--brown)', color: !canAdd ? 'var(--text-light)' : 'white', fontWeight: 700, fontSize: 16, cursor: !canAdd ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0, fontFamily: 'Poppins,sans-serif' }}>+</button>
                        </div>
                      )}
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
          {(!isBoxGift || step === 'gift') && (
            <button onClick={handleConfirm} disabled={!canConfirm} style={{ flex: 2, padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', background: canConfirm ? 'var(--brown)' : 'var(--border)', color: canConfirm ? 'white' : 'var(--text-light)', fontWeight: 700, fontSize: 14, cursor: canConfirm ? 'pointer' : 'not-allowed', transition: 'var(--transition)', fontFamily: 'Poppins,sans-serif' }}>
              {isBoxGift
                ? (canConfirm ? 'Confirm Free Gift' : 'Pick your free item')
                : (canConfirm ? 'Confirm Selection' : `Select ${remaining} more item${remaining !== 1 ? 's' : ''}`)}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

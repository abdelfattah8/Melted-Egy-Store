import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faBoxOpen, faCircleCheck, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase/config.jsx'
import { useCart } from '../context/CartContext.jsx'
import { InlineLoader } from './Loader.jsx'
import toast from 'react-hot-toast'

const COUNTING_CATS = ['cookies', 'brownies']

// `onAdded` (optional): called instead of `onClose` after the box is added to the cart —
// lets the box_gift offer flow advance to the free-gift step. Cancel always calls `onClose`.
export default function BoxBuilderModal({ box, onClose, onAdded }) {
  const { addBoxToCart, cartItems } = useCart()
  const [flavors, setFlavors] = useState([])
  const [loading, setLoading] = useState(true)
  const [choices, setChoices] = useState(() => {
    const existing = cartItems.find(i => i.id === box.id)
    if (!existing?.boxChoices?.length) return {}
    const map = {}
    existing.boxChoices.forEach(c => { map[c.id] = c.quantity })
    return map
  })

  const isCounting    = COUNTING_CATS.includes(box.category)
  const boxSize       = box.boxSize || 0
  // Respect an active sale — same as ProductCard does for bites
  const onSale        = box.onSale && box.salePrice && box.salePrice < box.price
  const activePrice   = onSale ? box.salePrice : box.price
  const totalSelected = Object.values(choices).reduce((s, v) => s + v, 0)
  const remaining     = isCounting ? boxSize - totalSelected : (totalSelected === 1 ? 0 : 1)
  const canAdd        = isCounting ? totalSelected === boxSize : totalSelected === 1

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(collection(db, 'products'),
            where('category', '==', box.category),
            where('available', '==', true))
        )
        setFlavors(
          snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.type !== 'box')
        )
      } catch (err) { console.error('Failed to load flavors', err) }
      setLoading(false)
    }
    load()
  }, [box.category])

  function handleFlavor(id, delta) {
    if (!isCounting) {
      setChoices(prev => prev[id] ? {} : { [id]: 1 })
      return
    }
    setChoices(prev => {
      const current  = prev[id] || 0
      const newQty   = current + delta
      if (newQty < 0) return prev
      const prevTotal = Object.values(prev).reduce((s, v) => s + v, 0)
      if (delta > 0 && prevTotal >= boxSize) return prev
      const next = { ...prev }
      if (newQty === 0) delete next[id]
      else next[id] = newQty
      return next
    })
  }

  function handleAdd() {
    if (!canAdd) return
    const choiceList = flavors
      .filter(f => choices[f.id] > 0)
      .map(f => ({ id: f.id, name: f.name, quantity: choices[f.id], imageUrl: f.imageUrl || '' }))
    addBoxToCart({ ...box, price: activePrice }, choiceList)
    toast.success(`${box.name} added to cart! 🎁`)
    if (onAdded) onAdded()
    else onClose()
  }

  const pct = isCounting && boxSize > 0 ? Math.min(100, (totalSelected / boxSize) * 100) : 0

  return createPortal(
    <div className="modal-overlay bbm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="box-builder-modal">

        {/* ── FIXED HEADER ── */}
        <div className="bbm-header">
          <button className="bbm-close" onClick={onClose} aria-label="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>

          <div className="bbm-title-row">
            <FontAwesomeIcon icon={faBoxOpen} className="bbm-icon" />
            <h3 className="bbm-title">{box.name}</h3>
          </div>

          <p className="bbm-instruction">
            {isCounting
              ? `Choose exactly ${boxSize} pieces — you can pick more than one of the same flavor`
              : 'Pick your flavor for this box'}
          </p>

          {isCounting && (
            <div className="bbm-progress">
              <div className="bbm-progress-labels">
                <span className="bbm-progress-count">{totalSelected} / {boxSize} pieces</span>
                {remaining > 0
                  ? <span className="bbm-progress-remaining">Select {remaining} more</span>
                  : <span className="bbm-progress-done">
                      <FontAwesomeIcon icon={faCircleCheck} /> Box complete!
                    </span>
                }
              </div>
              <div className="bbm-progress-bar">
                <div
                  className="bbm-progress-fill"
                  style={{
                    width: `${pct}%`,
                    background: totalSelected === boxSize ? '#2E7D32' : 'var(--brown)',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="bbm-body">
          {loading ? (
            <InlineLoader text="Loading flavors..." />
          ) : flavors.length === 0 ? (
            <p className="bbm-empty">No flavors available in this category yet.</p>
          ) : (
            <div className="bbm-grid">
              {flavors.map(f => {
                const qty         = choices[f.id] || 0
                const isSelected  = qty > 0
                const plusDisabled = isCounting && totalSelected >= boxSize

                return (
                  <div
                    key={f.id}
                    className={`bbm-card${isSelected ? ' bbm-card-selected' : ''}${!isCounting ? ' bbm-card-clickable' : ''}`}
                    onClick={!isCounting ? () => handleFlavor(f.id, 1) : undefined}
                  >
                    {/* Thumbnail */}
                    <div className="bbm-card-img-wrap">
                      {f.imageUrl
                        ? <img src={f.imageUrl} alt={f.name} className="bbm-card-img" loading="lazy" />
                        : <div className="bbm-card-img-fallback">
                            <FontAwesomeIcon icon={faBoxOpen} />
                          </div>
                      }
                    </div>

                    {/* Info */}
                    <div className="bbm-card-info">
                      <div className="bbm-card-name">{f.name}</div>
                      {f.description && (
                        <div className="bbm-card-desc">{f.description}</div>
                      )}
                    </div>

                    {/* Controls */}
                    {isCounting ? (
                      <div className="bbm-stepper">
                        <button
                          className="bbm-step-btn"
                          onClick={e => { e.stopPropagation(); handleFlavor(f.id, -1) }}
                          disabled={qty === 0}
                          aria-label="Decrease"
                        >
                          <FontAwesomeIcon icon={faMinus} style={{ fontSize: 9 }} />
                        </button>
                        <span className="bbm-step-qty">{qty}</span>
                        <button
                          className={`bbm-step-btn bbm-step-plus${plusDisabled ? ' bbm-step-disabled' : ''}`}
                          onClick={e => { e.stopPropagation(); handleFlavor(f.id, 1) }}
                          disabled={plusDisabled}
                          aria-label="Increase"
                        >
                          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 9 }} />
                        </button>
                      </div>
                    ) : (
                      <div className={`bbm-radio${isSelected ? ' bbm-radio-selected' : ''}`}>
                        {isSelected && <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 13 }} />}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── FIXED FOOTER ── */}
        <div className="bbm-footer">
          <div className="bbm-price-block">
            <span className="bbm-price">
              {onSale && (
                <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-light)', textDecoration: 'line-through', marginRight: 6 }}>
                  {box.price}
                </span>
              )}
              {activePrice} <small>EGP</small>
            </span>
            <span className="bbm-price-label">Fixed box price</span>
          </div>
          <div className="bbm-footer-actions">
            <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={!canAdd}
              style={{ opacity: canAdd ? 1 : 0.55, cursor: canAdd ? 'pointer' : 'not-allowed' }}
            >
              {canAdd
                ? <><FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: 14 }} /> Add to Cart</>
                : isCounting
                  ? `Select ${remaining} more`
                  : 'Pick a flavor'
              }
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  )
}

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faMinus, faPlus, faCartShopping, faJarWheat, faCheck, faCircleCheck, faIceCream } from '@fortawesome/free-solid-svg-icons'
import { useCart } from '../context/CartContext.jsx'
import { useExtras, useFlavors } from '../hooks/useCatalog.js'
import toast from 'react-hot-toast'

/**
 * Quantity + options picker. Used for:
 * - plain products with admin-assigned extras (extras checkboxes), and
 * - bites (REQUIRED single-flavor choice from the flavors list, plus extras
 *   checkboxes when assigned). Total = (base + selected extras) × quantity.
 */
export default function ExtrasModal({ product, onClose }) {
  const { addToCartWithExtras, cartItems } = useCart()
  const allExtras  = useExtras()
  const allFlavors = useFlavors()
  const [qty, setQty]           = useState(1)
  const [selected, setSelected] = useState({}) // extraId -> true
  const [flavorId, setFlavorId] = useState(null)

  const basePrice = product.onSale && product.salePrice && product.salePrice < product.price
    ? product.salePrice
    : product.price

  // Only extras the admin assigned to THIS product, and still active
  const available = useMemo(
    () => allExtras.filter(x => (product.extraIds || []).includes(x.id) && x.active !== false),
    [allExtras, product.extraIds]
  )

  // Bites: the customer must pick exactly ONE flavor from the managed list.
  // If the admin hasn't defined any active flavors yet, the bite stays sellable
  // without a flavor rather than being blocked.
  const isBite        = product.type === 'bite'
  const activeFlavors = useMemo(
    () => (isBite ? allFlavors.filter(f => f.active !== false) : []),
    [isBite, allFlavors]
  )
  const needsFlavor  = isBite && activeFlavors.length > 0
  const flavorChosen = !needsFlavor || !!flavorId

  // Stock cap across all cart lines of this product (every flavor/extras combo)
  const inCart = cartItems.filter(i => i.id === product.id).reduce((s, i) => s + i.quantity, 0)
  const maxQty = typeof product.stock === 'number' && product.stock > 0 ? product.stock : 100
  const canAddMore = Math.max(0, maxQty - inCart)

  const chosen     = available.filter(x => selected[x.id])
  const extrasSum  = chosen.reduce((s, x) => s + x.price, 0)
  const total      = (basePrice + extrasSum) * qty
  const canAdd     = canAddMore > 0 && flavorChosen

  function toggle(id) { setSelected(prev => ({ ...prev, [id]: !prev[id] })) }
  function dec() { setQty(q => Math.max(1, q - 1)) }
  function inc() {
    if (qty >= canAddMore) { toast.error(`Only ${maxQty} available`); return }
    setQty(q => q + 1)
  }

  function handleAdd() {
    if (!flavorChosen) { toast.error('Please pick a flavor first'); return }
    if (canAddMore === 0) { toast.error(`Only ${maxQty} available`); return }
    const toAdd  = Math.min(qty, canAddMore)
    const flavor = needsFlavor ? activeFlavors.find(f => f.id === flavorId) : null
    addToCartWithExtras(
      { ...product, price: basePrice },
      toAdd,
      chosen.map(x => ({ id: x.id, name: x.name, price: x.price })),
      flavor ? { id: flavor.id, name: flavor.name } : null
    )
    toast.success(
      `${toAdd} × ${product.name}${flavor ? ` (${flavor.name})` : ''}` +
      `${chosen.length ? ` + ${chosen.map(x => x.name).join(', ')}` : ''} added to cart`
    )
    onClose()
  }

  return createPortal(
    <div className="modal-overlay bbm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="box-builder-modal" style={{ maxWidth: 480 }}>

        {/* ── HEADER ── */}
        <div className="bbm-header">
          <button className="bbm-close" onClick={onClose} aria-label="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
          <div className="bbm-title-row">
            <FontAwesomeIcon icon={isBite ? faIceCream : faJarWheat} className="bbm-icon" />
            <h3 className="bbm-title">{product.name}</h3>
          </div>
          <p className="bbm-instruction">
            {needsFlavor
              ? `Pick your flavor and quantity${available.length > 0 ? ' — extras optional' : ''}`
              : `Pick your quantity${available.length > 0 ? ' and any extras you’d like' : ''}`}
          </p>
        </div>

        {/* ── BODY ── */}
        <div className="bbm-body">
          {/* Quantity stepper */}
          <div className="exm-row" style={{ marginBottom: (needsFlavor || available.length) ? 18 : 0 }}>
            <span className="exm-row-name">Quantity</span>
            <div className="bbm-stepper">
              <button className="bbm-step-btn" onClick={dec} disabled={qty <= 1} aria-label="Decrease">
                <FontAwesomeIcon icon={faMinus} style={{ fontSize: 9 }} />
              </button>
              <span className="bbm-step-qty">{qty}</span>
              <button className="bbm-step-btn bbm-step-plus" onClick={inc} disabled={qty >= canAddMore} aria-label="Increase">
                <FontAwesomeIcon icon={faPlus} style={{ fontSize: 9 }} />
              </button>
            </div>
          </div>

          {/* Flavor — exactly one, required for bites */}
          {needsFlavor && (
            <>
              <p className="exm-section-label">Flavor <span>(pick exactly one)</span></p>
              <div className="exm-list" style={{ marginBottom: available.length ? 18 : 0 }}>
                {activeFlavors.map(f => {
                  const isOn = flavorId === f.id
                  return (
                    <button key={f.id} type="button" className={`exm-extra${isOn ? ' exm-extra-selected' : ''}`} onClick={() => setFlavorId(f.id)}>
                      <span className={`bbm-radio${isOn ? ' bbm-radio-selected' : ''}`}>
                        {isOn && <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 13 }} />}
                      </span>
                      <span className="exm-extra-name">{f.name}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Extras checkboxes */}
          {available.length > 0 && (
            <>
              <p className="exm-section-label">Extras <span>(optional)</span></p>
              <div className="exm-list">
                {available.map(x => {
                  const isOn = !!selected[x.id]
                  return (
                    <button key={x.id} type="button" className={`exm-extra${isOn ? ' exm-extra-selected' : ''}`} onClick={() => toggle(x.id)}>
                      <span className={`exm-checkbox${isOn ? ' exm-checkbox-on' : ''}`}>
                        {isOn && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 11 }} />}
                      </span>
                      <span className="exm-extra-name">{x.name}</span>
                      <span className="exm-extra-price">(+{x.price} EGP)</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="bbm-footer">
          <div className="bbm-price-block">
            <span className="bbm-price">{total} <small>EGP</small></span>
            <span className="bbm-price-label">
              {basePrice} EGP{extrasSum > 0 ? ` + ${extrasSum} EGP extras` : ''}{qty > 1 ? ` × ${qty}` : ''}
            </span>
          </div>
          <div className="bbm-footer-actions">
            <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!canAdd} style={{ opacity: canAdd ? 1 : 0.55 }}>
              {!flavorChosen
                ? 'Pick a flavor'
                : <><FontAwesomeIcon icon={faCartShopping} style={{ fontSize: 14 }} /> Add {qty > 1 ? `${qty} items` : 'item'} — {total} EGP</>}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  )
}

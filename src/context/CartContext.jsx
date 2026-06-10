/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { computeOfferResult } from '../utils/offerUtils'

const CartContext = createContext()
export function useCart() { return useContext(CartContext) }

const DELIVERY_FEE = 85

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try { const s = localStorage.getItem('melted_cart'); return s ? JSON.parse(s) : [] }
    catch { return [] }
  })
  const [cartOpen, setCartOpen] = useState(false)

  const [appliedOffer, setAppliedOffer] = useState(() => {
    try { const s = localStorage.getItem('melted_offer'); return s ? JSON.parse(s) : null }
    catch { return null }
  })

  const [appliedPromo, setAppliedPromo] = useState(() => {
    try { const s = localStorage.getItem('melted_promo'); return s ? JSON.parse(s) : null }
    catch { return null }
  })

  useEffect(() => { localStorage.setItem('melted_cart', JSON.stringify(cartItems)) }, [cartItems])

  useEffect(() => {
    if (appliedOffer) localStorage.setItem('melted_offer', JSON.stringify(appliedOffer))
    else localStorage.removeItem('melted_offer')
  }, [appliedOffer])

  useEffect(() => {
    if (appliedPromo) localStorage.setItem('melted_promo', JSON.stringify(appliedPromo))
    else localStorage.removeItem('melted_promo')
  }, [appliedPromo])

  // Auto-invalidate offer when the cart no longer meets its requirements
  useEffect(() => {
    if (!appliedOffer || cartItems.length === 0) return
    const { isValid } = computeOfferResult(appliedOffer, cartItems, DELIVERY_FEE)
    if (!isValid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAppliedOffer(null)
      toast('Offer removed — not enough qualifying items in cart', { icon: '⚠️' })
    }
  }, [cartItems, appliedOffer])

  function stockMax(item) {
    return typeof item.stock === 'number' && item.stock > 0 ? item.stock : 100
  }

  function addToCart(product, qty = 1) {
    setCartItems(prev => {
      const exists = prev.find(i => i.id === product.id)
      if (exists) {
        return prev.map(i => {
          if (i.id !== product.id) return i
          return { ...i, quantity: Math.min(i.quantity + qty, stockMax(i)) }
        })
      }
      const max = typeof product.stock === 'number' && product.stock > 0 ? product.stock : 100
      return [...prev, { ...product, quantity: Math.min(qty, max) }]
    })
  }
  function removeFromCart(id) { setCartItems(prev => prev.filter(i => i.id !== id)) }
  function updateQuantity(id, qty) {
    if (qty <= 0) { removeFromCart(id); return }
    setCartItems(prev => prev.map(i => {
      if (i.id !== id) return i
      return { ...i, quantity: Math.min(qty, stockMax(i)) }
    }))
  }
  function clearCart() { setCartItems([]) }

  function addBoxToCart(box, choices) {
    setCartItems(prev => {
      const exists = prev.find(i => i.id === box.id)
      if (exists) {
        return prev.map(i => i.id === box.id ? { ...i, boxChoices: choices } : i)
      }
      return [...prev, { ...box, quantity: 1, boxChoices: choices }]
    })
  }

  // Store only the offer metadata — discount is always recomputed from the live cart.
  // Applying an offer removes any active promo code (no stacking).
  function applyOffer(offer) {
    setAppliedPromo(null)
    setAppliedOffer({
      id:              offer.id,
      title:           offer.title,
      type:            offer.type,
      discountPercent: offer.discountPercent ?? null,
      productId:       offer.productId ?? null,
    })
  }
  function removeOffer() { setAppliedOffer(null) }

  // Applying a promo code removes any active offer (no stacking).
  function applyPromo(promo) {
    setAppliedOffer(null)
    setAppliedPromo({ id: promo.id, code: promo.code, discountPercent: promo.discountPercent })
  }
  function removePromo() { setAppliedPromo(null) }

  const subtotal        = cartItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const deliveryFee     = cartItems.length > 0 ? DELIVERY_FEE : 0
  const total           = subtotal + deliveryFee
  const itemCount       = cartItems.reduce((s, i) => s + i.quantity, 0)
  const requiresDeposit = subtotal > 1000
  const depositAmount   = requiresDeposit ? Math.ceil(subtotal * 0.3) : 0

  const { discountAmount: offerDiscount, finalDeliveryFee: offerDeliveryFee } =
    computeOfferResult(appliedOffer, cartItems, deliveryFee)

  const promoDiscount = appliedPromo
    ? Math.round(subtotal * appliedPromo.discountPercent / 100)
    : 0

  return (
    <CartContext.Provider value={{
      cartItems, cartOpen, setCartOpen,
      addToCart, removeFromCart, updateQuantity, clearCart, addBoxToCart,
      subtotal, deliveryFee, total, itemCount,
      requiresDeposit, depositAmount,
      appliedOffer, applyOffer, removeOffer,
      offerDiscount, offerDeliveryFee,
      appliedPromo, applyPromo, removePromo, promoDiscount,
    }}>
      {children}
    </CartContext.Provider>
  )
}

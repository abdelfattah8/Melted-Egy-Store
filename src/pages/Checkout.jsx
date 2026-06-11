import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, serverTimestamp, doc, getDoc, runTransaction, query, where, getDocs, arrayUnion } from 'firebase/firestore'
import { computeOfferResult, getOfferDisplayUnits } from '../utils/offerUtils'
import { ref, uploadBytesResumable } from 'firebase/storage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCartShopping, faUser, faClipboardList, faTruck, faGift, faCreditCard, faMoneyBill, faWallet, faCamera, faTriangleExclamation, faCircleCheck, faClock, faXmark, faLocationDot, faTrash, faTag } from '@fortawesome/free-solid-svg-icons'
import { db, storage } from '../firebase/config.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import SEO from '../components/SEO.jsx'
import toast from 'react-hot-toast'

function validateForm(form) {
  const errs = {}
  if (!form.name.trim())                                    errs.name    = 'Name is required'
  if (!/^01\d{9}$/.test(form.phone))                       errs.phone   = 'Enter a valid Egyptian number (01xxxxxxxxx)'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))     errs.email   = 'Enter a valid email address'
  if (!form.address.trim())                                 errs.address = 'Address is required'
  return errs
}

function effectivePrice(p) {
  return p.onSale && p.salePrice && p.salePrice < p.price ? p.salePrice : p.price
}

function FieldError({ errors, name }) {
  if (!errors[name]) return null
  return (
    <div className="field-error" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} /> {errors[name]}
    </div>
  )
}


const OFFER_TYPE_LABEL = {
  buy1get1:      'Buy 1 Get 1 Free',
  buy2get1:      'Buy 2 Get 1 Free',
  box_gift:      'Buy Box, Get Bite Free',
  free_delivery: 'Free Delivery',
  custom:        'Custom Discount',
}

function getTomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// Downscale + re-encode an image (canvas) so it is comfortably under the 5 MB Storage
// limit no matter how large the original phone photo is. Falls back to the original file
// if anything goes wrong or compression wouldn't help.
async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  if (!file.type?.startsWith('image/')) return file
  try {
    const dataUrl = await new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload  = () => res(reader.result)
      reader.onerror = rej
      reader.readAsDataURL(file)
    })
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload  = () => res(i)
      i.onerror = rej
      i.src = dataUrl
    })
    const scale  = Math.min(1, maxWidth / img.width)
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(img.width  * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

// Map Firebase Storage error codes to clear, specific user-facing messages.
function uploadErrorMessage(err) {
  switch (err?.code) {
    case 'storage/unauthorized':
      return 'Receipt upload was blocked by the server (permission denied). Please contact us so we can confirm your order manually.'
    case 'storage/retry-limit-exceeded':
      return 'The receipt upload timed out — please check your connection and try again.'
    case 'storage/canceled':
      return 'The receipt upload was canceled — please try again.'
    case 'storage/quota-exceeded':
      return 'Our storage is temporarily full — please contact us to complete your order.'
    default:
      return 'Couldn’t upload your payment receipt — please try again, or contact us if it keeps failing.'
  }
}

export default function Checkout() {
  const { currentUser, userData } = useAuth()
  const { cartItems, subtotal, deliveryFee, requiresDeposit, depositAmount, clearCart, updateQuantity, removeFromCart, appliedOffer, removeOffer, offerDiscount, offerDeliveryFee, appliedPromo, applyPromo, removePromo, promoDiscount } = useCart()
  const navigate = useNavigate()

  const [city,           setCity]           = useState(userData?.city || 'cairo')
  const [paymentMethod,  setPaymentMethod]  = useState('cash')
  const [depositFile,    setDepositFile]    = useState(null)
  const [depositPreview, setDepositPreview] = useState(null)
  const [settings,       setSettings]       = useState({ transferNumber: '', instapayAccount: '' })
  const [loading,        setLoading]        = useState(false)
  const [formErrors,     setFormErrors]     = useState({})
  const [orderNote,      setOrderNote]      = useState('')
  const [deliveryDate,   setDeliveryDate]   = useState('')
  const [promoInput,     setPromoInput]     = useState('')
  const [promoLoading,   setPromoLoading]   = useState(false)
  const [promoError,     setPromoError]     = useState('')

  const [form, setForm] = useState({
    name:    userData?.name    || '',
    phone:   userData?.phone   || '',
    email:   userData?.email   || currentUser?.email || '',
    address: userData?.address || '',
  })

  const needsDeposit       = requiresDeposit && paymentMethod === 'cash'
  const needsTransferUpload = paymentMethod === 'instapay' || paymentMethod === 'wallet'

  const getOrderStatus = () => (needsDeposit || needsTransferUpload) ? 'pending_payment' : 'confirmed'

  // Promo and offer are mutually exclusive — applying one removes the other.
  const effectiveDiscount    = appliedPromo ? promoDiscount : offerDiscount
  const effectiveDeliveryFee = appliedPromo ? deliveryFee  : offerDeliveryFee
  const discountedTotal      = Math.max(0, subtotal - effectiveDiscount) + effectiveDeliveryFee

  useEffect(() => {
    if (userData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({ name: userData.name || '', phone: userData.phone || '', email: userData.email || currentUser?.email || '', address: userData.address || '' })
      setCity(userData.city || 'cairo')
    }
  }, [userData]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'main'))
        if (snap.exists()) setSettings(snap.data())
      } catch (err) { console.error('Settings load failed:', err) }
    }
    loadSettings()
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDepositFile(null); setDepositPreview(null) }, [paymentMethod])

  function handleQtyChange(item, delta) {
    const newQty = item.quantity + delta
    const max = typeof item.stock === 'number' && item.stock > 0 ? item.stock : 100
    if (newQty <= 0) { removeFromCart(item.id); toast(`${item.name} removed`, { icon: <FontAwesomeIcon icon={faTrash} style={{ fontSize: 16 }} /> }) }
    else if (newQty > max) toast.error(`Only ${max} of "${item.name}" available`)
    else updateQuantity(item.id, newQty)
  }

  function handleReceiptFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    // Large phone photos are fine — they're compressed before upload. Cap the raw file
    // generously so we don't choke the browser on something enormous.
    if (file.size > 20 * 1024 * 1024)    { toast.error('Image must be under 20MB'); return }
    setDepositFile(file)
    setDepositPreview(URL.createObjectURL(file))
  }

  if (cartItems.length === 0) {
    return (
      <div className="checkout-page">
        <div className="empty-state">
          <span className="empty-icon"><FontAwesomeIcon icon={faCartShopping} style={{ fontSize: 64, color: 'var(--brown-light)' }} /></span>
          <h3>Your cart is empty</h3>
          <p>Add some products before checking out</p>
          <button className="btn btn-primary mt-6" onClick={() => navigate('/shop')}>Browse Products</button>
        </div>
      </div>
    )
  }

  const set = k => e => { setForm({ ...form, [k]: e.target.value }); setFormErrors(prev => ({ ...prev, [k]: '' })) }

  async function handleApplyPromo() {
    const code = promoInput.trim().toUpperCase()
    if (!code) { setPromoError('Please enter a promo code'); return }
    setPromoLoading(true)
    setPromoError('')
    try {
      const snap = await getDocs(query(collection(db, 'promoCodes'), where('code', '==', code)))
      if (snap.empty)            { setPromoError('Code not found — check the spelling and try again'); setPromoLoading(false); return }
      const data = snap.docs[0].data()
      if (!data.active)          { setPromoError('This code is currently inactive'); setPromoLoading(false); return }
      applyPromo({ id: snap.docs[0].id, code: data.code, discountPercent: data.discountPercent })
      setPromoInput('')
      toast.success(`Promo code applied — ${data.discountPercent}% off! 🎉`)
    } catch (err) {
      console.error(err)
      setPromoError('Could not validate code — please try again')
    }
    setPromoLoading(false)
  }

  async function handleSubmit() {
    const errs = validateForm(form)
    setFormErrors(errs)
    if (Object.keys(errs).length) { toast.error('Please fix the errors below'); return }
    if ((needsDeposit || needsTransferUpload) && !depositFile) { toast.error('Please upload your payment receipt'); return }

    setLoading(true)
    const allIds = [...new Set([...cartItems.map(i => i.id), ...(appliedOffer?.selectedItems || []).map(s => s.id)])]
    const newOrderRef = doc(collection(db, 'orders'))
    let stockErrors = []

    // Upload the payment proof BEFORE creating the order. The order id is generated
    // client-side above, so we can write to deposits/{orderId}/{file} up front. This avoids a
    // post-creation updateDoc on the order (Firestore rules only allow admins to update
    // orders), and uploading first means a failed upload never leaves a silent, receipt-less
    // order behind.
    //
    // IMPORTANT: the customer must NOT call getDownloadURL() here — Storage read on
    // deposits/ is restricted (admin-only in practice), so the read-back was returning 403
    // and being treated as a failed upload. Instead we persist the storage PATH on the order
    // and let the admin panel resolve the URL (the admin is authenticated and may read).
    let paymentProofPath = null
    if ((needsDeposit || needsTransferUpload) && depositFile) {
      try {
        const toUpload    = await compressImage(depositFile)
        const contentType = toUpload.type === 'image/png' ? 'image/png' : 'image/jpeg'
        const ext         = contentType === 'image/png' ? 'png' : 'jpg'
        paymentProofPath  = `deposits/${newOrderRef.id}/proof_${Date.now()}.${ext}`
        const task = uploadBytesResumable(ref(storage, paymentProofPath), toUpload, { contentType })
        await new Promise((res, rej) => task.on('state_changed', null, rej, res))
      } catch (err) {
        // Log the full error + code (e.g. storage/unauthorized) so failures are diagnosable.
        console.error('Payment proof upload failed:', err, '· code:', err?.code)
        toast.error(uploadErrorMessage(err), { duration: 6000 })
        setLoading(false)
        return
      }
    }

    try {
      await runTransaction(db, async (txn) => {
        stockErrors = []
        const priceMap = {}
        const stockMap = {}

        const snaps = await Promise.all(allIds.map(id => txn.get(doc(db, 'products', id))))
        snaps.forEach((snap, i) => {
          if (snap.exists()) {
            priceMap[allIds[i]] = effectivePrice(snap.data())
            const s = snap.data().stock
            if (typeof s === 'number') stockMap[allIds[i]] = s
          }
        })

        for (const item of cartItems) {
          const s = stockMap[item.id]
          if (typeof s === 'number') {
            if (s <= 0) stockErrors.push(`"${item.name}" is currently unavailable`)
            else if (s < item.quantity) stockErrors.push(`"${item.name}": only ${s} available (you ordered ${item.quantity})`)
          }
        }

        if (stockErrors.length > 0) {
          const err = new Error('STOCK_ERROR')
          err.isStockError = true
          throw err
        }

        const verifiedItems    = cartItems.map(i => {
          const base = { id: i.id, name: i.name, price: priceMap[i.id] ?? i.price, quantity: Math.min(i.quantity, stockMap[i.id] ?? 100), category: i.category }
          if (i.type === 'box') { base.type = 'box'; base.boxChoices = i.boxChoices || [] }
          return base
        })
        const verifiedSubtotal = verifiedItems.reduce((s, i) => s + i.price * i.quantity, 0)

        // Recompute offer discount from verified cart — never trust any stored amount.
        // isValid also enforces the one-box-per-BOGO rule; an invalid offer gets no
        // discount and is not recorded on the order.
        const { discountAmount: verifiedOfferDiscount, finalDeliveryFee: verifiedDelivery, isValid: offerStillValid } = computeOfferResult(appliedOffer, verifiedItems, deliveryFee)

        // Re-validate promo code inside the transaction and mark it used atomically
        let verifiedPromoDiscount = 0
        let promoRef = null
        if (appliedPromo) {
          promoRef = doc(db, 'promoCodes', appliedPromo.id)
          const promoSnap = await txn.get(promoRef)
          const checkoutEmail = form.email.toLowerCase().trim()
          const emailAlreadyUsed = (promoSnap.data()?.usedBy || []).includes(checkoutEmail)
          if (!promoSnap.exists() || !promoSnap.data().active || emailAlreadyUsed) {
            const promoMsg = !promoSnap.exists()     ? 'Promo code no longer exists'
              : !promoSnap.data().active             ? 'Promo code is no longer active'
              :                                        'You have already used this promo code'
            throw Object.assign(new Error('PROMO_ERROR'), { isPromoError: true, promoMsg })
          }
          verifiedPromoDiscount = Math.round(verifiedSubtotal * promoSnap.data().discountPercent / 100)
        }

        // Promo and offer are mutually exclusive — whichever is set wins
        const verifiedEffectiveDiscount = appliedPromo ? verifiedPromoDiscount : (offerStillValid ? verifiedOfferDiscount : 0)
        const verifiedEffectiveDelivery = appliedPromo ? deliveryFee           : (offerStillValid ? verifiedDelivery : deliveryFee)
        const verifiedTotal   = Math.max(0, verifiedSubtotal - verifiedEffectiveDiscount) + verifiedEffectiveDelivery
        const verifiedDeposit = needsDeposit ? Math.ceil(verifiedSubtotal * 0.3) : 0

        const orderData = {
          userId: currentUser?.uid || null, isGuest: !currentUser,
          userInfo: { name: form.name.trim(), phone: form.phone.trim(), email: form.email.toLowerCase().trim(), address: form.address.trim(), city },
          items: verifiedItems, subtotal: verifiedSubtotal, deliveryFee: verifiedEffectiveDelivery, total: verifiedTotal,
          appliedOffer: (appliedOffer && !appliedPromo && offerStillValid)
            ? {
                id: appliedOffer.id, title: appliedOffer.title, type: appliedOffer.type, discountAmount: verifiedOfferDiscount,
                // Which bite is the free gift (box_gift) — lets the admin see it on the order
                giftItem: appliedOffer.giftItem ? { id: appliedOffer.giftItem.id, name: appliedOffer.giftItem.name } : null,
              }
            : null,
          appliedPromo: appliedPromo ? { id: appliedPromo.id, code: appliedPromo.code, discountPercent: appliedPromo.discountPercent, discountAmount: verifiedPromoDiscount } : null,
          discountAmount: verifiedEffectiveDiscount, paymentMethod, requiresDeposit: needsDeposit, depositAmount: verifiedDeposit,
          depositStatus: (needsDeposit || needsTransferUpload) ? 'submitted' : 'not_required', paymentProofPath,
          orderNote: orderNote.trim() || null, deliveryDate: deliveryDate || null, status: getOrderStatus(), createdAt: serverTimestamp(),
        }

        txn.set(newOrderRef, orderData)

        // Append customer email to usedBy — atomic with order creation, enforces one-use-per-email
        if (promoRef) txn.update(promoRef, { usedBy: arrayUnion(form.email.toLowerCase().trim()) })

        for (const item of cartItems) {
          const s = stockMap[item.id]
          if (typeof s === 'number') {
            txn.update(doc(db, 'products', item.id), { stock: Math.max(0, s - Math.min(item.quantity, 100)) })
          }
        }
      })

      clearCart(); removeOffer(); removePromo()
      toast.success('Order placed successfully! 🎉')
      navigate('/order-success', { state: { orderId: newOrderRef.id, requiresDeposit: needsDeposit || needsTransferUpload, paymentMethod } })
    } catch (err) {
      if (err.isStockError) stockErrors.forEach(msg => toast.error(msg, { duration: 5000 }))
      else if (err.isPromoError) { removePromo(); toast.error(err.promoMsg, { duration: 5000 }) }
      else { console.error('Order placement error:', err); toast.error('Something went wrong, please try again') }
    }
    setLoading(false)
  }

  const displayUnits = getOfferDisplayUnits(appliedOffer, cartItems)

  return (
    <div className="checkout-page">
      <SEO title="Checkout" description="Complete your order of handcrafted cookies and desserts from Melted Egypt." path="/checkout" />
      <h1>Checkout</h1>
      <div className="checkout-grid">

        {/* ── LEFT ── */}
        <div>
          {!currentUser && (
            <div className="checkout-mode-tabs">
              <button className="checkout-mode-tab active" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FontAwesomeIcon icon={faCartShopping} style={{ fontSize: 15 }} /> Continue as Guest
              </button>
              <button className="checkout-mode-tab" onClick={() => navigate('/login', { state: { from: '/checkout' } })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FontAwesomeIcon icon={faUser} style={{ fontSize: 15 }} /> Sign In
              </button>
            </div>
          )}

          {/* Personal info */}
          <div className="checkout-section">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 18, color: 'var(--brown)' }} /> Your Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input placeholder="Your name" value={form.name} onChange={set('name')} className={formErrors.name ? 'error' : ''} />
                <FieldError errors={formErrors} name="name" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input placeholder="01xxxxxxxxx" value={form.phone} onChange={set('phone')} className={formErrors.phone ? 'error' : ''} />
                <FieldError errors={formErrors} name="phone" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} className={formErrors.email ? 'error' : ''} />
              <FieldError errors={formErrors} name="email" />
            </div>
          </div>

          {/* Delivery */}
          <div className="checkout-section">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FontAwesomeIcon icon={faTruck} style={{ fontSize: 18, color: 'var(--brown)' }} /> Delivery</h3>
            <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 16 }}>
              Delivery available in Cairo and Giza only — <strong style={{ color: 'var(--brown)' }}>85 EGP</strong>
            </p>
            <div className="city-options">
              <div className={`city-option ${city === 'cairo' ? 'selected' : ''}`} onClick={() => setCity('cairo')}>
                <div className="city-icon"><FontAwesomeIcon icon={faLocationDot} style={{ fontSize: 26, color: 'var(--brown)' }} /></div><p>Cairo</p>
              </div>
              <div className={`city-option ${city === 'giza' ? 'selected' : ''}`} onClick={() => setCity('giza')}>
                <div className="city-icon"><FontAwesomeIcon icon={faLocationDot} style={{ fontSize: 26, color: 'var(--brown)' }} /></div><p>Giza</p>
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 20 }}>
              <label className="form-label">Full Address</label>
              <input placeholder="Area, Street, Building number..." value={form.address} onChange={set('address')} className={formErrors.address ? 'error' : ''} />
              <FieldError errors={formErrors} name="address" />
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Preferred Delivery Date <span style={{ fontWeight: 400, color: 'var(--text-light)' }}>(optional)</span></label>
              <input type="date" min={getTomorrowStr()} value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} style={{ maxWidth: 220 }} />
              {deliveryDate && <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>We'll do our best to deliver on your chosen date.</p>}
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Order Notes <span style={{ fontWeight: 400, color: 'var(--text-light)' }}>(optional)</span></label>
              <textarea placeholder="Any special instructions, allergies, or requests..." value={orderNote} onChange={e => setOrderNote(e.target.value)} rows={3} style={{ resize: 'vertical', minHeight: 72 }} />
            </div>
          </div>

          {/* Applied Offer */}
          {appliedOffer ? (
            <div className="checkout-section">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FontAwesomeIcon icon={faGift} style={{ fontSize: 18, color: 'var(--brown)' }} /> Applied Offer</h3>
              <div style={{ padding: '16px 18px', background: 'var(--cream)', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--brown)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--brown-dark)', fontSize: 15, marginBottom: 4 }}>{appliedOffer.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: displayUnits.length ? 10 : 0 }}>
                      {OFFER_TYPE_LABEL[appliedOffer.type] || appliedOffer.type}
                      {appliedOffer.type === 'custom' && appliedOffer.discountPercent ? ` — ${appliedOffer.discountPercent}% off` : ''}
                    </div>
                    {displayUnits.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {displayUnits.map((s, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            {s.imageUrl && <img src={s.imageUrl} alt={s.name} style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />}
                            <span style={{ color: 'var(--brown-dark)', fontWeight: 500 }}>{s.name}</span>
                            <span style={{ color: 'var(--text-light)', textDecoration: s.isFree ? 'line-through' : 'none' }}>{s.price} EGP</span>
                            {s.isFree && <span style={{ fontSize: 11, fontWeight: 700, color: '#2E7D32', background: '#E8F5E9', borderRadius: 4, padding: '1px 6px' }}>FREE</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={removeOffer} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: '2px 4px' }} title="Remove offer">
                    <FontAwesomeIcon icon={faXmark} style={{ fontSize: 18 }} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="checkout-section">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FontAwesomeIcon icon={faGift} style={{ fontSize: 18, color: 'var(--brown)' }} /> Offers</h3>
              <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
                No offer applied.{' '}
                <button onClick={() => navigate('/offers')} style={{ background: 'none', border: 'none', color: 'var(--brown)', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>
                  Browse offers →
                </button>
              </p>
            </div>
          )}

          {/* Promo Code */}
          <div className="checkout-section">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FontAwesomeIcon icon={faTag} style={{ fontSize: 18, color: 'var(--brown)' }} /> Promo Code
            </h3>
            {appliedPromo ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: '#E8F5E9', borderRadius: 'var(--radius-sm)', border: '1.5px solid #A5D6A7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 16, color: '#2E7D32' }} />
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2E7D32', fontSize: 15, letterSpacing: 1 }}>{appliedPromo.code}</span>
                    <span style={{ fontSize: 13, color: '#2E7D32', marginLeft: 10 }}>−{appliedPromo.discountPercent}% off · saves {promoDiscount} EGP</span>
                  </div>
                </div>
                <button
                  onClick={() => { removePromo(); setPromoError('') }}
                  style={{ background: 'none', border: 'none', color: '#2E7D32', cursor: 'pointer', padding: '2px 4px', opacity: 0.7 }}
                  title="Remove promo code"
                >
                  <FontAwesomeIcon icon={faXmark} style={{ fontSize: 18 }} />
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    placeholder="Enter promo code"
                    value={promoInput}
                    onChange={e => { setPromoInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '')); setPromoError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleApplyPromo()}
                    className={promoError ? 'error' : ''}
                    style={{ fontFamily: 'monospace', letterSpacing: 1 }}
                    maxLength={20}
                  />
                  <button
                    className="btn btn-outline"
                    onClick={handleApplyPromo}
                    disabled={promoLoading || !promoInput.trim()}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0, opacity: (promoLoading || !promoInput.trim()) ? 0.55 : 1 }}
                  >
                    {promoLoading ? 'Checking…' : 'Apply'}
                  </button>
                </div>
                {promoError && (
                  <div className="field-error" style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} /> {promoError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="checkout-section">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FontAwesomeIcon icon={faCreditCard} style={{ fontSize: 18, color: 'var(--brown)' }} /> Payment Method</h3>
            <div className="payment-options">
              <div className={`payment-option ${paymentMethod === 'cash' ? 'selected' : ''}`} onClick={() => setPaymentMethod('cash')}>
                <div className="payment-option-radio">{paymentMethod === 'cash' && <div className="radio-dot" />}</div>
                <div>
                  <div className="payment-option-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FontAwesomeIcon icon={faMoneyBill} style={{ fontSize: 15 }} /> Cash on Delivery</div>
                  <div className="payment-option-sub">Pay when your order arrives</div>
                  {paymentMethod === 'cash' && requiresDeposit && (
                    <div className="payment-option-note" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} /> Orders over 1,000 EGP require a 30% deposit first
                    </div>
                  )}
                </div>
              </div>

              <div className={`payment-option ${paymentMethod === 'instapay' ? 'selected' : ''}`} onClick={() => setPaymentMethod('instapay')}>
                <div className="payment-option-radio">{paymentMethod === 'instapay' && <div className="radio-dot" />}</div>
                <div>
                  <div className="payment-option-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FontAwesomeIcon icon={faCreditCard} style={{ fontSize: 15 }} /> InstaPay</div>
                  <div className="payment-option-sub">Transfer the full amount via InstaPay — upload your receipt</div>
                  {paymentMethod === 'instapay' && (
                    <div className="payment-option-note" style={{ color: '#2E7D32', background: '#E8F5E9', borderColor: '#C8E6C9', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 12 }} /> Order confirmed after we verify your transfer
                    </div>
                  )}
                </div>
              </div>

              <div className={`payment-option ${paymentMethod === 'wallet' ? 'selected' : ''}`} onClick={() => setPaymentMethod('wallet')}>
                <div className="payment-option-radio">{paymentMethod === 'wallet' && <div className="radio-dot" />}</div>
                <div>
                  <div className="payment-option-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FontAwesomeIcon icon={faWallet} style={{ fontSize: 15 }} /> Wallet \ محفظة (Vodafone Cash)</div>
                  <div className="payment-option-sub">Transfer via mobile wallet — upload your receipt</div>
                  {paymentMethod === 'wallet' && (
                    <div className="payment-option-note" style={{ color: '#2E7D32', background: '#E8F5E9', borderColor: '#C8E6C9', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 12 }} /> Order confirmed after we verify your transfer
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Deposit for cash > 1000 EGP */}
          {needsDeposit && (
            <div className="checkout-section">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FontAwesomeIcon icon={faWallet} style={{ fontSize: 18, color: 'var(--brown)' }} /> Deposit Required</h3>
              <div className="deposit-box">
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 15 }} /> Order total exceeds 1,000 EGP</h4>
                <p>A 30% deposit is required to confirm your order</p>
                <div className="deposit-amount">{depositAmount} EGP</div>
                <p>Out of subtotal: {subtotal} EGP</p>
              </div>
              {settings.transferNumber && (
                <div className="transfer-box">
                  <span>Transfer to (Vodafone Cash / Wallet):</span>
                  <strong>{settings.transferNumber}</strong>
                </div>
              )}
              {settings.instapayAccount && (
                <div className="transfer-box" style={{ marginTop: 8, background: 'var(--brown-light)' }}>
                  <span>Or via InstaPay:</span>
                  <strong>{settings.instapayAccount}</strong>
                </div>
              )}
              <p style={{ fontSize: 13, color: 'var(--text-light)', margin: '20px 0 8px' }}>Upload transfer receipt:</p>
              <label className="upload-area-v2">
                <input type="file" accept="image/*" onChange={handleReceiptFile} style={{ display: 'none' }} />
                {depositPreview
                  ? <img src={depositPreview} alt="receipt" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, display: 'block', margin: '0 auto' }} />
                  : <div className="upload-placeholder">
                      <div className="upload-icon"><FontAwesomeIcon icon={faCamera} style={{ fontSize: 40, color: 'var(--brown-light)' }} /></div>
                      <p className="upload-text">Click to upload transfer screenshot</p>
                      <p className="upload-hint">JPG, PNG — large photos are optimised automatically</p>
                    </div>
                }
              </label>
            </div>
          )}

          {/* Transfer receipt for InstaPay / Wallet */}
          {needsTransferUpload && (
            <div className="checkout-section">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {paymentMethod === 'instapay'
                  ? <><FontAwesomeIcon icon={faCreditCard} style={{ fontSize: 18, color: 'var(--brown)' }} /> InstaPay Transfer</>
                  : <><FontAwesomeIcon icon={faWallet}     style={{ fontSize: 18, color: 'var(--brown)' }} /> Wallet Transfer</>}
              </h3>
              <div className="deposit-box" style={{ background: 'var(--cream)' }}>
                <p style={{ marginBottom: 6 }}>Transfer the full amount to complete your order:</p>
                <div className="deposit-amount">{discountedTotal} EGP</div>
              </div>
              {paymentMethod === 'instapay' && settings.instapayAccount && (
                <div className="transfer-box" style={{ marginTop: 12, background: 'var(--brown-light)' }}>
                  <span>InstaPay account:</span><strong>{settings.instapayAccount}</strong>
                </div>
              )}
              {paymentMethod === 'wallet' && settings.transferNumber && (
                <div className="transfer-box" style={{ marginTop: 12 }}>
                  <span>Vodafone Cash / Wallet number:</span><strong>{settings.transferNumber}</strong>
                </div>
              )}
              <p style={{ fontSize: 13, color: 'var(--text-light)', margin: '20px 0 8px' }}>Upload transfer receipt:</p>
              <label className="upload-area-v2">
                <input type="file" accept="image/*" onChange={handleReceiptFile} style={{ display: 'none' }} />
                {depositPreview
                  ? <img src={depositPreview} alt="receipt" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, display: 'block', margin: '0 auto' }} />
                  : <div className="upload-placeholder">
                      <div className="upload-icon"><FontAwesomeIcon icon={faCamera} style={{ fontSize: 40, color: 'var(--brown-light)' }} /></div>
                      <p className="upload-text">Click to upload transfer screenshot</p>
                      <p className="upload-hint">JPG, PNG — large photos are optimised automatically</p>
                    </div>
                }
              </label>
            </div>
          )}
        </div>

        {/* ── RIGHT: Order Summary ── */}
        <div>
          <div className="order-summary-card">
            <h3>Order Summary</h3>
            {cartItems.map(item => (
              <div key={item.id} className="summary-item" style={{ alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <div className="summary-item-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {item.type === 'box' && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brown)', background: 'var(--pink-light)', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>BOX</span>
                    )}
                    {item.name}
                  </div>
                  {item.type === 'box' && item.boxChoices?.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 3, lineHeight: 1.5 }}>
                      {item.boxChoices.map(c => c.quantity > 1 ? `${c.name} ×${c.quantity}` : c.name).join(' · ')}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <button className="qty-btn-mini" onClick={() => handleQtyChange(item, -1)}>
                      {item.quantity === 1 ? <FontAwesomeIcon icon={faTrash} style={{ fontSize: 12 }} /> : '−'}
                    </button>
                    <span className="qty-value-mini">{item.quantity}</span>
                    <button className="qty-btn-mini" onClick={() => handleQtyChange(item, 1)} disabled={item.quantity >= (typeof item.stock === 'number' && item.stock > 0 ? item.stock : 100)}>+</button>
                    <span style={{ fontSize: 12, color: 'var(--text-light)' }}>× {item.price} EGP</span>
                  </div>
                </div>
                <div className="summary-item-price" style={{ marginTop: 4 }}>{item.price * item.quantity} EGP</div>
              </div>
            ))}

            <div style={{ borderTop: '1px dashed var(--border)', margin: '8px 0' }} />
            <div className="summary-row"><span>Subtotal</span><span>{subtotal} EGP</span></div>
            <div className="summary-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><FontAwesomeIcon icon={faTruck} style={{ fontSize: 14 }} /> Delivery</span>
              <span>
                {appliedOffer?.type === 'free_delivery'
                  ? <span style={{ color: '#2E7D32', fontWeight: 600 }}>FREE</span>
                  : `${offerDeliveryFee} EGP`}
              </span>
            </div>

            {appliedOffer && !appliedPromo && offerDiscount > 0 && (
              <div className="summary-row" style={{ color: '#2E7D32', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><FontAwesomeIcon icon={faGift} style={{ fontSize: 14 }} /> {appliedOffer.title}</span>
                <span>−{offerDiscount} EGP</span>
              </div>
            )}
            {appliedPromo && promoDiscount > 0 && (
              <div className="summary-row" style={{ color: '#e53935', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FontAwesomeIcon icon={faTag} style={{ fontSize: 14 }} /> Promo ({appliedPromo.code})
                </span>
                <span>−{promoDiscount} EGP</span>
              </div>
            )}

            {needsDeposit && (
              <div className="summary-row" style={{ color: 'var(--brown)', fontWeight: 600 }}>
                <span>Deposit (30%)</span><span>{depositAmount} EGP</span>
              </div>
            )}

            <div className="summary-row total"><span>Total</span><span>{discountedTotal} EGP</span></div>

            {appliedOffer && !appliedPromo && (offerDiscount > 0 || appliedOffer.type === 'free_delivery') && (
              <div style={{ padding: '10px 14px', background: '#E8F5E9', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#2E7D32', fontWeight: 600, marginTop: 8 }}>
                You saved {appliedOffer.type === 'free_delivery' ? `${deliveryFee} EGP on delivery` : `${offerDiscount} EGP`}!
              </div>
            )}
            {appliedPromo && promoDiscount > 0 && (
              <div style={{ padding: '10px 14px', background: '#FFF3E0', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#E65100', fontWeight: 600, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FontAwesomeIcon icon={faTag} style={{ fontSize: 13 }} />
                Code {appliedPromo.code} saves you {promoDiscount} EGP!
              </div>
            )}

            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--cream)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {needsDeposit || needsTransferUpload
                ? <><FontAwesomeIcon icon={faClock} style={{ fontSize: 13 }} /> Confirmed after {needsDeposit ? 'deposit' : 'transfer'} review</>
                : <><FontAwesomeIcon icon={faMoneyBill} style={{ fontSize: 13 }} /> Pay cash on delivery</>}
            </div>
            <button className="btn btn-primary full-width mt-6" onClick={handleSubmit} disabled={loading} style={{ fontSize: 15, padding: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? 'Placing order...' : <><FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 17 }} /> Place Order</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

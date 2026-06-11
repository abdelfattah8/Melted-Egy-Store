import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGift, faCartShopping, faCircleCheck, faTruck, faWandMagicSparkles, faCookieBite, faClock, faBagShopping } from '@fortawesome/free-solid-svg-icons'
import { db } from '../firebase/config.jsx'
import { getOfferProductIds, offerRequiresSelection } from '../utils/offerUtils.js'
import { useCart } from '../context/CartContext.jsx'
import OfferPickerModal from '../components/OfferPickerModal.jsx'
import SEO from '../components/SEO.jsx'
import toast from 'react-hot-toast'

const TYPE_LABEL = {
  buy1get1:      { label: 'Buy 1 Get 1 Free', color: '#5B3121', bg: '#F6CDD0' },
  buy2get1:      { label: 'Buy 2 Get 1 Free', color: '#5B3121', bg: '#F6CDD0' },
  box_gift:      { label: 'Buy Box, Get Bite Free', color: '#7B1FA2', bg: '#F3E5F5' },
  free_delivery: { label: 'Free Delivery',     color: '#2E7D32', bg: '#E8F5E9' },
  custom:        { label: 'Special Discount',  color: '#1565C0', bg: '#E3F2FD' },
}

const requiresSelection = offerRequiresSelection

export default function Offers() {
  const [offers,      setOffers]      = useState([])
  const [products,    setProducts]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [activeOffer, setActiveOffer] = useState(null)
  const navigate = useNavigate()
  const { applyOffer, addToCart } = useCart()

  useEffect(() => {
    async function load() {
      try {
        const [offSnap, prodSnap] = await Promise.all([
          getDocs(query(collection(db, 'offers'), where('active', '==', true))),
          getDocs(collection(db, 'products')),
        ])
        setOffers(offSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) { console.error('Offers load failed:', err) }
      setLoading(false)
    }
    load()
  }, [])

  const getProduct = id => products.find(p => p.id === id)

  function handleOfferClick(offer) {
    if (requiresSelection(offer)) {
      setActiveOffer(offer)
    } else {
      applyOffer(offer)
      toast.success(`Offer applied: ${offer.title}`)
      navigate('/checkout')
    }
  }

  function handleModalConfirm(itemsToAdd, extra) {
    for (const { product, qty } of itemsToAdd) addToCart(product, qty)
    applyOffer(activeOffer, extra)
    setActiveOffer(null)
    toast.success(`Offer applied: ${activeOffer.title}`)
    navigate('/checkout')
  }

  const OfferPlaceholderIcon = ({ type }) => type === 'free_delivery'
    ? <FontAwesomeIcon icon={faTruck} style={{ fontSize: 48, color: 'white' }} />
    : <FontAwesomeIcon icon={faGift}  style={{ fontSize: 48, color: 'white' }} />

  const howItWorks = [
    { step: '1', icon: faGift,         title: 'Pick an Offer',  desc: 'Choose an offer and select your products here' },
    { step: '2', icon: faCartShopping, title: 'Add to Cart',    desc: 'Browse and add your favourite treats' },
    { step: '3', icon: faCircleCheck,  title: 'Enjoy Savings',  desc: 'Discount applied automatically at checkout!' },
  ]

  return (
    <>
      <SEO
        title="Deals & Offers — Save on Cookies & Desserts"
        description="Buy 1 Get 1 Free, free delivery, and custom discounts on handcrafted cookies & desserts. Apply your offer at checkout."
        path="/offers"
      />
      {activeOffer && (
        <OfferPickerModal offer={activeOffer} onConfirm={handleModalConfirm} onCancel={() => setActiveOffer(null)} />
      )}

      <div style={{ minHeight: '60vh', background: 'var(--cream)' }}>
        {/* Hero */}
        <div style={{ background: 'linear-gradient(135deg, #3B1F0F 0%, #5B3121 50%, #8B4513 100%)', padding: '64px 5% 72px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(246,205,208,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(246,205,208,0.08) 0%, transparent 50%)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(246,205,208,0.15)', border: '1px solid rgba(246,205,208,0.3)', borderRadius: 50, padding: '6px 20px', fontSize: 12, fontWeight: 600, color: 'var(--pink)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>
              <FontAwesomeIcon icon={faGift} style={{ fontSize: 14 }} /> Limited Time
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(32px,6vw,56px)', color: 'white', marginBottom: 16, lineHeight: 1.1 }}>
              Sweet Deals &amp; Offers
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, maxWidth: 480, margin: '0 auto 32px' }}>
              Pick your offer right here, then head to checkout — savings applied automatically
            </p>
            <button className="btn" onClick={() => navigate('/shop')}
              style={{ background: 'var(--pink)', color: 'var(--brown-dark)', fontWeight: 700, padding: '14px 36px', borderRadius: 50, border: 'none', cursor: 'pointer', fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <FontAwesomeIcon icon={faBagShopping} style={{ fontSize: 16 }} /> Shop Now
            </button>
          </div>
        </div>

        {/* How it works */}
        <div style={{ background: 'var(--white)', padding: '40px 5%', borderBottom: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, textAlign: 'center' }}>
            {howItWorks.map(s => (
              <div key={s.step}>
                <div style={{ width: 48, height: 48, background: 'var(--cream)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 22, fontWeight: 700, color: 'var(--brown)' }}>{s.step}</div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <FontAwesomeIcon icon={s.icon} style={{ fontSize: 28, color: 'var(--brown)' }} />
                </div>
                <h4 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--brown-dark)', marginBottom: 6 }}>{s.title}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-light)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Offers Grid */}
        <div style={{ padding: '56px 5%', maxWidth: 1200, margin: '0 auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <FontAwesomeIcon icon={faGift} style={{ fontSize: 40, color: 'var(--brown-light)' }} />
              </div>
              <p>Loading offers...</p>
            </div>
          ) : offers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <FontAwesomeIcon icon={faClock} style={{ fontSize: 56, color: 'var(--brown-light)' }} />
              </div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--brown-dark)', marginBottom: 12 }}>No Active Offers Right Now</h3>
              <p style={{ color: 'var(--text-light)', marginBottom: 28 }}>Check back soon — sweet deals are always coming!</p>
              <button className="btn btn-primary" onClick={() => navigate('/shop')}>Browse Products</button>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 48 }}>
                <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--brown)', marginBottom: 10 }}>Available Now</p>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(24px,4vw,38px)', color: 'var(--brown-dark)', marginBottom: 12 }}>Current Promotions</h2>
                <p style={{ color: 'var(--text-light)' }}>{offers.length} active offer{offers.length !== 1 ? 's' : ''} — select one to apply</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
                {offers.map(o => {
                  const linkedProducts = getOfferProductIds(o).map(getProduct).filter(Boolean)
                  const meta = TYPE_LABEL[o.type] || TYPE_LABEL.custom
                  return (
                    <div key={o.id}
                      style={{ background: 'var(--white)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', transition: 'var(--transition)', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.borderColor = 'var(--brown)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = '' }}
                      onClick={() => handleOfferClick(o)}
                    >
                      {o.imageUrl ? (
                        <div style={{ position: 'relative' }}>
                          <img src={o.imageUrl} alt={o.title} loading="lazy" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(30,10,0,0.4) 0%, transparent 50%)' }} />
                        </div>
                      ) : (
                        <div style={{ width: '100%', height: 100, background: 'linear-gradient(135deg, #5B3121, #8B4513)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <OfferPlaceholderIcon type={o.type} />
                        </div>
                      )}

                      <div style={{ padding: '22px 24px 24px' }}>
                        <div style={{ display: 'inline-block', background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 50, marginBottom: 14, letterSpacing: 0.5 }}>
                          {meta.label}{o.type === 'custom' && o.discountPercent ? ` — ${o.discountPercent}% OFF` : ''}
                        </div>

                        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: 'var(--brown-dark)', marginBottom: 10, lineHeight: 1.3 }}>{o.title}</h3>

                        {o.description && <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 16, lineHeight: 1.7 }}>{o.description}</p>}

                        {linkedProducts.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                            {linkedProducts.map(prod => (
                              <div key={prod.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--cream)', borderRadius: 8, fontSize: 13 }}>
                                {prod.imageUrl
                                  ? <img src={prod.imageUrl} alt={prod.name} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6 }} />
                                  : <FontAwesomeIcon icon={faCookieBite} style={{ fontSize: 20, color: 'var(--brown)' }} />
                                }
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--brown)' }}>{prod.name}</div>
                                  <div style={{ color: 'var(--text-light)', fontSize: 12 }}>{prod.price} EGP</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {linkedProducts.length === 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-light)', marginBottom: 16 }}>
                            <FontAwesomeIcon icon={faWandMagicSparkles} style={{ fontSize: 14, color: 'var(--brown-light)' }} /> Applies to all products
                          </div>
                        )}

                        <button
                          className="btn btn-primary"
                          style={{ width: '100%', padding: '12px', fontSize: 14 }}
                          onClick={e => { e.stopPropagation(); handleOfferClick(o) }}
                        >
                          {requiresSelection(o) ? 'Select Products →' : 'Apply Offer →'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ textAlign: 'center', marginTop: 56 }}>
                <p style={{ color: 'var(--text-light)', marginBottom: 20 }}>Ready to order? Pick your offer above, then head to the shop.</p>
                <button className="btn btn-primary" style={{ padding: '14px 40px', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/shop')}>
                  <FontAwesomeIcon icon={faBagShopping} style={{ fontSize: 16 }} /> Start Shopping
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

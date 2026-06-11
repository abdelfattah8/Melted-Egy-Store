import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTruck, faCookieBite, faHeart, faStar, faCamera, faGift, faWandMagicSparkles, faBagShopping, faBoxesPacking ,faHandHoldingHeart,faTruckFast} from '@fortawesome/free-solid-svg-icons'
import ourStory from '../assets/brand/our-story.jpg'
import baker1 from '../assets/brand/cookies-home.jpeg'
import baker3 from '../assets/brand/cheesecake-home.jpeg'
import baker4 from '../assets/brand/tiramisu-home.jpg'
import choco2 from '../assets/brand/download (2).png'
// import choco2 from '../assets/brand/choco-banner-2.jpg'
import catBrownies from '../assets/brand/brownies-home.jpeg'
// import catBrownies from '../assets/brand/cat-brownies.jpg'
// Text-free chocolate texture (derived from choco-banner-2.jpg) — the branding is NOT baked
// in; it's overlaid once as .hero-slogan so it can never duplicate at any crop/aspect ratio.
import chocoHeroBg from '../assets/brand/choco-hero-bg.jpg'
import meltedSlogan from '../assets/brand/melted-slogan-hero.png'
import packaging1 from '../assets/brand/packaging-1.jpg'
import packaging2 from '../assets/brand/packaging-2.jpg'
import { collection, getDocs, query, where, limit } from 'firebase/firestore'
import { db } from '../firebase/config.jsx'
import { offerRequiresSelection } from '../utils/offerUtils.js'
import ProductCard from '../components/ProductCard.jsx'
import { useCart } from '../context/CartContext.jsx'
import OfferPickerModal from '../components/OfferPickerModal.jsx'
import SEO from '../components/SEO.jsx'
import toast from 'react-hot-toast'

const LOCAL_BUSINESS_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Bakery',
  name: 'Melted Egypt',
  description: 'Premium handcrafted cookies, brownies, cheesecake & tiramisu. Fresh baked to order and delivered in Cairo & Giza.',
  url: 'https://meltedegypt.vip',
  logo: 'https://meltedegypt.vip/cookie.png',
  image: 'https://meltedegypt.vip/og-image.jpg',
  servesCuisine: 'Desserts, Cookies, Bakery',
  priceRange: '$$',
  areaServed: ['Cairo', 'Giza'],
  sameAs: [
    'https://www.instagram.com/melted.egypt',
    'https://www.facebook.com/share/18h3nLtYf9/',
  ],
}

function useInView(threshold = 0.12) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return [ref, visible]
}

function Reveal({ children, delay = 0, style = {}, className = '' }) {
  const [ref, visible] = useInView()
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.65s ease ${delay}s, transform 0.65s ease ${delay}s`,
      ...style,
    }}>
      {children}
    </div>
  )
}

const requiresSelection = offerRequiresSelection

function ProductSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-img" />
      <div className="skeleton-body">
        <div className="skeleton skeleton-line short" style={{ marginBottom: 10 }} />
        <div className="skeleton skeleton-line medium" style={{ marginBottom: 10 }} />
        <div className="skeleton skeleton-line" style={{ marginBottom: 18 }} />
        <div className="skeleton skeleton-line" style={{ height: 38, borderRadius: 50 }} />
      </div>
    </div>
  )
}

const deliveryItems = [
  { icon: faTruck,       title: 'Home Delivery',      sub: 'Cairo & Giza' },
  { icon: faCookieBite,  title: 'Always Fresh',        sub: 'Baked to order' },
  { icon: faHeart,       title: 'Premium Ingredients', sub: 'Only the finest quality' },
  { icon: faBoxesPacking, title: 'Elegant Packaging',  sub: 'Perfect for gifting' },
]

const categories = [
  { cat: 'cookies',    img: baker1,      imgAlt: 'Handcrafted Melted cookies',            name: 'Cookies',    desc: 'Classic & stuffed cookies with premium chocolate' },
  { cat: 'brownies',   img: catBrownies, imgAlt: 'Melted signature fudgy brownies',        name: 'Brownies',   desc: 'Fudgy dark chocolate brownies, rich & decadent' },
  { cat: 'cheesecake', img: baker3,      imgAlt: 'Melted creamy cheesecake',               name: 'Cheesecake', desc: 'Creamy cheesecake in multiple flavors' },
  { cat: 'tiramisu',   img: baker4,      imgAlt: 'Melted classic tiramisu with espresso',  name: 'Tiramisu',   desc: 'Authentic Italian tiramisu with espresso' },
]

const whyItems = [
  { icon: faHandHoldingHeart, title: 'Handcrafted',    desc: 'Every item made by hand with care' },
  { icon: faStar,     title: 'Premium Quality', desc: 'Only the finest ingredients' },
  { icon: faCamera,   title: 'Gram-worthy',     desc: 'Beautiful packaging every time' },
  { icon: faTruckFast,     title: 'Fast Delivery',   desc: 'Fresh across Cairo & Giza' },
]

export default function Home() {
  const [featured,    setFeatured]    = useState([])
  const [newItems,    setNewItems]    = useState([])
  const [offers,      setOffers]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [activeOffer, setActiveOffer] = useState(null)
  const navigate = useNavigate()
  const { applyOffer, addToCart } = useCart()

  useEffect(() => {
    async function load() {
      try {
        const [featSnap, newSnap, offerSnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), where('available', '==', true), limit(4))),
          getDocs(query(collection(db, 'products'), where('available', '==', true), where('isNew', '==', true), limit(4))),
          getDocs(query(collection(db, 'offers'), where('active', '==', true))),
        ])
        setFeatured(featSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setNewItems(newSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setOffers(offerSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) { console.error('Home data load failed:', err) }
      setLoading(false)
    }
    load()
  }, [])

  function handleOfferClick(offer) {
    if (requiresSelection(offer)) {
      setActiveOffer(offer)
    } else {
      applyOffer(offer)
      toast.success(`Offer applied: ${offer.title} 🎁`)
      navigate('/checkout')
    }
  }

  function handleModalConfirm(itemsToAdd, extra) {
    for (const { product, qty } of itemsToAdd) addToCart(product, qty)
    applyOffer(activeOffer, extra)
    setActiveOffer(null)
    toast.success(`Offer applied: ${activeOffer.title} 🎁`)
    navigate('/checkout')
  }

  return (
    <>
      <SEO
        description="Premium handcrafted cookies, brownies, cheesecake & tiramisu. Fresh baked to order and delivered across Cairo & Giza, Egypt."
        path="/"
        jsonLd={LOCAL_BUSINESS_SCHEMA}
      />

      {activeOffer && (
        <OfferPickerModal
          offer={activeOffer}
          onConfirm={handleModalConfirm}
          onCancel={() => setActiveOffer(null)}
        />
      )}

      {/* ── HERO ── */}
      {/* One unified implementation at every width: the text-free texture covers the section
          exactly once (cover/center/no-repeat), and badge + slogan + buttons are HTML overlay
          elements rendered exactly once on top. */}
      <section
        className="hero"
        style={{
          backgroundImage: `url(${chocoHeroBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Bottom ~45% darkens so the buttons stay readable over the texture */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, transparent 0%, transparent 55%, rgba(10,3,1,0.82) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Badge — top edge */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', textAlign: 'center', animation: 'fadeInUp 0.8s ease both' }}>
          <div className="hero-badge">✦ Handcrafted with love in Egypt</div>
        </div>

        {/* Brand lockup — title + tagline, centered, at all breakpoints */}
        <img src={meltedSlogan} alt="Melted — Made to melt hearts" className="hero-slogan" />

        {/* Subtitle + buttons — bottom edge, over the dark gradient */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', textAlign: 'center', animation: 'fadeInUp 0.8s ease 0.3s both' }}>
          <div className="hero-buttons">
            <button className="hero-btn-main" onClick={() => navigate('/shop')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <FontAwesomeIcon icon={faBagShopping} style={{ fontSize: 17 }} /> Order Now
            </button>
            <button className="hero-btn-outline" onClick={() => navigate('/new-items')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <FontAwesomeIcon icon={faWandMagicSparkles} style={{ fontSize: 17 }} /> New Items
            </button>
          </div>
        </div>
      </section>

      {/* ── ACTIVE OFFERS ── */}
      {offers.length > 0 && (
        <section className="section" style={{ background: 'linear-gradient(135deg, #3B1F0F 0%, #5B3121 100%)', paddingTop: 56, paddingBottom: 64 }}>
          <Reveal style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-block', background: 'rgba(246,205,208,0.15)', border: '1px solid rgba(246,205,208,0.3)', borderRadius: 50, padding: '5px 18px', fontSize: 11, fontWeight: 600, color: 'var(--pink)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
              <FontAwesomeIcon icon={faGift} style={{ fontSize: 13, verticalAlign: 'middle', marginLeft: 4 }} /> Limited Time
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(24px,4vw,38px)', color: 'white', marginBottom: 10 }}>Sweet Deals</h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15 }}>Apply any offer at checkout — tap to get started</p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
            {offers.map((o, i) => (
              <Reveal key={o.id} delay={i * 0.1}>
                <div
                  onClick={() => handleOfferClick(o)}
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(246,205,208,0.2)', borderRadius: 'var(--radius)', overflow: 'hidden', cursor: 'pointer', transition: 'var(--transition)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; e.currentTarget.style.borderColor = 'rgba(246,205,208,0.5)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(246,205,208,0.2)'; e.currentTarget.style.transform = '' }}
                >
                  {o.imageUrl && (
                    <img src={o.imageUrl} alt={o.title} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                  )}
                  {!o.imageUrl && (
                    <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                      {o.type === 'free_delivery'
                        ? <FontAwesomeIcon icon={faTruck} style={{ fontSize: 20, color: 'white' }} />
                        : <FontAwesomeIcon icon={faGift}  style={{ fontSize: 20, color: 'white' }} />}
                    </div>
                  )}
                  <div style={{ padding: '16px 20px 20px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pink)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                      {o.type === 'buy1get1' ? 'Buy 1 Get 1' : o.type === 'buy2get1' ? 'Buy 2 Get 1' : o.type === 'free_delivery' ? 'Free Delivery' : o.discountPercent ? `${o.discountPercent}% Off` : 'Special Offer'}
                    </div>
                    <h4 style={{ fontFamily: "'Playfair Display', serif", color: 'white', fontSize: 18, marginBottom: 8, lineHeight: 1.3 }}>{o.title}</h4>
                    {o.description && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{o.description}</p>}
                    <div style={{ marginTop: 14, fontSize: 12, color: 'rgba(246,205,208,0.7)', fontWeight: 600 }}>
                      {requiresSelection(o) ? 'Tap to select products' : 'Tap to apply offer'} →
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal style={{ textAlign: 'center', marginTop: 36 }}>
            <button
              onClick={() => navigate('/offers')}
              style={{ background: 'transparent', border: '2px solid rgba(246,205,208,0.5)', color: 'var(--pink)', borderRadius: 50, padding: '11px 32px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'var(--transition)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(246,205,208,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              View All Offers →
            </button>
          </Reveal>
        </section>
      )}

      {/* ── DELIVERY BANNER ── */}
      <div className="delivery-banner">
        {deliveryItems.map((item, i) => (
          <Reveal key={i} delay={i * 0.1} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
            <div className="delivery-icon">
              <FontAwesomeIcon icon={item.icon} style={{ fontSize: 40, color: 'white' }} />
            </div>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 19 }}>{item.title}</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{item.sub}</p>
          </Reveal>
        ))}
      </div>

      {/* ── NEW ITEMS ── */}
      {newItems.length > 0 && (
        <section className="section" style={{ background: 'var(--cream-dark)' }}>
          <Reveal style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <span className="new-badge-large" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>NEW <FontAwesomeIcon icon={faWandMagicSparkles} style={{ fontSize: 12 }} /></span>
                <h2 className="section-title" style={{ margin: 0 }}>Just Arrived</h2>
              </div>
              <p style={{ color: 'var(--text-light)', fontSize: 15 }}>Fresh additions — be the first to try them!</p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/new-items')}>View All New →</button>
          </Reveal>
          <div className="products-grid">
            {newItems.map((p, i) => <Reveal key={p.id} delay={i * 0.1}><ProductCard product={p} /></Reveal>)}
          </div>
        </section>
      )}

      {/* ── OUR STORY ── */}
      <section className="section" style={{ background: '#FFF8F0' }}>
        {/* Centered heading */}
        <Reveal style={{ textAlign: 'center', marginBottom: 52 }}>
          <p className="section-label">Our Story</p>
          <h2 className="section-title">Born from a love of homemade sweets</h2>
        </Reveal>

        {/* Two-column body */}
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 64,
          alignItems: 'center',
        }}>
          {/* Image column */}
          <Reveal>
            <img
              src={ourStory}
              alt="The story behind Melted Egypt — baking with love"
              loading="lazy"
              style={{
                width: '100%',
                borderRadius: 24,
                boxShadow: '0 20px 60px rgba(91,49,33,0.18)',
                objectFit: 'cover',
                maxHeight: 420,
                display: 'block',
              }}
            />
          </Reveal>

          {/* Text column */}
          <Reveal delay={0.2}>
            <p style={{ color: 'var(--text-light)', fontSize: 16, lineHeight: 1.9, marginBottom: 16 }}>
              Melted was created from a love for homemade desserts made with warmth, comfort, and premium quality ingredients. Every treat is crafted by hand, using only the finest chocolate and freshest dairy.
            </p>
            <p style={{ color: 'var(--text-light)', fontSize: 16, lineHeight: 1.9, marginBottom: 28 }}>
              From fudgy brownies to melt-in-your-mouth cookies — every bite is a moment of joy, delivered right to your door.
            </p>
            <div style={{ borderLeft: '3px solid var(--pink-dark)', paddingLeft: 20, marginBottom: 32 }}>
              <p style={{ color: 'var(--brown)', fontSize: 22, fontFamily: "'Playfair Display',serif", fontStyle: 'italic', lineHeight: 1.4 }}>
                "Made to melt hearts"
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/shop')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              Explore Our Menu →
            </button>
          </Reveal>
        </div>
      </section>

      

      {/* ── CATEGORIES ── */}
      <section className="section" style={{ background: 'var(--cream-dark)' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 52 }}>
          <p className="section-label">Categories</p>
          <h2 className="section-title">Something for Everyone</h2>
          <p className="section-sub" style={{ marginBottom: 0 }}>From rich brownies to creamy cheesecake — discover your favourite</p>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
          {categories.map(({ cat, img, imgAlt, name, desc }, i) => (
            <Reveal key={cat} delay={i * 0.1}>
              <div
                onClick={() => navigate(`/shop?cat=${cat}`)}
                style={{
                  background: 'var(--white)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  border: '1px solid var(--border)',
                  transition: 'var(--transition)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-7px)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-hover)'
                  e.currentTarget.style.borderColor = 'var(--pink-dark)'
                  const im = e.currentTarget.querySelector('img')
                  if (im) im.style.transform = 'scale(1.08)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.boxShadow = ''
                  e.currentTarget.style.borderColor = ''
                  const im = e.currentTarget.querySelector('img')
                  if (im) im.style.transform = ''
                }}
              >
                {/* Photo */}
                <div style={{ overflow: 'hidden', height: 200 }}>
                  <img
                    src={img}
                    alt={imgAlt}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      transition: 'transform 0.5s ease',
                    }}
                  />
                </div>
                {/* Text */}
                <div style={{ padding: '20px 22px 24px' }}>
                  <h3 style={{ fontFamily: "'Playfair Display',serif", color: 'var(--brown-dark)', marginBottom: 8, fontSize: 21 }}>{name}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 1.7, marginBottom: 14 }}>{desc}</p>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brown)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    Shop {name} <span style={{ transition: 'transform 0.3s ease' }}>→</span>
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ── */}
      <section className="section" style={{ background: 'var(--cream)' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 48 }}>
          <p className="section-label">Most Popular</p>
          <h2 className="section-title">Featured Products</h2>
          <p className="section-sub">Our most-loved handcrafted treats</p>
        </Reveal>
        <div className="products-grid">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
            : featured.map((p, i) => <Reveal key={p.id} delay={i * 0.1}><ProductCard product={p} /></Reveal>)
          }
        </div>
        {!loading && (
          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <button className="btn btn-outline" onClick={() => navigate('/shop')}>View All Products →</button>
          </div>
        )}
      </section>

      {/* ── ELEGANT PACKAGING ── */}
      <section className="section" style={{ background: 'var(--white)' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 56 }}>
          <p className="section-label">Elegant Packaging</p>
          <h2 className="section-title">Gift-Ready, Every Time</h2>
          <p className="section-sub">
            Every order arrives beautifully boxed in our signature Melted packaging — handcrafted, premium, and ready to gift straight from your door.
          </p>
        </Reveal>

        {/* Main 3-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          maxWidth: 1100,
          margin: '0 auto',
        }}>
          {/* packaging-1 photo */}
          <Reveal>
            <div
              style={{
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow)',
                height: 400,
                transition: 'box-shadow 0.3s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = 'var(--shadow-hover)'
                const im = e.currentTarget.querySelector('img')
                if (im) im.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'var(--shadow)'
                const im = e.currentTarget.querySelector('img')
                if (im) im.style.transform = ''
              }}
            >
              <img
                src={packaging1}
                alt="Melted Egypt signature gift box packaging"
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.5s ease' }}
              />
            </div>
          </Reveal>

          {/* Copy card */}
          <Reveal delay={0.15}>
            <div style={{
              background: 'var(--brown)',
              borderRadius: 'var(--radius)',
              padding: '44px 36px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              height: 400,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: 'var(--pink)', textTransform: 'uppercase', marginBottom: 16 }}>Premium Gifting</p>
              <h3 style={{ fontFamily: "'Playfair Display',serif", color: 'white', fontSize: 26, lineHeight: 1.35, marginBottom: 18 }}>
                Every box tells a story
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 15, lineHeight: 1.85, marginBottom: 28 }}>
                Our gift boxes are designed to impress before the first bite. Sturdy, beautiful, and fully branded — Melted packaging turns every order into a memorable moment.
              </p>
              {/* <button
                className="btn btn-pink"
                onClick={() => navigate('/shop')}
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                Shop Gifts <FontAwesomeIcon icon={faGift} style={{ fontSize: 14 }} />
              </button> */}
            </div>
          </Reveal>

          {/* packaging-2 photo */}
          <Reveal delay={0.3}>
            <div
              style={{
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow)',
                height: 400,
                transition: 'box-shadow 0.3s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = 'var(--shadow-hover)'
                const im = e.currentTarget.querySelector('img')
                if (im) im.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'var(--shadow)'
                const im = e.currentTarget.querySelector('img')
                if (im) im.style.transform = ''
              }}
            >
              <img
                src={packaging2}
                alt="Melted Egypt premium cookie gift box"
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.5s ease' }}
              />
            </div>
          </Reveal>
        </div>

        {/* cat-brownies branded accent strip */}
        <Reveal delay={0.1} style={{ maxWidth: 1100, margin: '24px auto 0' }}>
          <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', position: 'relative', height: 170, boxShadow: 'var(--shadow-sm)' }}>
            <img
              src={choco2}
              alt="Melted Egypt branded brownies with signature tag"
              loading="lazy"
              style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(61,33,21,0.78) 0%, rgba(61,33,21,0.15) 55%, transparent 100%)' }} />
            <div style={{ position: 'absolute', top: '50%', left: 36, transform: 'translateY(-50%)' }}>
              <p style={{ color: 'var(--pink)', fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>Signature Touch</p>
              <p style={{ color: 'white', fontFamily: "'Playfair Display',serif", fontSize: 20, fontStyle: 'italic' }}>Every detail, perfected.</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── WHY MELTED ── */}
      <section className="section" style={{ background: 'var(--brown)', color: 'white' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 52 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(246,205,208,0.7)', marginBottom: 12 }}>Why Melted?</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', color: 'white', fontFamily: "'Playfair Display',serif" }}>Made with Love, Delivered with Care</h2>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 36, maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          {whyItems.map(({ icon, title, desc }, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
                <FontAwesomeIcon icon={icon} style={{ fontSize: 44, color: 'var(--pink)' }} />
              </div>
              <h4 style={{ fontFamily: "'Playfair Display',serif", color: 'var(--pink)', marginBottom: 8, fontSize: 18 }}>{title}</h4>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>{desc}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  )
}

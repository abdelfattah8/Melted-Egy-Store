import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeart, faCartShopping, faGift, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import logo from '../assets/brand/melted-logo.png'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useWishlist } from '../context/WishlistContext.jsx'
import toast from 'react-hot-toast'

function NewBadge() {
  return (
    <span style={{ background: 'var(--brown)', color: 'var(--pink)', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 50, marginLeft: 4, verticalAlign: 'middle' }}>
      NEW
    </span>
  )
}

function WishlistBtn({ wishlistCount, onClick }) {
  return (
    <Link to="/wishlist" onClick={onClick} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', color: wishlistCount > 0 ? '#e53935' : 'var(--text-light)' }}>
      <FontAwesomeIcon icon={faHeart} beat={wishlistCount > 0} className="icon-heart" style={{ fontSize: 20 }} />
      {wishlistCount > 0 && <span className="cart-badge" style={{ background: '#e53935', position: 'absolute', top: -8, right: -10 }}>{wishlistCount}</span>}
    </Link>
  )
}

function CartBtn({ itemCount, onClick }) {
  return (
    <Link to="/checkout" className="cart-btn" onClick={onClick}>
      <FontAwesomeIcon icon={faCartShopping} style={{ fontSize: 20 }} className="icon-cart" />
      {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
    </Link>
  )
}

export default function Navbar() {
  const { currentUser, userData, logout } = useAuth()
  const { itemCount }     = useCart()
  const { wishlistCount } = useWishlist()
  const [open, setOpen]   = useState(false)
  const navigate          = useNavigate()
  const navRef            = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (navRef.current && !navRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    await logout()
    toast.success('Logged out successfully')
    navigate('/')
    setOpen(false)
  }

  const close = () => setOpen(false)

  return (
    <nav className="navbar" ref={navRef}>

      {/* ── Logo ── */}
      <Link to="/" className="navbar-logo">
        <img src={logo} alt="Melted" style={{ height: 40, width: 'auto', maxWidth: '100%', display: 'block' }} />
      </Link>

      {/* ── Desktop center links ── */}
      <div className="navbar-center">
        <Link to="/">Home</Link>
        <Link to="/shop">Shop</Link>
        <Link to="/new-items"><NewBadge /></Link>
        <Link to="/offers" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <FontAwesomeIcon bounce icon={faGift} style={{ fontSize: 15 }} /> Offers
        </Link>
        <Link to="/my-orders">My Orders</Link>
        <Link to="/profile">My Account</Link>
      </div>

      {/* ── Desktop right actions ── */}
      <div className="navbar-actions">
        {currentUser ? (
          <>
            {userData?.isAdmin && <Link to="/admin">Admin</Link>}
            <button className="nav-logout-btn" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Sign In</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Create Account</Link>
          </>
        )}
        
        <WishlistBtn wishlistCount={wishlistCount} />

        <CartBtn itemCount={itemCount} />
      </div>

      {/* ── Mobile: wishlist + hamburger ── */}
      <div className="navbar-mobile-right">
        <WishlistBtn wishlistCount={wishlistCount} />
        <button className="hamburger" onClick={() => setOpen(!open)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </div>

      {/* ── Mobile dropdown menu ── */}
      <div className={`navbar-mobile-menu ${open ? 'open' : ''}`}>
        <Link to="/"          onClick={close}>Home</Link>
        <Link to="/shop"      onClick={close}>Shop</Link>
        <Link to="/new-items" onClick={close} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          New <FontAwesomeIcon icon={faWandMagicSparkles} style={{ fontSize: 14, color: 'var(--brown)' }} />
        </Link>
        <Link to="/offers" onClick={close} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FontAwesomeIcon icon={faGift} style={{ fontSize: 15 }} /> Offers
        </Link>
        <Link to="/my-orders" onClick={close}>My Orders</Link>
        <Link to="/profile"   onClick={close}>My Account</Link>

        {currentUser ? (
          <>
            {userData?.isAdmin && <Link to="/admin" onClick={close}>Admin</Link>}
            <button className="nav-logout-btn" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login"    onClick={close}>Sign In</Link>
            <Link to="/register" className="btn btn-primary btn-sm" onClick={close}>Create Account</Link>
          </>
        )}

        <CartBtn itemCount={itemCount} onClick={close} />
      </div>
    </nav>
  )
}

import { Suspense } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChartBar, faBox, faBagShopping, faGift, faGear, faGlobe, faRightFromBracket, faTag } from '@fortawesome/free-solid-svg-icons'
import logoPink from '../../assets/brand/melted-logo-pink.png'
import { useAuth } from '../../context/AuthContext.jsx'
import { InlineLoader } from '../../components/Loader.jsx'
import toast from 'react-hot-toast'

export default function AdminLayout() {
  const { logout } = useAuth()
  const navigate   = useNavigate()

  async function handleLogout() {
    await logout()
    toast.success('Logged out')
    navigate('/')
  }

  const links = [
    { to: '/admin',          label: 'Dashboard', icon: faChartBar,        end: true },
    { to: '/admin/products', label: 'Products',  icon: faBox },
    { to: '/admin/orders',   label: 'Orders',    icon: faBagShopping },
    { to: '/admin/offers',       label: 'Offers',       icon: faGift },
    { to: '/admin/promo-codes',  label: 'Promo Codes',  icon: faTag },
    { to: '/admin/settings',     label: 'Settings',     icon: faGear },
  ]

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <img src={logoPink} alt="Melted" style={{ height: 34, width: 'auto', maxWidth: '100%', display: 'block', marginBottom: 6 }} />
          <small>Admin Panel</small>
        </div>

        <nav className="admin-nav">
          {links.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon"><FontAwesomeIcon icon={icon} style={{ fontSize: 18 }} /></span> {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <NavLink to="/" className="admin-nav-link">
            <span className="nav-icon"><FontAwesomeIcon icon={faGlobe} style={{ fontSize: 18 }} /></span> View Site
          </NavLink>
          <button
            onClick={handleLogout}
            className="admin-nav-link"
            style={{ width: '100%', background: 'none', color: 'rgba(255,255,255,0.65)', border: 'none', textAlign: 'right' }}
          >
            <span className="nav-icon"><FontAwesomeIcon icon={faRightFromBracket} style={{ fontSize: 18 }} /></span> Logout
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <Suspense fallback={<InlineLoader text="Loading..." />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

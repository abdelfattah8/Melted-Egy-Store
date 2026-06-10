import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBagShopping, faArrowTrendUp, faClock, faCookieBite } from '@fortawesome/free-solid-svg-icons'
import { db } from '../../firebase/config.jsx'
import { InlineLoader } from '../../components/Loader.jsx'

const STATUS_LABELS = {
  pending_deposit:  'Awaiting Deposit',
  pending_approval: 'Pending Approval',
  confirmed:        'Confirmed',
  preparing:        'Preparing',
  delivered:        'Delivered',
  cancelled:        'Cancelled',
}

export default function AdminDashboard() {
  const [stats, setStats]         = useState({ orders: 0, revenue: 0, pending: 0, products: 0 })
  const [recentOrders, setRecent] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [ordersSnap, productsSnap] = await Promise.all([
          getDocs(collection(db, 'orders')),
          getDocs(collection(db, 'products')),
        ])

        const orders  = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0)
        const pending = orders.filter(o => o.status === 'pending_approval' || o.status === 'pending_payment').length

        setStats({ orders: orders.length, revenue, pending, products: productsSnap.size })

        const sorted = orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        setRecent(sorted.slice(0, 5))
      } catch (err) { console.error(err) }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <InlineLoader text="Loading dashboard..." />

  const statCards = [
    { icon: faBagShopping,  value: stats.orders,                   label: 'Total Orders' },
    { icon: faArrowTrendUp, value: stats.revenue.toLocaleString(), label: 'Revenue (EGP)' },
    { icon: faClock,        value: stats.pending,                  label: 'Pending Approval' },
    { icon: faCookieBite,   value: stats.products,                 label: 'Products' },
  ]

  return (
    <>
      <h2 className="admin-page-title">Dashboard</h2>

      <div className="stats-grid">
        {statCards.map(({ icon, value, label }) => (
          <div className="stat-card" key={label}>
            <div className="stat-icon"><FontAwesomeIcon icon={icon} style={{ fontSize: 28, color: 'var(--brown)' }} /></div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <h3 style={{ color: 'var(--brown-dark)', marginBottom: 16 }}>Recent Orders</h3>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>City</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map(o => (
              <tr key={o.id}>
                <td style={{ fontFamily: 'monospace' }}>#{o.id.slice(0, 8).toUpperCase()}</td>
                <td>{o.userInfo?.name || 'Guest'}</td>
                <td style={{ textTransform: 'capitalize' }}>{o.userInfo?.city || '—'}</td>
                <td style={{ fontWeight: 600 }}>{o.total} EGP</td>
                <td><span className={`status-badge status-${o.status}`}>{STATUS_LABELS[o.status] || o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

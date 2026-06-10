import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBox, faCreditCard, faWallet, faTruck, faLocationDot, faXmark, faClock, faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import { db } from '../firebase/config.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNavigate } from 'react-router-dom'
import { InlineLoader } from '../components/Loader.jsx'
import SEO from '../components/SEO.jsx'

const STATUS_LABELS = {
  pending_payment:  'Awaiting Confirmation',
  pending_deposit:  'Awaiting Deposit',
  pending_approval: 'Pending Approval',
  confirmed:        'Confirmed',
  preparing:        'Being Prepared',
  delivered:        'Delivered',
  cancelled:        'Cancelled',
}

export default function MyOrders() {
  const { currentUser } = useAuth()
  const [orders,   setOrders]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [whatsapp, setWhatsapp] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      if (!currentUser) return
      try {
        const q = query(collection(db, 'orders'), where('userId', '==', currentUser.uid))
        const snap = await getDocs(q)
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        setOrders(data)

        const settingsSnap = await getDoc(doc(db, 'settings', 'main'))
        if (settingsSnap.exists()) {
          const num = settingsSnap.data().whatsappNumber || settingsSnap.data().transferNumber || ''
          setWhatsapp(num.replace(/[^0-9]/g, ''))
        }
      } catch (err) { console.error('Orders error:', err) }
      setLoading(false)
    }
    load()
  }, [currentUser])

  function openWhatsApp(orderId, action = 'modify') {
    const shortId = orderId.slice(0, 8).toUpperCase()
    const msg = action === 'cancel'
      ? `Hello, I would like to cancel my order #${shortId}`
      : `Hello, I would like to modify my order #${shortId}`
    const number = whatsapp.startsWith('0') ? '2' + whatsapp : whatsapp
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  if (loading) return <div className="orders-page"><InlineLoader text="Loading your orders..." /></div>

  return (
    <div className="orders-page">
      <SEO title="My Orders" description="Track and manage your Melted Egypt orders." path="/my-orders" />
      <h1 style={{ color: 'var(--brown-dark)', marginBottom: 8, fontSize: 34 }}>My Orders</h1>
      <p style={{ color: 'var(--text-light)', marginBottom: 36 }}>Track and manage all your Melted orders</p>

      {orders.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon"><FontAwesomeIcon icon={faBox} style={{ fontSize: 64, color: 'var(--brown-light)' }} /></span>
          <h3>No orders yet</h3>
          <p>Once you place an order, it'll show up here</p>
          <button className="btn btn-primary mt-6" onClick={() => navigate('/shop')}>Start Shopping</button>
        </div>
      ) : (
        orders.map((order, i) => (
          <div key={order.id} className="order-card" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="order-card-header">
              <div>
                <div style={{ fontWeight: 700, color: 'var(--brown-dark)', marginBottom: 3, fontSize: 15 }}>
                  Order #{order.id.slice(0, 8).toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {order.createdAt?.toDate
                    ? order.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'Just placed'}
                  {order.paymentMethod === 'instapay' && (
                    <span style={{ background: '#E3F2FD', color: '#1565C0', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 50, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: 11 }} /> InstaPay
                    </span>
                  )}
                  {order.paymentMethod === 'wallet' && (
                    <span style={{ background: '#F3E5F5', color: '#6A1B9A', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 50, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <FontAwesomeIcon icon={faWallet} style={{ fontSize: 11 }} /> Wallet
                    </span>
                  )}
                </div>
              </div>
              <span className={`status-badge status-${order.status}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>

            <div className="order-card-body">
              {order.items?.map((item, j) => (
                <div key={j} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span>
                      {item.type === 'box' && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brown)', background: 'var(--pink-light)', borderRadius: 4, padding: '1px 6px', marginLeft: 4, verticalAlign: 'middle' }}>BOX</span>
                      )}
                      {item.name} <span style={{ color: 'var(--text-light)' }}>× {item.quantity}</span>
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--brown)' }}>{item.price * item.quantity} EGP</span>
                  </div>
                  {item.type === 'box' && item.boxChoices?.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 3 }}>
                      {item.boxChoices.map(c => c.quantity > 1 ? `${c.name} ×${c.quantity}` : c.name).join(' · ')}
                    </div>
                  )}
                </div>
              ))}

              <div style={{ marginTop: 12 }}>
                {order.deliveryFee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-light)', marginBottom: 4 }}>
                    <span>Delivery</span><span>{order.deliveryFee} EGP</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--brown-dark)', fontSize: 17 }}>
                  <span>Total</span><span>{order.total} EGP</span>
                </div>
              </div>

              {order.requiresDeposit && (
                <div style={{ marginTop: 10 }}>
                  <span className={`status-badge status-${order.status === 'pending_payment' ? 'pending_payment' : 'confirmed'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {order.status === 'pending_payment'
                      ? <><FontAwesomeIcon icon={faClock} style={{ fontSize: 12 }} /> Deposit under review</>
                      : <><FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 12 }} /> Deposit approved</>}
                  </span>
                </div>
              )}
              {!order.requiresDeposit && (order.paymentMethod === 'instapay' || order.paymentMethod === 'wallet') && order.status === 'pending_payment' && (
                <div style={{ marginTop: 10 }}>
                  <span className="status-badge status-pending_payment" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <FontAwesomeIcon icon={faClock} style={{ fontSize: 12 }} /> Transfer under review
                  </span>
                </div>
              )}

              {order.deliveryEstimate && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: '#E8F5E9', borderRadius: 8, fontSize: 13, color: '#2E7D32', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FontAwesomeIcon icon={faTruck} style={{ fontSize: 14 }} /> {order.deliveryEstimate}
                </div>
              )}

              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <FontAwesomeIcon icon={faLocationDot} style={{ fontSize: 13 }} /> {order.userInfo?.city === 'cairo' ? 'Cairo' : 'Giza'} — {order.userInfo?.address}
              </div>

              {order.status !== 'delivered' && order.status !== 'cancelled' && whatsapp && (
                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => openWhatsApp(order.id, 'modify')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 50, background: '#25D366', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}
                  >
                    <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: 15 }} /> Modify Order
                  </button>
                  <button
                    onClick={() => openWhatsApp(order.id, 'cancel')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 50, background: 'transparent', color: '#e53935', border: '1.5px solid #e53935', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}
                  >
                    <FontAwesomeIcon icon={faXmark} style={{ fontSize: 14 }} /> Cancel Order
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

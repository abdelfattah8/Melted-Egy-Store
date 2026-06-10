import { useEffect, useState } from 'react'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation, faArrowsRotate, faEye, faXmark, faCircleCheck, faTruck, faCalendarDays, faBox, faCreditCard, faMoneyBill, faWallet } from '@fortawesome/free-solid-svg-icons'
import { ref, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase/config.jsx'
import { InlineLoader } from '../../components/Loader.jsx'
import toast from 'react-hot-toast'

const ALL_STATUSES = ['pending_payment', 'pending_approval', 'confirmed', 'preparing', 'delivered', 'cancelled']

const STATUS_LABELS = {
  pending_payment:  'Pending Payment',
  pending_approval: 'Pending Approval',
  confirmed:        'Confirmed',
  preparing:        'Preparing',
  delivered:        'Delivered',
  cancelled:        'Cancelled',
}

const PAYMENT_LABELS = {
  cash:     'Cash',
  instapay: 'InstaPay',
  wallet:   'Wallet',
  visa:     'Visa',
}

const PaymentIcon = ({ method, size = 14 }) => {
  if (method === 'cash')   return <FontAwesomeIcon icon={faMoneyBill}  style={{ fontSize: size, marginLeft: 4, verticalAlign: 'middle' }} />
  if (method === 'wallet') return <FontAwesomeIcon icon={faWallet}     style={{ fontSize: size, marginLeft: 4, verticalAlign: 'middle' }} />
  return                          <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: size, marginLeft: 4, verticalAlign: 'middle' }} />
}

export default function AdminOrders() {
  const [orders,           setOrders]           = useState([])
  const [loading,          setLoading]          = useState(true)
  const [filter,           setFilter]           = useState('all')
  const [viewing,          setViewing]          = useState(null)
  const [confirmingId,     setConfirmingId]     = useState(null)
  const [deliveryEstimate, setDeliveryEstimate] = useState('')
  const [proofUrl,         setProofUrl]         = useState(null)
  const [proofLoading,     setProofLoading]     = useState(false)

  // Resolve the payment-proof image when an order is opened. New orders store a storage
  // PATH (paymentProofPath) that only an authenticated admin may read; legacy orders stored a
  // direct download URL (depositImageUrl). The customer never reads the proof, so resolving
  // it here keeps Storage read locked to the admin.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false
    setProofUrl(null)
    if (!viewing) return
    if (viewing.depositImageUrl) { setProofUrl(viewing.depositImageUrl); return }
    if (!viewing.paymentProofPath) return
    setProofLoading(true)
    getDownloadURL(ref(storage, viewing.paymentProofPath))
      .then(url => { if (!cancelled) setProofUrl(url) })
      .catch(err => console.error('Failed to load payment proof:', err, '· code:', err?.code))
      .finally(() => { if (!cancelled) setProofLoading(false) })
    return () => { cancelled = true }
  }, [viewing?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  async function load() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'orders'))
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
      setOrders(all)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  async function updateStatus(orderId, status, extra = {}) {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status, ...extra })
      toast.success('Status updated')
      load()
      if (viewing?.id === orderId) setViewing(prev => ({ ...prev, status, ...extra }))
    } catch { toast.error('Failed to update status') }
  }

  function handleStatusClick(orderId, status) {
    if (status === 'confirmed') {
      setConfirmingId(orderId)
      setDeliveryEstimate('')
    } else {
      setConfirmingId(null)
      updateStatus(orderId, status)
    }
  }

  function confirmWithEstimate() {
    if (!confirmingId) return
    updateStatus(confirmingId, 'confirmed', { deliveryEstimate: deliveryEstimate.trim() || null })
    setConfirmingId(null)
    setDeliveryEstimate('')
  }

  const filters  = ['all', ...ALL_STATUSES]
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const needsAttention = orders.filter(o => o.status === 'pending_payment' || o.status === 'pending_approval').length

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 className="admin-page-title" style={{ marginBottom: 4 }}>Orders</h2>
          {needsAttention > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FFF3E0', color: '#E65100', padding: '5px 14px', borderRadius: 50, fontSize: 13, fontWeight: 600 }}>
              <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 14 }} /> {needsAttention} order{needsAttention > 1 ? 's' : ''} need your attention
            </div>
          )}
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FontAwesomeIcon icon={faArrowsRotate} style={{ fontSize: 14 }} /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="category-tabs" style={{ marginBottom: 24 }}>
        {filters.map(s => {
          const count = s === 'all' ? orders.length : orders.filter(o => o.status === s).length
          return (
            <button key={s} className={`category-tab ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)} style={{ fontSize: 12 }}>
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
              <span style={{ marginRight: 6, background: 'rgba(255,255,255,0.25)', borderRadius: 50, padding: '1px 7px', fontSize: 11 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {loading ? <InlineLoader text="Loading orders..." /> : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th><th>Customer</th><th>Phone</th><th>City</th>
                <th>Payment</th><th>Total</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--text-light)' }}>No orders found</td></tr>
              )}
              {filtered.map(o => (
                <tr key={o.id} style={{ background: (o.status === 'pending_payment' || o.status === 'pending_approval') ? '#FFFDE7' : '' }}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>#{o.id.slice(0, 8).toUpperCase()}</td>
                  <td>{o.userInfo?.name || 'Guest'}</td>
                  <td>{o.userInfo?.phone || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{o.userInfo?.city || '—'}</td>
                  <td >
                    {/* style={{ display: 'flex', alignItems: 'center', gap: 4 }} */}
                    {PAYMENT_LABELS[o.paymentMethod] || 'Cash'}
                    <PaymentIcon method={o.paymentMethod} />
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--brown)' }}>{o.total} EGP</td>
                  <td><span className={`status-badge status-${o.status}`}>{STATUS_LABELS[o.status] || o.status}</span></td>
                  <td>
                    <button className="btn-icon" onClick={() => { setViewing(o); setConfirmingId(null) }} title="View">
                      <FontAwesomeIcon icon={faEye} style={{ fontSize: 16 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order detail modal */}
      {viewing && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewing(null)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <button className="modal-close" onClick={() => setViewing(null)}><FontAwesomeIcon icon={faXmark} style={{ fontSize: 18 }} /></button>
            <h3>Order #{viewing.id.slice(0, 8).toUpperCase()}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'var(--cream)', borderRadius: 'var(--radius-sm)', padding: 16 }}>
                <p style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>CUSTOMER</p>
                <p style={{ fontWeight: 700 }}>{viewing.userInfo?.name || 'Guest'}</p>
                <p style={{ fontSize: 14 }}>{viewing.userInfo?.phone}</p>
                <p style={{ fontSize: 14, color: 'var(--text-light)' }}>{viewing.userInfo?.email}</p>
              </div>
              <div style={{ background: 'var(--cream)', borderRadius: 'var(--radius-sm)', padding: 16 }}>
                <p style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>DELIVERY</p>
                <p style={{ fontWeight: 700, textTransform: 'capitalize' }}>{viewing.userInfo?.city}</p>
                <p style={{ fontSize: 14 }}>{viewing.userInfo?.address}</p>
                <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {PAYMENT_LABELS[viewing.paymentMethod] || 'Cash'}<PaymentIcon method={viewing.paymentMethod} />
                </p>
                {viewing.deliveryDate && (
                  <p style={{ fontSize: 12, color: 'var(--brown)', marginTop: 4, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 12 }} /> Requested: {viewing.deliveryDate}
                  </p>
                )}
              </div>
            </div>

            {viewing.orderNote && (
              <div style={{ marginBottom: 20, padding: '12px 16px', background: '#FFF8E1', borderRadius: 'var(--radius-sm)', border: '1px solid #FFE082' }}>
                <p style={{ fontSize: 11, color: '#F57F17', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>CUSTOMER NOTE</p>
                <p style={{ fontSize: 14, color: 'var(--text)' }}>{viewing.orderNote}</p>
              </div>
            )}

            <p style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>ORDER ITEMS</p>
            {viewing.items?.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                <span>{item.name} × {item.quantity}</span>
                <strong>{item.price * item.quantity} EGP</strong>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: 'var(--text-light)', marginTop: 4 }}>
              <span>Delivery</span><span>{viewing.deliveryFee || 0} EGP</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 700, fontSize: 17, color: 'var(--brown-dark)', borderTop: '2px solid var(--border)', marginTop: 6 }}>
              <span>Total</span><span>{viewing.total} EGP</span>
            </div>

            {(viewing.requiresDeposit || viewing.paymentProofPath || viewing.depositImageUrl) && (
              <div style={{ margin: '16px 0', padding: 16, background: 'var(--pink-light)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--pink-dark)' }}>
                <p style={{ fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {viewing.requiresDeposit
                    ? <><FontAwesomeIcon icon={faWallet} style={{ fontSize: 15 }} /> Deposit: {viewing.depositAmount} EGP</>
                    : <><FontAwesomeIcon icon={faCreditCard} style={{ fontSize: 15 }} /> Transfer Receipt ({PAYMENT_LABELS[viewing.paymentMethod] || viewing.paymentMethod})</>}
                </p>
                {proofLoading ? (
                  <p style={{ fontSize: 13, color: 'var(--text-light)' }}>Loading receipt…</p>
                ) : proofUrl ? (
                  <a href={proofUrl} target="_blank" rel="noreferrer">
                    <img src={proofUrl} alt="payment receipt" loading="lazy" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, cursor: 'pointer', display: 'block' }} />
                  </a>
                ) : (viewing.paymentProofPath || viewing.depositImageUrl) ? (
                  <p style={{ fontSize: 13, color: 'var(--text-light)' }}>Couldn’t load receipt image.</p>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text-light)' }}>No receipt uploaded yet</p>
                )}
              </div>
            )}

            {viewing.deliveryEstimate && (
              <div style={{ margin: '16px 0', padding: '12px 16px', background: '#E8F5E9', borderRadius: 'var(--radius-sm)', border: '1px solid #A5D6A7' }}>
                <p style={{ fontSize: 11, color: '#2E7D32', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>DELIVERY ESTIMATE</p>
                <p style={{ fontSize: 14, color: '#1B5E20', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FontAwesomeIcon icon={faTruck} style={{ fontSize: 14 }} /> {viewing.deliveryEstimate}
                </p>
              </div>
            )}

            <p style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600, letterSpacing: 1, margin: '20px 0 10px' }}>UPDATE STATUS</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALL_STATUSES.map(s => (
                <button key={s} onClick={() => handleStatusClick(viewing.id, s)} style={{
                  padding: '8px 14px', borderRadius: 50, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: '2px solid', background: viewing.status === s ? 'var(--brown)' : 'transparent',
                  color: viewing.status === s ? 'white' : 'var(--brown)', borderColor: 'var(--brown)',
                  fontFamily: 'Poppins,sans-serif', transition: 'all 0.2s',
                }}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {confirmingId === viewing.id && (
              <div style={{ marginTop: 16, padding: '16px', background: '#F1F8E9', borderRadius: 'var(--radius-sm)', border: '1.5px solid #AED581' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#33691E', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FontAwesomeIcon icon={faBox} style={{ fontSize: 14 }} /> Add a delivery estimate for the customer (optional):
                </p>
                <input
                  value={deliveryEstimate}
                  onChange={e => setDeliveryEstimate(e.target.value)}
                  placeholder="e.g. Will arrive within 3 days"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #AED581', fontSize: 14, marginBottom: 12, fontFamily: 'Poppins,sans-serif', boxSizing: 'border-box', background: 'white' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={confirmWithEstimate} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--brown)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 15 }} /> Confirm Order
                  </button>
                  <button onClick={() => setConfirmingId(null)} style={{ padding: '10px 16px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'white', color: 'var(--text-light)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

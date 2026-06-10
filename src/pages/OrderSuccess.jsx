import { useLocation, useNavigate, Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClock, faCircleCheck, faBagShopping } from '@fortawesome/free-solid-svg-icons'

const PAYMENT_LABELS = {
  instapay: 'InstaPay',
  wallet:   'Vodafone Cash / Wallet',
}

export default function OrderSuccess() {
  const { state }  = useLocation()
  const navigate   = useNavigate()
  const requiresDeposit = state?.requiresDeposit
  const paymentMethod   = state?.paymentMethod
  const orderId         = state?.orderId

  const isTransfer = paymentMethod === 'instapay' || paymentMethod === 'wallet'
  const isPending  = requiresDeposit || isTransfer

  function getTitle() {
    if (isTransfer || requiresDeposit) return 'Order Received!'
    return 'Order Confirmed!'
  }

  function getMessage() {
    if (isTransfer) {
      return `Your order has been placed! We're reviewing your ${PAYMENT_LABELS[paymentMethod] || 'transfer'} receipt and will confirm your order shortly. Thank you for choosing Melted! 🍪`
    }
    if (requiresDeposit) {
      return "Your order has been received and we're reviewing your deposit receipt. We'll confirm your order shortly. Thank you for choosing Melted! 🍪"
    }
    return "Your order is confirmed and being prepared with love. It'll be delivered to you soon. Thank you for ordering from Melted! 🍫"
  }

  return (
    <div className="success-page">
      <div className="success-card">
        <div className="success-icon icon-pop">
          {isPending
            ? <FontAwesomeIcon icon={faClock} style={{ fontSize: 72, color: 'var(--brown)' }} />
            : <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 72, color: 'var(--brown)' }} />
          }
        </div>
        <h2>{getTitle()}</h2>
        <p>{getMessage()}</p>
        {orderId && (
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-light)' }}>
            Order ID: <strong style={{ color: 'var(--brown)' }}>{orderId.slice(0, 8).toUpperCase()}</strong>
          </p>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/shop')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FontAwesomeIcon icon={faBagShopping} style={{ fontSize: 15 }} /> Shop More
          </button>
          <Link to="/my-orders" className="btn btn-outline">Track Orders</Link>
        </div>
      </div>
    </div>
  )
}

import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCreditCard, faTriangleExclamation, faBox } from '@fortawesome/free-solid-svg-icons'

export default function VisaPayment() {
  const { state }  = useLocation()
  const navigate   = useNavigate()

  const orderId         = state?.orderId
  const total           = state?.total
  const instapayAccount = state?.instapayAccount

  useEffect(() => {
    if (!orderId) navigate('/', { replace: true })
  }, [orderId, navigate])

  if (!orderId) return null

  return (
    <div className="success-page">
      <div className="success-card" style={{ maxWidth: 580 }}>
        <span className="success-icon icon-pop">
          <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: 72, color: 'var(--brown)' }} />
        </span>
        <h2>Complete Your Payment</h2>
        <p style={{ marginBottom: 28, color: 'var(--text-light)', lineHeight: 1.8 }}>
          Your order has been placed! Please transfer the full amount via InstaPay to confirm it.
        </p>

        <div style={{ background: 'var(--cream)', borderRadius: 'var(--radius-sm)', padding: '18px 22px', marginBottom: 20, textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ color: 'var(--text-light)', fontSize: 14 }}>Order ID</span>
            <strong style={{ color: 'var(--brown)', fontFamily: 'monospace', fontSize: 16 }}>#{orderId.slice(0, 8).toUpperCase()}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-light)', fontSize: 14 }}>Amount to Transfer</span>
            <strong style={{ color: 'var(--brown-dark)', fontSize: 22, fontWeight: 700 }}>{total} EGP</strong>
          </div>
        </div>

        {instapayAccount ? (
          <div style={{ background: 'var(--brown)', color: 'white', borderRadius: 'var(--radius-sm)', padding: '18px 22px', marginBottom: 24, textAlign: 'left' }}>
            <p style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Transfer to InstaPay account:</p>
            <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>{instapayAccount}</p>
          </div>
        ) : (
          <div className="alert alert-warning" style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }} />
            Contact us on WhatsApp to get our InstaPay account number.
          </div>
        )}

        <div style={{ textAlign: 'left', marginBottom: 28 }}>
          {[
            'Open your banking app or InstaPay',
            `Transfer exactly ${total} EGP to the account above`,
            'Take a screenshot of the successful transfer',
            'Your order will be confirmed once we verify the payment',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--pink)', color: 'var(--brown)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, paddingTop: 4 }}>{step}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/my-orders')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FontAwesomeIcon icon={faBox} style={{ fontSize: 15 }} /> Track My Order
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/shop')}>Continue Shopping</button>
        </div>
      </div>
    </div>
  )
}

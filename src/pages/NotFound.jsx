import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCookieBite, faBagShopping } from '@fortawesome/free-solid-svg-icons'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="not-found-page">
      <span className="nf-emoji"><FontAwesomeIcon icon={faCookieBite} style={{ fontSize: 88, color: 'var(--brown-light)' }} /></span>
      <h1>404</h1>
      <p>Oops! This page doesn't exist.<br />Maybe it melted away...</p>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
        <button className="btn btn-outline" onClick={() => navigate('/shop')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FontAwesomeIcon icon={faBagShopping} style={{ fontSize: 15 }} /> Browse Menu
        </button>
      </div>
    </div>
  )
}

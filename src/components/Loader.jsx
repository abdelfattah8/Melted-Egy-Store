import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

export function PageLoader() {
  return (
    <div className="cookie-loader-overlay">
      <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 52, color: 'var(--brown)', marginBottom: 16 }} />
      <p className="cookie-loader-text">
        Loading<span className="cookie-loader-dots" />
      </p>
    </div>
  )
}

export function InlineLoader({ text = 'Loading...' }) {
  return (
    <div className="inline-loader">
      <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 20, color: 'var(--brown)' }} />
      <span>{text}</span>
    </div>
  )
}

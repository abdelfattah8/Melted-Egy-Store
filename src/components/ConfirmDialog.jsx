import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'

export default function ConfirmDialog({
  open,
  title       = 'Are you sure?',
  message,
  confirmText = 'Delete',
  cancelText  = 'Cancel',
  onConfirm,
  onCancel,
  danger      = false,
  icon        = <FontAwesomeIcon icon={faTrash} style={{ fontSize: 52, color: 'var(--brown)' }} />,
}) {
  if (!open) return null

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      style={{ zIndex: 300 }}
    >
      <div
        className="modal"
        style={{ maxWidth: 400, textAlign: 'center', padding: '44px 40px 36px' }}
      >
        <div style={{ marginBottom: 16, lineHeight: 1, display: 'flex', justifyContent: 'center' }}>{icon}</div>

        <h3 style={{ fontSize: 20, marginBottom: 10 }}>{title}</h3>

        {message && (
          <p style={{ color: 'var(--text-light)', fontSize: 14, lineHeight: 1.7, marginBottom: 28, marginTop: 0 }}>
            {message}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-outline" onClick={onCancel} style={{ minWidth: 100 }}>
            {cancelText}
          </button>
          <button
            className="btn"
            onClick={onConfirm}
            style={{ minWidth: 100, background: danger ? '#e53935' : 'var(--brown)', color: 'white', border: 'none' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

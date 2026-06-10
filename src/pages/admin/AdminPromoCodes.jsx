import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTag, faPlus, faTrash, faCircleCheck, faCircleXmark, faXmark, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { db } from '../../firebase/config.jsx'
import { InlineLoader } from '../../components/Loader.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import toast from 'react-hot-toast'

const EMPTY = { code: '', discountPercent: '', active: true }

function validate(form) {
  const errs = {}
  const code = form.code.trim().toUpperCase()
  if (!code) errs.code = 'Code is required'
  else if (!/^[A-Z0-9_-]{2,20}$/.test(code)) errs.code = 'Use 2–20 letters, numbers, - or _ only'
  const pct = Number(form.discountPercent)
  if (!form.discountPercent || isNaN(pct) || pct < 1 || pct > 99 || !Number.isInteger(pct))
    errs.discountPercent = 'Enter a whole number from 1 to 99'
  return errs
}

export default function AdminPromoCodes() {
  const [codes,         setCodes]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [modal,         setModal]         = useState(false)
  const [form,          setForm]          = useState(EMPTY)
  const [errors,        setErrors]        = useState({})
  const [saving,        setSaving]        = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'promoCodes'))
      setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)))
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  function openNew() { setForm(EMPTY); setErrors({}); setModal(true) }
  function closeModal() { setModal(false); setErrors({}) }

  const set = k => e => {
    const val = k === 'code' ? e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') : e.target.value
    setForm(f => ({ ...f, [k]: val }))
    setErrors(prev => ({ ...prev, [k]: '' }))
  }

  async function handleSave() {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    const code = form.code.trim().toUpperCase()
    try {
      const dup = await getDocs(query(collection(db, 'promoCodes'), where('code', '==', code)))
      if (!dup.empty) { setErrors({ code: 'A code with this name already exists' }); setSaving(false); return }
      await addDoc(collection(db, 'promoCodes'), {
        code,
        discountPercent: Number(form.discountPercent),
        active: form.active,
        usedBy: [],
        createdAt: serverTimestamp(),
      })
      toast.success(`Code "${code}" created`)
      closeModal()
      load()
    } catch (err) { console.error(err); toast.error('Failed to save') }
    setSaving(false)
  }

  async function toggleActive(c) {
    try {
      await updateDoc(doc(db, 'promoCodes', c.id), { active: !c.active })
      setCodes(prev => prev.map(x => x.id === c.id ? { ...x, active: !x.active } : x))
      toast.success(`"${c.code}" ${c.active ? 'deactivated' : 'activated'}`)
    } catch (err) { console.error(err); toast.error('Failed to update') }
  }

  async function handleDelete(c) {
    try {
      await deleteDoc(doc(db, 'promoCodes', c.id))
      setCodes(prev => prev.filter(x => x.id !== c.id))
      toast.success(`Code "${c.code}" deleted`)
    } catch (err) { console.error(err); toast.error('Failed to delete') }
    setConfirmDelete(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Promo Codes</h1>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <FontAwesomeIcon icon={faPlus} /> New Code
        </button>
      </div>

      {loading ? <InlineLoader text="Loading codes..." /> : codes.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon"><FontAwesomeIcon icon={faTag} style={{ fontSize: 56, color: 'var(--brown-light)' }} /></span>
          <h3>No promo codes yet</h3>
          <p>Create a code to offer discounts at checkout</p>
          <button className="btn btn-primary mt-6" onClick={openNew}>Create First Code</button>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Status</th>
                <th>Redemption</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, letterSpacing: 1, color: 'var(--brown-dark)', background: 'var(--cream)', padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      {c.code}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#e53935', fontSize: 15 }}>−{c.discountPercent}%</span>
                  </td>
                  <td>
                    <button
                      onClick={() => toggleActive(c)}
                      title={c.active ? 'Click to deactivate' : 'Click to activate'}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 50, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Poppins, sans-serif', transition: 'var(--transition)', background: c.active ? '#E8F5E9' : '#FFEBEE', color: c.active ? '#2E7D32' : '#C62828' }}
                    >
                      <FontAwesomeIcon icon={c.active ? faCircleCheck : faCircleXmark} style={{ fontSize: 13 }} />
                      {c.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    {(() => {
                      const count = c.usedBy?.length ?? 0
                      return (
                        <span style={{ fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, color: count > 0 ? '#2E7D32' : 'var(--text-light)' }}>
                          <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 13, color: count > 0 ? '#2E7D32' : 'var(--text-light)' }} />
                          {count > 0 ? `Redeemed ${count}×` : 'Available'}
                        </span>
                      )
                    })()}
                  </td>
                  <td>
                    <button className="btn-icon delete" onClick={() => setConfirmDelete(c)} title="Delete code">
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New code modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <button className="modal-close" onClick={closeModal}>
              <FontAwesomeIcon icon={faXmark} style={{ fontSize: 18 }} />
            </button>
            <h3 style={{ marginBottom: 26 }}>New Promo Code</h3>

            <div className="form-group">
              <label className="form-label">Code <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>— uppercase letters, numbers, - or _ only</span></label>
              <input
                placeholder="e.g. SUMMER20"
                value={form.code}
                onChange={set('code')}
                className={errors.code ? 'error' : ''}
                style={{ fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }}
                maxLength={20}
              />
              {errors.code && <div className="field-error"><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 11 }} /> {errors.code}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Discount Percentage <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>(1–99%)</span></label>
              <input
                type="number" min="1" max="99"
                placeholder="e.g. 20"
                value={form.discountPercent}
                onChange={set('discountPercent')}
                className={errors.discountPercent ? 'error' : ''}
              />
              {errors.discountPercent && <div className="field-error"><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 11 }} /> {errors.discountPercent}</div>}
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
                <div
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  style={{ width: 44, height: 24, borderRadius: 12, background: form.active ? 'var(--brown)' : 'var(--border)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: 3, left: form.active ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                </div>
                <span className="form-label" style={{ margin: 0 }}>Active — available for use at checkout</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-outline" onClick={closeModal} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {saving ? 'Creating...' : <><FontAwesomeIcon icon={faTag} /> Create Code</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          open={true}
          message={`Delete promo code "${confirmDelete.code}"? This cannot be undone.`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

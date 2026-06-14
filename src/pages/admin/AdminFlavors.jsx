import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faIceCream, faPlus, faPencil, faTrash, faCircleCheck, faCircleXmark, faXmark, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { db } from '../../firebase/config.jsx'
import { InlineLoader } from '../../components/Loader.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import toast from 'react-hot-toast'

const EMPTY = { name: '', active: true }

function validate(form) {
  const errs = {}
  if (!form.name.trim()) errs.name = 'Flavor name is required'
  return errs
}

export default function AdminFlavors() {
  const [flavors,       setFlavors]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [modal,         setModal]         = useState(false)
  const [editing,       setEditing]       = useState(null)
  const [form,          setForm]          = useState(EMPTY)
  const [errors,        setErrors]        = useState({})
  const [saving,        setSaving]        = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'flavors'))
      setFlavors(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')))
    } catch (err) { console.error('Flavors load failed:', err); toast.error('Failed to load flavors') }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  function openNew()    { setEditing(null); setForm(EMPTY); setErrors({}); setModal(true) }
  function openEdit(f)  { setEditing(f); setForm({ name: f.name || '', active: f.active !== false }); setErrors({}); setModal(true) }
  function closeModal() { setModal(false); setErrors({}) }

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(prev => ({ ...prev, [k]: '' })) }

  async function handleSave() {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    const name = form.name.trim()
    const dup = flavors.find(f => f.name?.toLowerCase() === name.toLowerCase() && f.id !== editing?.id)
    if (dup) { setErrors({ name: 'A flavor with this name already exists' }); return }
    setSaving(true)
    try {
      if (editing) {
        await updateDoc(doc(db, 'flavors', editing.id), { name, active: form.active })
        toast.success(`Flavor "${name}" updated`)
      } else {
        await addDoc(collection(db, 'flavors'), { name, active: form.active, createdAt: serverTimestamp() })
        toast.success(`Flavor "${name}" added`)
      }
      closeModal()
      load()
    } catch (err) { console.error(err); toast.error('Failed to save — check Firestore rules for the "flavors" collection') }
    setSaving(false)
  }

  async function toggleActive(f) {
    try {
      await updateDoc(doc(db, 'flavors', f.id), { active: f.active === false })
      setFlavors(prev => prev.map(x => x.id === f.id ? { ...x, active: x.active === false } : x))
      toast.success(`"${f.name}" ${f.active !== false ? 'deactivated' : 'activated'}`)
    } catch (err) { console.error(err); toast.error('Failed to update') }
  }

  async function handleDelete(f) {
    try {
      await deleteDoc(doc(db, 'flavors', f.id))
      setFlavors(prev => prev.filter(x => x.id !== f.id))
      toast.success(`Flavor "${f.name}" deleted`)
    } catch (err) { console.error(err); toast.error('Failed to delete') }
    setConfirmDelete(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Flavors</h1>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <FontAwesomeIcon icon={faPlus} /> New Flavor
        </button>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 24, marginTop: -16 }}>
        Manage the flavors list, then assign flavors to products from Products → Add / Edit Product.
      </p>

      {loading ? <InlineLoader text="Loading flavors..." /> : flavors.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon"><FontAwesomeIcon icon={faIceCream} style={{ fontSize: 56, color: 'var(--brown-light)' }} /></span>
          <h3>No flavors yet</h3>
          <p>Add flavors so you can tag them on your products</p>
          <button className="btn btn-primary mt-6" onClick={openNew}>Add First Flavor</button>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table admin-table--stack">
            <thead>
              <tr>
                <th>Flavor</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flavors.map(f => (
                <tr key={f.id}>
                  <td data-label="Flavor" style={{ fontWeight: 600, color: 'var(--brown-dark)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <FontAwesomeIcon icon={faIceCream} style={{ fontSize: 14, color: 'var(--brown-light)' }} />
                      {f.name}
                    </span>
                  </td>
                  <td data-label="Status">
                    <button
                      onClick={() => toggleActive(f)}
                      title={f.active !== false ? 'Click to deactivate' : 'Click to activate'}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 50, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Poppins, sans-serif', transition: 'var(--transition)', background: f.active !== false ? '#E8F5E9' : '#FFEBEE', color: f.active !== false ? '#2E7D32' : '#C62828' }}
                    >
                      <FontAwesomeIcon icon={f.active !== false ? faCircleCheck : faCircleXmark} style={{ fontSize: 13 }} />
                      {f.active !== false ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="stack-full">
                    <button className="btn-icon" onClick={() => openEdit(f)} title="Edit"><FontAwesomeIcon icon={faPencil} style={{ fontSize: 15 }} /></button>
                    <button className="btn-icon delete" onClick={() => setConfirmDelete(f)} title="Delete"><FontAwesomeIcon icon={faTrash} style={{ fontSize: 15 }} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / edit modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <button className="modal-close" onClick={closeModal}>
              <FontAwesomeIcon icon={faXmark} style={{ fontSize: 18 }} />
            </button>
            <h3 style={{ marginBottom: 26, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FontAwesomeIcon icon={faIceCream} style={{ fontSize: 18, color: 'var(--brown)' }} />
              {editing ? 'Edit Flavor' : 'New Flavor'}
            </h3>

            <div className="form-group">
              <label className="form-label">Flavor Name *</label>
              <input
                placeholder="e.g. Lotus, Pistachio, Nutella"
                value={form.name}
                onChange={set('name')}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className={errors.name ? 'error' : ''}
                maxLength={40}
              />
              {errors.name && <div className="field-error"><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 11 }} /> {errors.name}</div>}
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
                <div
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  style={{ width: 44, height: 24, borderRadius: 12, background: form.active ? 'var(--brown)' : 'var(--border)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: 3, left: form.active ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                </div>
                <span className="form-label" style={{ margin: 0 }}>Active — shown to customers</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-outline" onClick={closeModal} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : <><FontAwesomeIcon icon={faPlus} /> Add Flavor</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          open={true}
          message={`Delete flavor "${confirmDelete.name}"? Products tagged with it will simply stop showing it.`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

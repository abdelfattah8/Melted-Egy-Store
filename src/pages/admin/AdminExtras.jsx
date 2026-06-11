import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faJarWheat, faPlus, faPencil, faTrash, faCircleCheck, faCircleXmark, faXmark, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { db } from '../../firebase/config.jsx'
import { InlineLoader } from '../../components/Loader.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import toast from 'react-hot-toast'

const EMPTY = { name: '', price: '', active: true }

function validate(form) {
  const errs = {}
  if (!form.name.trim()) errs.name = 'Extra name is required'
  const price = Number(form.price)
  if (form.price === '' || isNaN(price) || price <= 0) errs.price = 'Enter a valid price (EGP)'
  return errs
}

export default function AdminExtras() {
  const [extras,        setExtras]        = useState([])
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
      const snap = await getDocs(collection(db, 'extras'))
      setExtras(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')))
    } catch (err) { console.error('Extras load failed:', err); toast.error('Failed to load extras') }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  function openNew()    { setEditing(null); setForm(EMPTY); setErrors({}); setModal(true) }
  function openEdit(x)  { setEditing(x); setForm({ name: x.name || '', price: x.price ?? '', active: x.active !== false }); setErrors({}); setModal(true) }
  function closeModal() { setModal(false); setErrors({}) }

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(prev => ({ ...prev, [k]: '' })) }

  async function handleSave() {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    const name = form.name.trim()
    const dup = extras.find(x => x.name?.toLowerCase() === name.toLowerCase() && x.id !== editing?.id)
    if (dup) { setErrors({ name: 'An extra with this name already exists' }); return }
    setSaving(true)
    try {
      const data = { name, price: Number(form.price), active: form.active }
      if (editing) {
        await updateDoc(doc(db, 'extras', editing.id), data)
        toast.success(`Extra "${name}" updated`)
      } else {
        await addDoc(collection(db, 'extras'), { ...data, createdAt: serverTimestamp() })
        toast.success(`Extra "${name}" added`)
      }
      closeModal()
      load()
    } catch (err) { console.error(err); toast.error('Failed to save — check Firestore rules for the "extras" collection') }
    setSaving(false)
  }

  async function toggleActive(x) {
    try {
      await updateDoc(doc(db, 'extras', x.id), { active: x.active === false })
      setExtras(prev => prev.map(e => e.id === x.id ? { ...e, active: e.active === false } : e))
      toast.success(`"${x.name}" ${x.active !== false ? 'deactivated' : 'activated'}`)
    } catch (err) { console.error(err); toast.error('Failed to update') }
  }

  async function handleDelete(x) {
    try {
      await deleteDoc(doc(db, 'extras', x.id))
      setExtras(prev => prev.filter(e => e.id !== x.id))
      toast.success(`Extra "${x.name}" deleted`)
    } catch (err) { console.error(err); toast.error('Failed to delete') }
    setConfirmDelete(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Extras</h1>
        <button className="btn btn-primary" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <FontAwesomeIcon icon={faPlus} /> New Extra
        </button>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 24, marginTop: -16 }}>
        Paid add-ons (e.g. Lotus Sauce +35 EGP). Assign them to products from Products → Add / Edit Product — customers pick them when adding the product to cart.
      </p>

      {loading ? <InlineLoader text="Loading extras..." /> : extras.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon"><FontAwesomeIcon icon={faJarWheat} style={{ fontSize: 56, color: 'var(--brown-light)' }} /></span>
          <h3>No extras yet</h3>
          <p>Add paid extras like sauces and toppings for your products</p>
          <button className="btn btn-primary mt-6" onClick={openNew}>Add First Extra</button>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Extra</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {extras.map(x => (
                <tr key={x.id}>
                  <td style={{ fontWeight: 600, color: 'var(--brown-dark)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <FontAwesomeIcon icon={faJarWheat} style={{ fontSize: 14, color: 'var(--brown-light)' }} />
                      {x.name}
                    </span>
                  </td>
                  <td><span style={{ fontWeight: 700, color: 'var(--brown)' }}>+{x.price} EGP</span></td>
                  <td>
                    <button
                      onClick={() => toggleActive(x)}
                      title={x.active !== false ? 'Click to deactivate' : 'Click to activate'}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 50, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Poppins, sans-serif', transition: 'var(--transition)', background: x.active !== false ? '#E8F5E9' : '#FFEBEE', color: x.active !== false ? '#2E7D32' : '#C62828' }}
                    >
                      <FontAwesomeIcon icon={x.active !== false ? faCircleCheck : faCircleXmark} style={{ fontSize: 13 }} />
                      {x.active !== false ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <button className="btn-icon" onClick={() => openEdit(x)} title="Edit"><FontAwesomeIcon icon={faPencil} style={{ fontSize: 15 }} /></button>
                    <button className="btn-icon delete" onClick={() => setConfirmDelete(x)} title="Delete"><FontAwesomeIcon icon={faTrash} style={{ fontSize: 15 }} /></button>
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
              <FontAwesomeIcon icon={faJarWheat} style={{ fontSize: 18, color: 'var(--brown)' }} />
              {editing ? 'Edit Extra' : 'New Extra'}
            </h3>

            <div className="form-group">
              <label className="form-label">Extra Name *</label>
              <input
                placeholder="e.g. Lotus Sauce, Honey, Ice Cream Scoop"
                value={form.name}
                onChange={set('name')}
                className={errors.name ? 'error' : ''}
                maxLength={40}
              />
              {errors.name && <div className="field-error"><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 11 }} /> {errors.name}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Price (EGP) *</label>
              <input
                type="number" min="1"
                placeholder="e.g. 35"
                value={form.price}
                onChange={set('price')}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className={errors.price ? 'error' : ''}
                style={{ maxWidth: 180 }}
              />
              {errors.price && <div className="field-error"><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 11 }} /> {errors.price}</div>}
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
                <div
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  style={{ width: 44, height: 24, borderRadius: 12, background: form.active ? 'var(--brown)' : 'var(--border)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: 3, left: form.active ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                </div>
                <span className="form-label" style={{ margin: 0 }}>Active — selectable by customers</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-outline" onClick={closeModal} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : <><FontAwesomeIcon icon={faPlus} /> Add Extra</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          open={true}
          message={`Delete extra "${confirmDelete.name}"? It will disappear from all products that offer it.`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

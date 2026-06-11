import { useEffect, useState, useRef } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGift, faTruck, faPencil, faTrash, faCamera, faCircleCheck, faCircleXmark, faXmark, faCookieBite, faBoxOpen } from '@fortawesome/free-solid-svg-icons'
import { db, storage } from '../../firebase/config.jsx'
import { getOfferProductIds } from '../../utils/offerUtils.js'
import { InlineLoader } from '../../components/Loader.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import toast from 'react-hot-toast'

const OFFER_TYPES = [
  { key: 'buy1get1',      label: 'Buy 1 Get 1 Free' },
  { key: 'buy2get1',      label: 'Buy 2 Get 1 Free' },
  { key: 'box_gift',      label: 'Buy Box, Get Item Free' },
  { key: 'free_delivery', label: 'Free Delivery' },
  { key: 'custom',        label: 'Custom Discount' },
]

const EMPTY = { title: '', type: 'buy1get1', description: '', productIds: [], giftProductIds: [], active: true, discountPercent: '' }

/* Checkbox-style product list used by the offer form (plain render helper, no hooks). */
function ProductChecklist({ items, selectedIds, onToggle, emptyText }) {
  return (
    <div style={{ maxHeight: 220, overflowY: 'auto', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-light)', textAlign: 'center', padding: 12 }}>{emptyText}</p>
      )}
      {items.map(p => {
        const box      = p.type === 'box'
        const selected = selectedIds.includes(p.id)
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
              cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'Poppins,sans-serif',
              border: `1.5px solid ${selected ? 'var(--brown)' : 'var(--border)'}`,
              background: selected ? 'var(--cream)' : 'var(--white)',
            }}
          >
            <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `2px solid ${selected ? 'var(--brown)' : 'var(--border)'}`, background: selected ? 'var(--brown)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selected && <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 11, color: 'white' }} />}
            </span>
            {p.imageUrl
              ? <img src={p.imageUrl} alt={p.name} style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />
              : <FontAwesomeIcon icon={box ? faBoxOpen : faCookieBite} style={{ fontSize: 18, color: 'var(--brown-light)', width: 30, flexShrink: 0 }} />
            }
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--brown-dark)' }}>{p.name}</span>
            {box && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--brown)', background: 'var(--pink-light)', borderRadius: 4, padding: '2px 6px' }}>BOX</span>}
            <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{p.price} EGP</span>
          </button>
        )
      })}
    </div>
  )
}

export default function AdminOffers() {
  const [offers,        setOffers]        = useState([])
  const [products,      setProducts]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [modal,         setModal]         = useState(false)
  const [editing,       setEditing]       = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form,          setForm]          = useState(EMPTY)
  const [saving,        setSaving]        = useState(false)
  const [imageFile,     setImageFile]     = useState(null)
  const [imagePreview,  setImagePreview]  = useState(null)
  const [uploadPct,     setUploadPct]     = useState(0)
  const fileRef = useRef()

  async function load() {
    setLoading(true)
    try {
      const [offSnap, prodSnap] = await Promise.all([
        getDocs(collection(db, 'offers')),
        getDocs(query(collection(db, 'products'), where('available', '==', true))),
      ])
      setOffers(offSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  function openNew() { setEditing(null); setForm(EMPTY); setImageFile(null); setImagePreview(null); setModal(true) }
  function openEdit(o) {
    setEditing(o)
    setForm({ title: o.title, type: o.type, description: o.description || '', productIds: getOfferProductIds(o), giftProductIds: o.giftProductIds || [], active: o.active, discountPercent: o.discountPercent || '' })
    setImageFile(null); setImagePreview(o.imageUrl || null); setModal(true)
  }

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Images only'); return }
    if (file.size > 5 * 1024 * 1024)    { toast.error('Max 5MB'); return }
    setImageFile(file); setImagePreview(URL.createObjectURL(file))
  }

  const isBox    = id => products.find(p => p.id === id)?.type === 'box'
  const isBogo   = form.type === 'buy1get1' || form.type === 'buy2get1'
  const isBoxGift = form.type === 'box_gift'

  // Toggle a product id inside form[key] ('productIds' or 'giftProductIds')
  const toggleId = key => p => {
    setForm(prev => prev[key].includes(p.id)
      ? { ...prev, [key]: prev[key].filter(id => id !== p.id) }
      : { ...prev, [key]: [...prev[key], p.id] })
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Offer title is required'); return }
    if (form.type === 'custom' && (!form.discountPercent || isNaN(form.discountPercent) || form.discountPercent < 1 || form.discountPercent > 100)) {
      toast.error('Enter a valid discount % (1–100)'); return
    }
    // Normalise selections to the current type: BOGO offers are bites-only; box_gift offers
    // link boxes as the main products and bites as the eligible free gifts.
    const cleanProductIds = isBogo
      ? form.productIds.filter(id => !isBox(id))
      : isBoxGift
        ? form.productIds.filter(isBox)
        : form.productIds
    const cleanGiftIds = isBoxGift ? form.giftProductIds.filter(id => !isBox(id)) : []
    setSaving(true)
    try {
      let imageUrl = editing?.imageUrl || null
      if (imageFile) {
        const storageRef = ref(storage, `offers/${Date.now()}_${imageFile.name}`)
        const task = uploadBytesResumable(storageRef, imageFile)
        await new Promise((res, rej) => { task.on('state_changed', snap => setUploadPct(Math.round(snap.bytesTransferred / snap.totalBytes * 100)), rej, res) })
        imageUrl = await getDownloadURL(task.snapshot.ref)
        setUploadPct(0)
        if (editing?.imageUrl) { try { await deleteObject(ref(storage, editing.imageUrl)) } catch (e) { console.warn('Old image delete failed:', e) } }
      }
      // Write productIds (new) plus a legacy productId (only when exactly one) for backward compatibility.
      const data = { title: form.title.trim(), type: form.type, description: form.description.trim(), productIds: cleanProductIds, productId: cleanProductIds.length === 1 ? cleanProductIds[0] : null, giftProductIds: isBoxGift ? cleanGiftIds : null, active: form.active, imageUrl, discountPercent: form.type === 'custom' ? Number(form.discountPercent) : null, updatedAt: new Date() }
      if (editing) {
        await updateDoc(doc(db, 'offers', editing.id), data)
        toast.success('Offer updated!')
      } else {
        await addDoc(collection(db, 'offers'), { ...data, createdAt: new Date() })
        toast.success('Offer added!')
      }
      setModal(false); load()
    } catch (err) { console.error(err); toast.error('Something went wrong') }
    setSaving(false)
  }

  async function toggleActive(o) {
    await updateDoc(doc(db, 'offers', o.id), { active: !o.active })
    toast.success(o.active ? 'Offer hidden' : 'Offer activated!')
    load()
  }

  function handleDelete(o) { setConfirmDelete(o) }

  async function doDelete() {
    const o = confirmDelete
    setConfirmDelete(null)
    try {
      await deleteDoc(doc(db, 'offers', o.id))
      if (o.imageUrl) { try { await deleteObject(ref(storage, o.imageUrl)) } catch (e) { console.warn('Image delete failed:', e) } }
      toast.success('Offer deleted')
      load()
    } catch { toast.error('Failed to delete offer') }
  }

  const set = k => e => setForm({ ...form, [k]: e.target.value })
  const getProduct = id => products.find(p => p.id === id)

  const OfferIcon = ({ type, size = 32 }) =>
    type === 'free_delivery'
      ? <FontAwesomeIcon icon={faTruck} style={{ fontSize: size, color: 'white' }} />
      : <FontAwesomeIcon icon={faGift}  style={{ fontSize: size, color: 'white' }} />

  return (
    <>
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Offer"
        message={`Delete "${confirmDelete?.title}"? This cannot be undone.`}
        confirmText="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h2 className="admin-page-title" style={{ marginBottom: 4 }}>Offers</h2>
          <p style={{ color: 'var(--text-light)', fontSize: 14 }}>Manage promotions — customers can apply them at checkout</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Offer</button>
      </div>

      {loading ? <InlineLoader text="Loading offers..." /> : (
        offers.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon"><FontAwesomeIcon icon={faGift} style={{ fontSize: 64, color: 'var(--brown-light)' }} /></span>
            <h3>No offers yet</h3>
            <p>Add your first promotion to attract customers!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {offers.map(o => {
              const linkedProducts = getOfferProductIds(o).map(getProduct).filter(Boolean)
              return (
                <div key={o.id} style={{ background: 'var(--white)', borderRadius: 'var(--radius)', border: `2px solid ${o.active ? 'var(--brown)' : 'var(--border)'}`, overflow: 'hidden', position: 'relative', opacity: o.active ? 1 : 0.6 }}>
                  {o.active && (
                    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, background: '#2E7D32', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 50 }}>ACTIVE</div>
                  )}
                  {o.imageUrl
                    ? <img src={o.imageUrl} alt={o.title} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', height: 80, background: 'linear-gradient(135deg, #5B3121, #8B4513)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <OfferIcon type={o.type} size={32} />
                      </div>
                  }
                  <div style={{ padding: 20 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                      {OFFER_TYPES.find(t => t.key === o.type)?.label || o.type}
                      {o.type === 'custom' && o.discountPercent && <span style={{ color: 'var(--brown)', fontWeight: 700 }}> — {o.discountPercent}% OFF</span>}
                    </div>
                    <h3 style={{ fontFamily: "'Playfair Display',serif", color: 'var(--brown-dark)', fontSize: 20, marginBottom: 8 }}>{o.title}</h3>
                    {o.description && <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>{o.description}</p>}
                    {linkedProducts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {linkedProducts.map(prod => (
                          <div key={prod.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--cream)', borderRadius: 8, fontSize: 13 }}>
                            <FontAwesomeIcon icon={prod.type === 'box' ? faBoxOpen : faCookieBite} style={{ fontSize: 16, color: 'var(--brown)' }} />
                            <span style={{ fontWeight: 600, color: 'var(--brown)' }}>{prod.name}</span>
                            {prod.type === 'box' && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--brown)', background: 'var(--pink-light)', borderRadius: 4, padding: '1px 6px' }}>BOX</span>}
                            <span style={{ color: 'var(--text-light)', marginLeft: 'auto' }}>{prod.price} EGP</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <button onClick={() => toggleActive(o)} className="btn btn-sm" style={{ background: o.active ? '#FFEBEE' : '#E8F5E9', color: o.active ? '#C62828' : '#2E7D32', border: 'none' }}>
                        {o.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => openEdit(o)} className="btn-icon"><FontAwesomeIcon icon={faPencil} style={{ fontSize: 15 }} /></button>
                      <button onClick={() => handleDelete(o)} className="btn-icon delete"><FontAwesomeIcon icon={faTrash} style={{ fontSize: 15 }} /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <button className="modal-close" onClick={() => setModal(false)}><FontAwesomeIcon icon={faXmark} style={{ fontSize: 18 }} /></button>
            <h3>{editing ? 'Edit Offer' : 'Add New Offer'}</h3>

            <div className="form-group">
              <label className="form-label">Offer Image (optional)</label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {imagePreview
                  ? <img src={imagePreview} alt="preview" style={{ width: 100, height: 70, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--border)' }} />
                  : <div style={{ width: 100, height: 70, background: 'var(--cream)', borderRadius: 8, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesomeIcon icon={faGift} style={{ fontSize: 28, color: 'var(--brown-light)' }} />
                    </div>
                }
                <div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <FontAwesomeIcon icon={faCamera} style={{ fontSize: 14 }} /> {imagePreview ? 'Change Image' : 'Upload Image'}
                  </button>
                  {imagePreview && (
                    <button type="button" className="btn btn-sm" style={{ marginLeft: 8, background: '#FFEBEE', color: '#C62828', border: 'none' }}
                      onClick={() => { setImageFile(null); setImagePreview(null) }}>
                      Remove
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                  {uploadPct > 0 && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--brown)' }}>Uploading... {uploadPct}%</div>}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Offer Title *</label>
              <input placeholder="e.g. Buy 1 Get 1 Free on Cookies" value={form.title} onChange={set('title')} />
            </div>

            <div className="form-group">
              <label className="form-label">Offer Type *</label>
              <select value={form.type} onChange={set('type')}>
                {OFFER_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>

            {form.type === 'custom' && (
              <div className="form-group">
                <label className="form-label">Discount Percentage *</label>
                <input type="number" min="1" max="100" placeholder="e.g. 20 (for 20% off)" value={form.discountPercent} onChange={set('discountPercent')} />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea placeholder="e.g. Order 1 Nutella Cookie, get 1 completely free!" value={form.description} onChange={set('description')} rows={3} style={{ resize: 'vertical' }} />
            </div>

            {isBoxGift ? (
              <>
                <div className="form-group">
                  <label className="form-label">Boxes in this Offer (optional)</label>
                  <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '0 0 10px' }}>
                    The customer buys one of these boxes. Leave all unchecked to apply to every box.
                  </p>
                  <ProductChecklist
                    items={products.filter(p => p.type === 'box')}
                    selectedIds={form.productIds}
                    onToggle={toggleId('productIds')}
                    emptyText="No available boxes"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Free Gift Items (optional)</label>
                  <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '0 0 10px' }}>
                    Items the customer can choose as their free gift. Leave all unchecked to allow any item.
                  </p>
                  <ProductChecklist
                    items={products.filter(p => p.type !== 'box')}
                    selectedIds={form.giftProductIds}
                    onToggle={toggleId('giftProductIds')}
                    emptyText="No available items"
                  />
                </div>
              </>
            ) : (
              <div className="form-group">
                <label className="form-label">{isBogo ? 'Items in this Offer (optional)' : 'Products in this Offer (optional)'}</label>
                <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '0 0 10px' }}>
                  {isBogo
                    ? 'Buy-X-Get-1 offers exclude boxes. Leave all unchecked to apply to every item.'
                    : 'Leave all unchecked to apply to every product.'}
                </p>
                <ProductChecklist
                  items={isBogo ? products.filter(p => p.type !== 'box') : products}
                  selectedIds={form.productIds}
                  onToggle={toggleId('productIds')}
                  emptyText="No available products"
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <button type="button" onClick={() => setForm({ ...form, active: !form.active })} style={{ background: form.active ? 'var(--brown)' : 'var(--border)', border: 'none', borderRadius: 50, padding: '9px 22px', color: form.active ? 'white' : 'var(--text-light)', fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: 'Poppins,sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {form.active
                  ? <><FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 14 }} /> Active (visible to customers)</>
                  : <><FontAwesomeIcon icon={faCircleXmark} style={{ fontSize: 14 }} /> Hidden</>}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Offer'}
              </button>
              <button className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

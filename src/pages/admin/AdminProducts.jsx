import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencil, faTag, faTrash, faCamera, faCircleCheck, faCircleXmark, faWandMagicSparkles, faTriangleExclamation, faXmark, faCookieBite, faLayerGroup, faCakeCandles, faMugHot, faUtensils, faBoxOpen, faIceCream, faJarWheat } from '@fortawesome/free-solid-svg-icons'
import { db, storage } from '../../firebase/config.jsx'
import { InlineLoader } from '../../components/Loader.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import toast from 'react-hot-toast'

const EMPTY      = { name: '', description: '', price: '', category: 'cookies', available: true, imageUrl: '', onSale: false, salePrice: '', isNew: false, stock: '', flavorIds: [], extraIds: [] }
const BOX_EMPTY  = { name: '', description: '', price: '', boxCategory: 'cookies', boxSize: '', stock: '', available: true, imageUrl: '', onSale: false, salePrice: '', isNew: false }
const BITE_EMPTY = { name: '', description: '', price: '', biteCategory: 'cookies', pieceCount: '', contents: [], stock: '', available: true, imageUrl: '', onSale: false, salePrice: '', isNew: false, extraIds: [] }

const CATEGORIES      = ['cookies', 'brownies', 'cheesecake', 'tiramisu']
const BITE_CATEGORIES = ['cookies', 'brownies'] // bites only come in these two
const CAT_ICONS  = { cookies: faCookieBite, brownies: faLayerGroup, cheesecake: faCakeCandles, tiramisu: faMugHot }
const COUNTING   = ['cookies', 'brownies']

function validate(form) {
  const errs = {}
  if (!form.name.trim())              errs.name      = 'Product name is required'
  if (!form.price || form.price <= 0) errs.price     = 'Enter a valid price'
  if (form.onSale) {
    if (!form.salePrice || Number(form.salePrice) <= 0)       errs.salePrice = 'Enter a valid sale price'
    if (Number(form.salePrice) >= Number(form.price))         errs.salePrice = 'Sale price must be less than original price'
  }
  if (form.stock !== '' && (isNaN(Number(form.stock)) || Number(form.stock) < 0 || !Number.isInteger(Number(form.stock)))) {
    errs.stock = 'Stock must be a whole number (0 or more)'
  }
  return errs
}

function validateBite(form) {
  const errs = {}
  if (!form.name.trim())                      errs.name  = 'Bite name is required'
  if (!form.price || Number(form.price) <= 0) errs.price = 'Enter a valid price'
  if (form.onSale) {
    if (!form.salePrice || Number(form.salePrice) <= 0)       errs.salePrice = 'Enter a valid sale price'
    if (Number(form.salePrice) >= Number(form.price))         errs.salePrice = 'Sale price must be less than original price'
  }
  const n = Number(form.pieceCount)
  if (!form.pieceCount || !Number.isInteger(n) || n < 1) errs.pieceCount = 'Enter a valid piece count (1 or more)'
  if (form.stock !== '' && (isNaN(Number(form.stock)) || Number(form.stock) < 0 || !Number.isInteger(Number(form.stock)))) {
    errs.stock = 'Stock must be a whole number (0 or more)'
  }
  return errs
}

function validateBox(form) {
  const errs = {}
  if (!form.name.trim())              errs.name  = 'Box name is required'
  if (!form.price || Number(form.price) <= 0) errs.price = 'Enter a valid price'
  if (form.onSale) {
    if (!form.salePrice || Number(form.salePrice) <= 0)       errs.salePrice = 'Enter a valid sale price'
    if (Number(form.salePrice) >= Number(form.price))         errs.salePrice = 'Sale price must be less than original price'
  }
  if (COUNTING.includes(form.boxCategory)) {
    const n = Number(form.boxSize)
    if (!form.boxSize || !Number.isInteger(n) || n < 1) errs.boxSize = 'Enter a valid piece count (e.g. 6)'
  }
  if (form.stock !== '' && (isNaN(Number(form.stock)) || Number(form.stock) < 0 || !Number.isInteger(Number(form.stock)))) {
    errs.stock = 'Stock must be a whole number (0 or more)'
  }
  return errs
}

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(false)
  const [formType, setFormType] = useState('product') // 'product' | 'box'
  const [editing,  setEditing]  = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [errors,   setErrors]   = useState({})
  const [imgFile,  setImgFile]  = useState(null)
  const [imgPreview, setImgPreview]             = useState('')
  const [uploadProgress, setUploadProgress]     = useState(0)
  const [saving,         setSaving]             = useState(false)
  const [confirmDelete,  setConfirmDelete]       = useState(null)
  const [allFlavors,     setAllFlavors]          = useState([])
  const [allExtras,      setAllExtras]           = useState([])

  async function load() {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'products'))
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error('Products load failed:', err); toast.error('Failed to load products') }
    setLoading(false)
  }

  // Flavors/extras feed the checkbox pickers in the product form
  async function loadCatalog() {
    try {
      const [fSnap, eSnap] = await Promise.all([
        getDocs(collection(db, 'flavors')),
        getDocs(collection(db, 'extras')),
      ])
      const byName = (a, b) => (a.name || '').localeCompare(b.name || '')
      setAllFlavors(fSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byName))
      setAllExtras(eSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byName))
    } catch (err) { console.error('Flavors/extras load failed:', err) }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); loadCatalog() }, [])

  function openNewProduct() {
    setFormType('product'); setEditing(null); setForm(EMPTY)
    setImgFile(null); setImgPreview(''); setErrors({}); setUploadProgress(0); setModal(true)
  }

  function openNewBox() {
    setFormType('box'); setEditing(null); setForm(BOX_EMPTY)
    setImgFile(null); setImgPreview(''); setErrors({}); setUploadProgress(0); setModal(true)
  }

  function openNewBite() {
    setFormType('bite'); setEditing(null); setForm(BITE_EMPTY)
    setImgFile(null); setImgPreview(''); setErrors({}); setUploadProgress(0); setModal(true)
  }

  function biteFormFrom(p, overrides = {}) {
    return { name: p.name, description: p.description || '', price: p.price, biteCategory: p.category || 'cookies', pieceCount: p.pieceCount ?? '', contents: p.contents || [], stock: p.stock ?? '', available: p.available, imageUrl: p.imageUrl || '', onSale: p.onSale || false, salePrice: p.salePrice || '', isNew: p.isNew || false, extraIds: p.extraIds || [], ...overrides }
  }

  // Switching the bite category prunes contents that no longer match it
  function setBiteCategory(e) {
    const cat = e.target.value
    setForm(f => ({
      ...f,
      biteCategory: cat,
      contents: (f.contents || []).filter(c => products.find(p => p.id === c.id)?.category === cat),
    }))
  }

  function openEdit(p) {
    setEditing(p)
    if (p.type === 'box') {
      setFormType('box')
      setForm({ name: p.name, description: p.description || '', price: p.price, boxCategory: p.boxCategory || p.category, boxSize: p.boxSize ?? '', stock: p.stock ?? '', available: p.available, imageUrl: p.imageUrl || '', onSale: p.onSale || false, salePrice: p.salePrice || '', isNew: p.isNew || false })
    } else if (p.type === 'bite') {
      setFormType('bite')
      setForm(biteFormFrom(p))
    } else {
      setFormType('product')
      setForm({ name: p.name, description: p.description || '', price: p.price, category: p.category, available: p.available, imageUrl: p.imageUrl || '', onSale: p.onSale || false, salePrice: p.salePrice || '', isNew: p.isNew || false, stock: p.stock ?? '', flavorIds: p.flavorIds || [], extraIds: p.extraIds || [] })
    }
    setImgFile(null); setImgPreview(p.imageUrl || ''); setErrors({}); setUploadProgress(0); setModal(true)
  }

  function handleImg(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024)    { toast.error('Image must be under 5MB'); return }
    setImgFile(file); setImgPreview(URL.createObjectURL(file))
  }

  function uploadImage(file, path) {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path)
      const task = uploadBytesResumable(storageRef, file)
      task.on('state_changed',
        snap => setUploadProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
        err  => reject(err),
        async () => resolve(await getDownloadURL(task.snapshot.ref))
      )
    })
  }

  async function handleSave() {
    const errs = formType === 'box' ? validateBox(form) : formType === 'bite' ? validateBite(form) : validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      let imageUrl = form.imageUrl
      if (imgFile) {
        toast.loading('Uploading image...', { id: 'upload' })
        const path = `products/${Date.now()}_${imgFile.name.replace(/\s/g, '_')}`
        imageUrl = await uploadImage(imgFile, path)
        toast.dismiss('upload')
      }

      let data
      if (formType === 'bite') {
        data = {
          type: 'bite',
          name: form.name.trim(),
          description: form.description.trim(),
          price: Number(form.price),
          category: form.biteCategory,
          pieceCount: Number(form.pieceCount),
          contents: form.contents || [],
          available: form.available,
          imageUrl: imageUrl || '',
          onSale: form.onSale,
          salePrice: form.onSale ? Number(form.salePrice) : null,
          isNew: form.isNew,
          stock: form.stock !== '' ? Number(form.stock) : null,
          // No admin-assigned flavors — the customer picks ONE flavor at purchase
          extraIds: form.extraIds || [],
          updatedAt: new Date(),
        }
      } else if (formType === 'box') {
        data = {
          type: 'box',
          name: form.name.trim(),
          description: form.description.trim(),
          price: Number(form.price),
          category: form.boxCategory,
          boxCategory: form.boxCategory,
          boxSize: COUNTING.includes(form.boxCategory) ? Number(form.boxSize) : null,
          available: form.available,
          imageUrl: imageUrl || '',
          onSale: form.onSale,
          salePrice: form.onSale ? Number(form.salePrice) : null,
          isNew: form.isNew,
          stock: form.stock !== '' ? Number(form.stock) : null,
          updatedAt: new Date(),
        }
      } else {
        data = {
          name: form.name.trim(), description: form.description.trim(), price: Number(form.price),
          category: form.category, available: form.available, imageUrl: imageUrl || '',
          onSale: form.onSale, salePrice: form.onSale ? Number(form.salePrice) : null,
          isNew: form.isNew, stock: form.stock !== '' ? Number(form.stock) : null,
          flavorIds: form.flavorIds || [], extraIds: form.extraIds || [],
          updatedAt: new Date(),
        }
      }

      const typeLabel = formType === 'box' ? 'Box' : formType === 'bite' ? 'Bite' : 'Product'
      if (editing) {
        await updateDoc(doc(db, 'products', editing.id), data)
        toast.success(`${typeLabel} updated!`)
      } else {
        await addDoc(collection(db, 'products'), { ...data, createdAt: new Date() })
        toast.success(`${typeLabel} added!`)
      }
      setModal(false); load()
    } catch (err) {
      if (err.code === 'storage/unauthorized') toast.error('Storage permission denied — check Firebase Storage rules')
      else toast.error('Something went wrong: ' + err.message)
    }
    setSaving(false); setUploadProgress(0)
  }

  function handleDelete(p) { setConfirmDelete(p) }

  async function doDelete() {
    const p = confirmDelete
    setConfirmDelete(null)
    try {
      await deleteDoc(doc(db, 'products', p.id))
      if (p.imageUrl) { try { await deleteObject(ref(storage, p.imageUrl)) } catch (e) { console.warn('Image delete failed:', e) } }
      toast.success('Deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  async function toggleAvailability(p) {
    await updateDoc(doc(db, 'products', p.id), { available: !p.available })
    load()
  }

  async function toggleSale(p) {
    if (p.onSale) {
      await updateDoc(doc(db, 'products', p.id), { onSale: false, salePrice: null })
      toast.success('Sale removed'); load()
    } else {
      setEditing(p)
      if (p.type === 'box') {
        setFormType('box')
        setForm({ name: p.name, description: p.description || '', price: p.price, boxCategory: p.boxCategory || p.category, boxSize: p.boxSize ?? '', stock: p.stock ?? '', available: p.available, imageUrl: p.imageUrl || '', onSale: true, salePrice: '', isNew: p.isNew || false })
      } else if (p.type === 'bite') {
        setFormType('bite')
        setForm(biteFormFrom(p, { onSale: true, salePrice: '' }))
      } else {
        setFormType('product')
        setForm({ name: p.name, description: p.description || '', price: p.price, category: p.category, available: p.available, imageUrl: p.imageUrl || '', onSale: true, salePrice: '', isNew: p.isNew || false, stock: p.stock ?? '', flavorIds: p.flavorIds || [], extraIds: p.extraIds || [] })
      }
      setImgFile(null); setImgPreview(p.imageUrl || ''); setErrors({}); setUploadProgress(0); setModal(true)
      toast('Set the sale price and save', { icon: <FontAwesomeIcon icon={faTag} style={{ fontSize: 16 }} /> })
    }
  }

  const set = k => e => { setForm({ ...form, [k]: e.target.value }); setErrors(prev => ({ ...prev, [k]: '' })) }
  const toggleId = (k, id) => setForm(f => {
    const list = f[k] || []
    return { ...f, [k]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] }
  })
  const discountPct = (p) => p.onSale && p.salePrice ? Math.round((1 - p.salePrice / p.price) * 100) : 0

  const isBoxCounting = COUNTING.includes(form.boxCategory)

  return (
    <>
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete"
        message={`Delete "${confirmDelete?.name}"? This cannot be undone.`}
        confirmText="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h2 className="admin-page-title" style={{ marginBottom: 0 }}>Products</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={openNewBite} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FontAwesomeIcon icon={faCookieBite} style={{ fontSize: 14 }} /> Add Bite
          </button>
          <button className="btn btn-outline btn-sm" onClick={openNewBox} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: 14 }} /> Add Box
          </button>
          <button className="btn btn-primary" onClick={openNewProduct}>+ Add Product</button>
        </div>
      </div>

      {loading ? <InlineLoader text="Loading products..." /> : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Sale</th><th>Stock</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--text-light)' }}>No products yet. Add your first one!</td></tr>
              )}
              {products.map(p => {
                const catIcon  = CAT_ICONS[p.category] || faUtensils
                const isBox    = p.type === 'box'
                const isBite   = p.type === 'bite'
                return (
                  <tr key={p.id} style={{ background: p.onSale ? '#FFF8E7' : '' }}>
                    <td>
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} className="admin-product-img" loading="lazy" />
                        : <div className="admin-product-img-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FontAwesomeIcon icon={isBox ? faBoxOpen : catIcon} style={{ fontSize: 24, color: 'var(--brown-light)' }} />
                          </div>
                      }
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {isBox && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brown)', background: 'var(--pink-light)', borderRadius: 4, padding: '1px 7px', marginLeft: 6, verticalAlign: 'middle' }}>BOX</span>
                      )}
                      {isBite && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'white', background: 'var(--brown)', borderRadius: 4, padding: '1px 7px', marginLeft: 6, verticalAlign: 'middle' }}>BITE</span>
                      )}
                      {p.name}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {p.category}
                      {isBox && p.boxSize && <span style={{ fontSize: 11, color: 'var(--text-light)', display: 'block' }}>{p.boxSize} pcs</span>}
                      {isBite && p.pieceCount && <span style={{ fontSize: 11, color: 'var(--text-light)', display: 'block' }}>{p.pieceCount} pcs</span>}
                    </td>
                    <td>
                      {p.onSale && p.salePrice ? (
                        <div>
                          <span style={{ textDecoration: 'line-through', color: 'var(--text-light)', fontSize: 13 }}>{p.price} EGP</span>
                          <span style={{ color: '#e53935', fontWeight: 700, display: 'block' }}>{p.salePrice} EGP</span>
                        </div>
                      ) : (
                        <span style={{ fontWeight: 700, color: 'var(--brown)' }}>{p.price} EGP</span>
                      )}
                    </td>
                    <td>
                      {p.onSale && p.salePrice ? (
                        <span style={{ display: 'inline-block', background: '#e53935', color: 'white', fontSize: 11, fontWeight: 700, lineHeight: 1.4, padding: '3px 11px', borderRadius: 50, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>-{discountPct(p)}% OFF</span>
                      ) : (
                        <span style={{ color: 'var(--text-light)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>
                      {p.stock == null
                        ? <span style={{ color: 'var(--text-light)', fontSize: 12 }}>—</span>
                        : <span style={{ fontWeight: 600, color: p.stock === 0 ? '#e53935' : 'var(--brown-dark)' }}>{p.stock}</span>
                      }
                    </td>
                    <td>
                      <button onClick={() => toggleAvailability(p)} style={{ background: p.available ? '#E8F5E9' : '#FFEBEE', color: p.available ? '#2E7D32' : '#C62828', border: 'none', borderRadius: 50, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {p.available
                          ? <><FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 12 }} /> Visible</>
                          : <><FontAwesomeIcon icon={faCircleXmark} style={{ fontSize: 12 }} /> Hidden</>}
                      </button>
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => openEdit(p)} title="Edit"><FontAwesomeIcon icon={faPencil} style={{ fontSize: 15 }} /></button>
                      <button className="btn-icon" onClick={() => toggleSale(p)} title={p.onSale ? 'Remove Sale' : 'Add Sale'} style={{ background: p.onSale ? '#FFF3E0' : '' }}>
                        <FontAwesomeIcon icon={faTag} style={{ fontSize: 15 }} />
                      </button>
                      <button className="btn-icon delete" onClick={() => handleDelete(p)} title="Delete"><FontAwesomeIcon icon={faTrash} style={{ fontSize: 15 }} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(false)}><FontAwesomeIcon icon={faXmark} style={{ fontSize: 18 }} /></button>

            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <FontAwesomeIcon icon={formType === 'box' ? faBoxOpen : faCookieBite} style={{ fontSize: 20, color: 'var(--brown)' }} />
              <h3 style={{ margin: 0 }}>
                {formType === 'box'
                  ? (editing ? 'Edit Box' : 'Add New Box')
                  : formType === 'bite'
                    ? (editing ? 'Edit Bite' : 'Add New Bite')
                    : (editing ? 'Edit Product' : 'Add New Product')}
              </h3>
            </div>

            {/* Shared: Name */}
            <div className="form-group">
              <label className="form-label">{formType === 'box' ? 'Box Name' : formType === 'bite' ? 'Bite Name' : 'Product Name'} *</label>
              <input
                placeholder={formType === 'box' ? 'e.g. Cookie Assortment Box' : formType === 'bite' ? 'e.g. Mini Cookie Bites' : 'e.g. Nutella Stuffed Cookies'}
                value={form.name} onChange={set('name')} className={errors.name ? 'error' : ''}
              />
              {errors.name && <div className="field-error"><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} /> {errors.name}</div>}
            </div>

            {/* Shared: Description */}
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea placeholder="Describe the product..." value={form.description} onChange={set('description')} rows={3} style={{ resize: 'vertical' }} />
            </div>

            {/* Price row — differs by type */}
            {formType === 'box' ? (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Box Price (EGP) *</label>
                    <input type="number" placeholder="250" value={form.price} onChange={set('price')} min={1} className={errors.price ? 'error' : ''} />
                    {errors.price && <div className="field-error"><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} /> {errors.price}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Box Category *</label>
                    <select value={form.boxCategory} onChange={set('boxCategory')}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                </div>

                {/* Box size — only for counting categories */}
                {isBoxCounting && (
                  <div className="form-group">
                    <label className="form-label">Box Size (pieces) *</label>
                    <input type="number" placeholder="e.g. 6" value={form.boxSize} onChange={set('boxSize')} min={1} step={1} style={{ maxWidth: 180 }} className={errors.boxSize ? 'error' : ''} />
                    {errors.boxSize && <div className="field-error"><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} /> {errors.boxSize}</div>}
                  </div>
                )}

                {/* Info hint */}
                <div style={{ background: 'var(--cream)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--text-light)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: 13, color: 'var(--brown-light)', flexShrink: 0 }} />
                  {isBoxCounting
                    ? `Customer picks exactly ${form.boxSize || '?'} pieces of ${form.boxCategory} flavors to fill this box.`
                    : `Customer picks exactly one ${form.boxCategory} flavor.`}
                </div>
              </>
            ) : formType === 'bite' ? (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Price (EGP) *</label>
                    <input type="number" placeholder="120" value={form.price} onChange={set('price')} min={1} className={errors.price ? 'error' : ''} />
                    {errors.price && <div className="field-error"><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} /> {errors.price}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select value={form.biteCategory} onChange={setBiteCategory}>
                      {BITE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Piece Count *</label>
                  <input type="number" placeholder="e.g. 4" value={form.pieceCount} onChange={set('pieceCount')} min={1} step={1} style={{ maxWidth: 180 }} className={errors.pieceCount ? 'error' : ''} />
                  {errors.pieceCount && <div className="field-error"><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} /> {errors.pieceCount}</div>}
                  <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>How many pieces this bite contains — fixed by you, the customer doesn't pick.</div>
                </div>

                {/* Contents — optional link to existing products */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FontAwesomeIcon icon={faCookieBite} style={{ fontSize: 13, color: 'var(--brown)' }} /> Contents
                    <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>— optional: which {form.biteCategory} products it consists of</span>
                  </label>
                  {products.filter(p => !p.type && p.category === form.biteCategory).length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>No {form.biteCategory} products yet — you can still define the bite by name and description alone.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {products.filter(p => !p.type && p.category === form.biteCategory).map(p => {
                        const checked = (form.contents || []).some(c => c.id === p.id)
                        return (
                          <button key={p.id} type="button" onClick={() => setForm(f => ({ ...f, contents: checked ? f.contents.filter(c => c.id !== p.id) : [...(f.contents || []), { id: p.id, name: p.name }] }))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 50, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'all 0.2s', border: checked ? '1.5px solid var(--brown)' : '1.5px solid var(--border)', background: checked ? 'var(--brown)' : 'white', color: checked ? 'white' : 'var(--text)' }}>
                            {checked && <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 12 }} />}
                            {p.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Original Price (EGP) *</label>
                  <input type="number" placeholder="150" value={form.price} onChange={set('price')} min={1} className={errors.price ? 'error' : ''} />
                  {errors.price && <div className="field-error"><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} /> {errors.price}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select value={form.category} onChange={set('category')}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Shared: Stock */}
            <div className="form-group">
              <label className="form-label">Stock Quantity</label>
              <input type="number" placeholder="Leave empty for unlimited" value={form.stock} onChange={set('stock')} min={0} step={1} style={{ maxWidth: 220 }} className={errors.stock ? 'error' : ''} />
              {errors.stock && <div className="field-error"><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} /> {errors.stock}</div>}
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>Set to 0 to mark as out of stock. Leave empty for unlimited.</div>
            </div>

            {/* Flavors — plain products only (boxes have their own picker; bite customers
                choose ONE flavor from the flavors list when adding to cart) */}
            {formType === 'product' && (
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FontAwesomeIcon icon={faIceCream} style={{ fontSize: 13, color: 'var(--brown)' }} /> Flavors
                    <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>— shown on the product card</span>
                  </label>
                  {allFlavors.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>No flavors yet — add them in the Flavors section first.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {allFlavors.map(f => {
                        const checked = (form.flavorIds || []).includes(f.id)
                        return (
                          <button key={f.id} type="button" onClick={() => toggleId('flavorIds', f.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 50, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'all 0.2s', border: checked ? '1.5px solid var(--brown)' : '1.5px solid var(--border)', background: checked ? 'var(--brown)' : 'white', color: checked ? 'white' : 'var(--text)', opacity: f.active === false ? 0.55 : 1 }}>
                            {checked && <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 12 }} />}
                            {f.name}{f.active === false ? ' (inactive)' : ''}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
            )}

            {/* Extras — products and bites */}
            {formType !== 'box' && (
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FontAwesomeIcon icon={faJarWheat} style={{ fontSize: 13, color: 'var(--brown)' }} /> Available Extras
                    <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>— optional paid add-ons the customer can pick</span>
                  </label>
                  {allExtras.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>No extras yet — add them in the Extras section first.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {allExtras.map(x => {
                        const checked = (form.extraIds || []).includes(x.id)
                        return (
                          <button key={x.id} type="button" onClick={() => toggleId('extraIds', x.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 50, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'all 0.2s', border: checked ? '1.5px solid var(--brown)' : '1.5px solid var(--border)', background: checked ? 'var(--brown)' : 'white', color: checked ? 'white' : 'var(--text)', opacity: x.active === false ? 0.55 : 1 }}>
                            {checked && <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 12 }} />}
                            {x.name} (+{x.price} EGP){x.active === false ? ' (inactive)' : ''}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
            )}

            {/* Sale toggle */}
            <div style={{ background: form.onSale ? '#FFF8E7' : 'var(--cream)', borderRadius: 'var(--radius-sm)', padding: 18, marginBottom: 22, border: form.onSale ? '1.5px solid #FFD700' : '1.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.onSale ? 16 : 0 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--brown-dark)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FontAwesomeIcon icon={faTag} style={{ fontSize: 14 }} /> Sale Price
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>Show discounted price to customers</div>
                </div>
                <button type="button" onClick={() => setForm({ ...form, onSale: !form.onSale, salePrice: '' })} style={{ background: form.onSale ? '#e53935' : 'var(--brown)', color: 'white', border: 'none', borderRadius: 50, padding: '8px 20px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', transition: 'all 0.2s' }}>
                  {form.onSale ? 'Remove Sale' : '+ Add Sale'}
                </button>
              </div>
              {form.onSale && (
                <div>
                  <label className="form-label">Sale Price (EGP) *</label>
                  <input type="number" placeholder={`Less than ${form.price || '...'} EGP`} value={form.salePrice} onChange={set('salePrice')} min={1} className={errors.salePrice ? 'error' : ''} style={{ background: 'white' }} />
                  {errors.salePrice && <div className="field-error"><FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} /> {errors.salePrice}</div>}
                  {form.salePrice && form.price && Number(form.salePrice) < Number(form.price) && (
                    <div style={{ marginTop: 8, fontSize: 13, color: '#2E7D32', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 13 }} /> Discount: {Math.round((1 - form.salePrice / form.price) * 100)}% off
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Shared: Image */}
            <div className="form-group">
              <label className="form-label">Image</label>
              <label className="upload-area-v2" style={{ display: 'block', cursor: 'pointer' }}>
                <input type="file" accept="image/*" onChange={handleImg} style={{ display: 'none' }} />
                {imgPreview
                  ? <img src={imgPreview} alt="preview" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8 }} />
                  : <div className="upload-placeholder">
                      <div className="upload-icon"><FontAwesomeIcon icon={faCamera} style={{ fontSize: 40, color: 'var(--brown-light)' }} /></div>
                      <p className="upload-text">Click to upload image</p>
                      <p className="upload-hint">Max 5MB</p>
                    </div>
                }
              </label>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--brown)', height: '100%', width: `${uploadProgress}%`, transition: 'width 0.3s ease' }} />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>Uploading... {uploadProgress}%</p>
                </div>
              )}
            </div>

            {/* Shared: Availability + isNew */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
              <button type="button" onClick={() => setForm({ ...form, available: !form.available })} style={{ background: form.available ? 'var(--brown)' : 'var(--border)', border: 'none', borderRadius: 50, padding: '9px 22px', color: form.available ? 'white' : 'var(--text-light)', fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: 'Poppins,sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {form.available
                  ? <><FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 14 }} /> Visible to customers</>
                  : <><FontAwesomeIcon icon={faCircleXmark} style={{ fontSize: 14 }} /> Hidden</>}
              </button>
              <button type="button" onClick={() => setForm({ ...form, isNew: !form.isNew })} style={{ background: form.isNew ? 'linear-gradient(135deg,#5B3121,#8B4513)' : 'var(--border)', border: 'none', borderRadius: 50, padding: '9px 22px', color: form.isNew ? 'var(--pink)' : 'var(--text-light)', fontWeight: 700, cursor: 'pointer', fontSize: 12, fontFamily: 'Poppins,sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {form.isNew ? <><FontAwesomeIcon icon={faWandMagicSparkles} style={{ fontSize: 13 }} /> NEW Item</> : '+ Mark as New'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : formType === 'box' ? 'Add Box' : formType === 'bite' ? 'Add Bite' : 'Add Product'}
              </button>
              <button className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

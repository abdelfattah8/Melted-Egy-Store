import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClipboardList, faMoneyBill, faCreditCard, faComment } from '@fortawesome/free-solid-svg-icons'
import { db } from '../../firebase/config.jsx'
import { InlineLoader } from '../../components/Loader.jsx'
import toast from 'react-hot-toast'

export default function AdminSettings() {
  const [form, setForm] = useState({ transferNumber: '', instapayAccount: '', whatsappNumber: '', deliveryFee: 85, deliveryNote: '' })
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const set = k => e => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'main'))
        if (snap.exists()) setForm(prev => ({ ...prev, ...snap.data() }))
      } catch (err) { console.error('Settings load failed:', err) }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.whatsappNumber) { toast.error('WhatsApp number is required for order contact'); return }
    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'main'), { ...form, deliveryFee: Number(form.deliveryFee) }, { merge: true })
      toast.success('Settings saved!')
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }

  if (loading) return <InlineLoader text="Loading settings..." />

  return (
    <>
      <h2 className="admin-page-title">Settings</h2>
      <div className="checkout-section" style={{ maxWidth: 580 }}>
        <h3 style={{ fontSize: 20, color: 'var(--brown-dark)', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          Contact &amp; Payment
        </h3>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">WhatsApp Number * <span style={{ color: '#2E7D32', fontSize: 12 }}>(for order modifications)</span></label>
            <input placeholder="01xxxxxxxxx" value={form.whatsappNumber} onChange={set('whatsappNumber')} required />
            <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 5 }}>Customers use this to modify or cancel their orders</p>
          </div>
          <div className="form-group">
            <label className="form-label">Vodafone Cash Number</label>
            <input placeholder="01xxxxxxxxx" value={form.transferNumber} onChange={set('transferNumber')} />
            <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 5 }}>Shown for Cash on Delivery deposit (orders over 1,000 EGP)</p>
          </div>
          <div className="form-group">
            <label className="form-label">InstaPay Account</label>
            <input placeholder="01xxxxxxxxx or @username" value={form.instapayAccount} onChange={set('instapayAccount')} />
            <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 5 }}>Shown to customers who pay by Visa / InstaPay</p>
          </div>
          <div className="form-group">
            <label className="form-label">Delivery Fee (EGP)</label>
            <input type="number" min={0} value={form.deliveryFee} onChange={set('deliveryFee')} />
          </div>
          <div className="form-group">
            <label className="form-label">Delivery Note (optional)</label>
            <textarea placeholder="Notes about delivery..." value={form.deliveryNote} onChange={set('deliveryNote')} rows={2} style={{ resize: 'vertical' }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      <div className="checkout-section" style={{ maxWidth: 580, marginTop: 24 }}>
        <h3 style={{ fontSize: 18, color: 'var(--brown-dark)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 18, color: 'var(--brown)' }} /> Rules Summary
        </h3>
        <div className="alert alert-info">
          <div style={{ lineHeight: 2 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 4 }}><FontAwesomeIcon icon={faMoneyBill} style={{ fontSize: 14 }} /></span>
            <strong>Cash on Delivery</strong> + order &gt; 1,000 EGP → 30% deposit required<br />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 4 }}><FontAwesomeIcon icon={faCreditCard} style={{ fontSize: 14 }} /></span>
            <strong>Visa / InstaPay</strong> → no deposit, full payment via InstaPay<br />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 4 }}><FontAwesomeIcon icon={faComment} style={{ fontSize: 14 }} /></span>
            <strong>Order changes</strong> → customer contacts you via WhatsApp
          </div>
        </div>
      </div>
    </>
  )
}

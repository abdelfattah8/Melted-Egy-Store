import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faTriangleExclamation, faKey, faLock } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext.jsx'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import SEO from '../components/SEO.jsx'
import toast from 'react-hot-toast'

function FieldError({ errors, name }) {
  if (!errors?.[name]) return null
  return (
    <div className="field-error" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} /> {errors[name]}
    </div>
  )
}

function validate(form) {
  const errors = {}
  if (!form.name.trim())             errors.name    = 'Name is required'
  if (!/^01\d{9}$/.test(form.phone)) errors.phone   = 'Enter a valid Egyptian phone number (01xxxxxxxxx)'
  if (!form.address.trim())          errors.address = 'Address is required'
  return errors
}

function pwStrength(pw) {
  if (!pw) return ''
  if (pw.length < 6) return 'weak'
  if (pw.length < 10 || !/[0-9]/.test(pw)) return 'medium'
  return 'strong'
}

export default function Profile() {
  const { userData, updateProfile, currentUser } = useAuth()

  const [form, setForm] = useState({ name: userData?.name || '', phone: userData?.phone || '', address: userData?.address || '', city: userData?.city || 'cairo' })
  const [errors,  setErrors]  = useState({})
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (userData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({ name: userData.name || '', phone: userData.phone || '', address: userData.address || '', city: userData.city || 'cairo' })
    }
  }, [userData])

  const [pwForm, setPwForm]     = useState({ current: '', newPw: '', confirm: '' })
  const [pwErrors, setPwErrors] = useState({})
  const [pwSaving, setPwSaving] = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  const set   = k => e => setForm({   ...form,   [k]: e.target.value })
  const setPw = k => e => setPwForm({ ...pwForm,  [k]: e.target.value })

  async function handleSave(e) {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      await updateProfile(form)
      toast.success('Profile updated!')
    } catch (err) {
      console.error('Profile save error:', err?.code, err?.message)
      const msg = err?.code === 'permission-denied'
        ? 'Permission denied — check Firestore rules'
        : err?.message || 'Failed to update profile'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    const errs = {}
    if (!pwForm.current)              errs.current = 'Enter your current password'
    if (pwForm.newPw.length < 6)      errs.newPw   = 'New password must be at least 6 characters'
    if (pwForm.newPw !== pwForm.confirm) errs.confirm = 'Passwords do not match'
    setPwErrors(errs)
    if (Object.keys(errs).length) return

    setPwSaving(true)
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, pwForm.current)
      await reauthenticateWithCredential(currentUser, credential)
      await updatePassword(currentUser, pwForm.newPw)
      toast.success('Password changed successfully!')
      setPwForm({ current: '', newPw: '', confirm: '' })
      setShowPw(false)
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential')
        setPwErrors({ current: 'Current password is incorrect' })
      else toast.error('Failed to change password')
    } finally {
      setPwSaving(false)
    }
  }

  const strength = pwStrength(pwForm.newPw)


  return (
    <div className="profile-page">
      <SEO title="My Account" description="Manage your Melted Egypt profile, delivery address and password." path="/profile" />
      <div style={{ marginBottom: 36, animation: 'fadeInUp 0.5s ease both' }}>
        <div className="profile-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesomeIcon icon={faUser} style={{ fontSize: 40, color: 'var(--brown)' }} />
        </div>
        <h2 style={{ color: 'var(--brown-dark)', marginBottom: 4, fontSize: 30 }}>{userData?.name || 'My Account'}</h2>
        <p style={{ color: 'var(--text-light)', fontSize: 14 }}>{userData?.email}</p>
      </div>

      <div className="checkout-section">
        <h3>Personal Information</h3>
        <form onSubmit={handleSave} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input value={form.name} onChange={set('name')} placeholder="Your name" className={errors.name ? 'error' : ''} />
              <FieldError errors={errors} name="name" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input value={form.phone} onChange={set('phone')} placeholder="01xxxxxxxxx" className={errors.phone ? 'error' : ''} />
              <FieldError errors={errors} name="phone" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <select value={form.city} onChange={set('city')}>
              <option value="cairo">Cairo</option>
              <option value="giza">Giza</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Full Address</label>
            <input value={form.address} onChange={set('address')} placeholder="Area, Street, Building number..." className={errors.address ? 'error' : ''} />
            <FieldError errors={errors} name="address" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <div className="checkout-section" style={{ marginTop: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showPw ? 24 : 0, paddingBottom: showPw ? 16 : 0, borderBottom: showPw ? '1px solid var(--border)' : 'none' }}>
          <h3 style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Change Password</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setShowPw(!showPw); setPwErrors({}) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {showPw ? 'Cancel' : <><FontAwesomeIcon icon={faKey} style={{ fontSize: 14 }} /> Change Password</>}
          </button>
        </div>

        {showPw && (
          <form onSubmit={handleChangePassword} noValidate style={{ animation: 'slideDown 0.3s ease both' }}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input type="password" value={pwForm.current} onChange={setPw('current')} placeholder="••••••••" className={pwErrors.current ? 'error' : ''} />
              <FieldError errors={pwErrors} name="current" />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" value={pwForm.newPw} onChange={setPw('newPw')} placeholder="Min. 6 characters" className={pwErrors.newPw ? 'error' : ''} />
              {pwForm.newPw && <div className={`password-strength strength-${strength}`} title={`Strength: ${strength}`} />}
              <FieldError errors={pwErrors} name="newPw" />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input type="password" value={pwForm.confirm} onChange={setPw('confirm')} placeholder="Repeat new password" className={pwErrors.confirm ? 'error' : ''} />
              <FieldError errors={pwErrors} name="confirm" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={pwSaving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FontAwesomeIcon icon={faLock} style={{ fontSize: 14 }} /> {pwSaving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

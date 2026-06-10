import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext.jsx'
import SEO from '../components/SEO.jsx'
import toast from 'react-hot-toast'

function FieldError({ errors, name }) {
  if (!errors[name]) return null
  return (
    <div className="field-error" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 12 }} /> {errors[name]}
    </div>
  )
}

function validate(form) {
  const errs = {}
  if (!form.name.trim())                               errs.name     = 'Full name is required'
  if (!/^01\d{9}$/.test(form.phone))                  errs.phone    = 'Enter a valid Egyptian number (01xxxxxxxxx)'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email    = 'Enter a valid email address'
  if (form.password.length < 6)                        errs.password = 'Password must be at least 6 characters'
  if (!form.address.trim())                            errs.address  = 'Address is required'
  return errs
}

export default function Register() {
  const { register, currentUser } = useAuth()
  const navigate      = useNavigate()
  const [form, setForm]   = useState({ name: '', phone: '', email: '', password: '', address: '', city: 'cairo' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  if (currentUser) return <Navigate to="/" replace />

  const set = k => e => { setForm({ ...form, [k]: e.target.value }); setErrors(prev => ({ ...prev, [k]: '' })) }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) { toast.error('Please fix the errors below'); return }
    setLoading(true)
    try {
      await register(form.email, form.password, { name: form.name, phone: form.phone, address: form.address, city: form.city })
      toast.success('Account created! Welcome to Melted 🎉')
      navigate('/')
    } catch (err) {
      const msgs = { 'auth/email-already-in-use': 'This email is already registered', 'auth/weak-password': 'Password is too weak' }
      toast.error(msgs[err.code] || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <SEO title="Create Account" description="Join Melted Egypt to track your orders, save wishlists and get exclusive deals on handcrafted desserts." path="/register" />
      <div className="auth-card">
        <h2>Create Account</h2>
        <p className="auth-sub">Join us and track your orders with ease</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input placeholder="Your name" value={form.name} onChange={set('name')} className={errors.name ? 'error' : ''} />
              <FieldError errors={errors} name="name" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input placeholder="01xxxxxxxxx" value={form.phone} onChange={set('phone')} className={errors.phone ? 'error' : ''} />
              <FieldError errors={errors} name="phone" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} className={errors.email ? 'error' : ''} />
            <FieldError errors={errors} name="email" />
          </div>
          <div className="form-group">
            <label className="form-label">Password *</label>
            <input type="password" placeholder="Min. 6 characters" value={form.password} onChange={set('password')} className={errors.password ? 'error' : ''} />
            <FieldError errors={errors} name="password" />
          </div>
          <div className="form-group">
            <label className="form-label">City *</label>
            <select value={form.city} onChange={set('city')}>
              <option value="cairo">Cairo</option>
              <option value="giza">Giza</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Full Address *</label>
            <input placeholder="Area, Street, Building number..." value={form.address} onChange={set('address')} className={errors.address ? 'error' : ''} />
            <FieldError errors={errors} name="address" />
          </div>
          <button type="submit" className="btn btn-primary full-width" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></div>
      </div>
    </div>
  )
}

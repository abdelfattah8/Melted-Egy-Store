import { useState } from 'react'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { auth } from '../firebase/config.jsx'
import { sendPasswordResetEmail } from 'firebase/auth'
import SEO from '../components/SEO.jsx'
import toast from 'react-hot-toast'

export default function Login() {
  const { login, currentUser } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const [form, setForm]         = useState({ email: '', password: '' })
  const [loading, setLoading]   = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const from = location.state?.from || '/'

  // Already logged in → redirect
  if (currentUser) return <Navigate to={from} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.password)
      toast.success('Welcome back! 🎉')
      navigate(from, { replace: true })
    } catch (err) {
      const msgs = {
        'auth/invalid-credential': 'Incorrect email or password',
        'auth/too-many-requests':  'Too many attempts. Please try again later',
        'auth/user-not-found':     'Account not found',
      }
      toast.error(msgs[err.code] || 'Something went wrong, please try again')
    }
    setLoading(false)
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    if (!resetEmail.trim()) { toast.error('Please enter your email'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) { toast.error('Please enter a valid email address'); return }
    setResetLoading(true)
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim())
      toast.success("We've sent a password reset link to your email. Check your inbox (and spam folder).", { duration: 6000 })
      setShowReset(false)
      setResetEmail('')
    } catch (err) {
      const msgs = {
        'auth/user-not-found':    'No account found with this email',
        'auth/invalid-email':     'Please enter a valid email address',
        'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again',
      }
      toast.error(msgs[err.code] || 'Failed to send reset email. Please try again')
    }
    setResetLoading(false)
  }

  return (
    <div className="auth-page">
      <SEO title="Sign In" description="Sign in to your Melted Egypt account to track orders and save your favourites." path="/login" />
      <div className="auth-card">

        {/* ── Forgot Password Mode ── */}
        {showReset ? (
          <>
            <h2>Reset Password 🔑</h2>
            <p className="auth-sub">Enter your email and we'll send you a reset link</p>

            <form onSubmit={handleForgotPassword}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary full-width" disabled={resetLoading}>
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="auth-footer">
              <button
                onClick={() => setShowReset(false)}
                style={{ background: 'none', border: 'none', color: 'var(--brown)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
              >
                ← Back to Sign In
              </button>
            </div>
          </>
        ) : (
          /* ── Normal Login Mode ── */
          <>
            <h2>Welcome back 👋</h2>
            <p className="auth-sub">Sign in to place orders and track your deliveries</p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
                {/* Forgot password link */}
                <button
                  type="button"
                  onClick={() => { setShowReset(true); setResetEmail(form.email) }}
                  style={{ background: 'none', border: 'none', color: 'var(--brown-light)', fontSize: 12, cursor: 'pointer', marginTop: 6, padding: 0, fontFamily: 'Poppins, sans-serif' }}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="btn btn-primary full-width" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="auth-footer">
              Don't have an account? <Link to="/register">Create one</Link>
            </div>
            <div className="auth-footer" style={{ marginTop: 8 }}>
              Or <Link to="/checkout">continue as Guest</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

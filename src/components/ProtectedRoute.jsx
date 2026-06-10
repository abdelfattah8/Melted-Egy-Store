import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { PageLoader } from './Loader.jsx'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { currentUser, userData, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!currentUser) return <Navigate to="/login" replace />
  if (adminOnly && !userData?.isAdmin) return <Navigate to="/" replace />
  return children
}

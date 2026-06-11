import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider }     from './context/AuthContext.jsx'
import { CartProvider }     from './context/CartContext.jsx'
import { WishlistProvider } from './context/WishlistContext.jsx'
import Navbar          from './components/Navbar.jsx'
import Footer          from './components/Footer.jsx'
import ProtectedRoute  from './components/ProtectedRoute.jsx'
import { PageLoader, InlineLoader } from './components/Loader.jsx'

const Home         = lazy(() => import('./pages/Home.jsx'))
const Shop         = lazy(() => import('./pages/Shop.jsx'))
const NewItems     = lazy(() => import('./pages/NewItems.jsx'))
const Offers       = lazy(() => import('./pages/Offers.jsx'))
const Wishlist     = lazy(() => import('./pages/Wishlist.jsx'))
const Checkout     = lazy(() => import('./pages/Checkout.jsx'))
const OrderSuccess = lazy(() => import('./pages/OrderSuccess.jsx'))
const Login        = lazy(() => import('./pages/Login.jsx'))
const Register     = lazy(() => import('./pages/Register.jsx'))
const Profile      = lazy(() => import('./pages/Profile.jsx'))
const MyOrders     = lazy(() => import('./pages/MyOrders.jsx'))
const NotFound     = lazy(() => import('./pages/NotFound.jsx'))
const AdminLayout    = lazy(() => import('./pages/admin/AdminLayout.jsx'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'))
const AdminProducts  = lazy(() => import('./pages/admin/AdminProducts.jsx'))
const AdminOrders    = lazy(() => import('./pages/admin/AdminOrders.jsx'))
const AdminOffers    = lazy(() => import('./pages/admin/AdminOffers.jsx'))
const AdminSettings    = lazy(() => import('./pages/admin/AdminSettings.jsx'))
const AdminPromoCodes  = lazy(() => import('./pages/admin/AdminPromoCodes.jsx'))
const AdminFlavors     = lazy(() => import('./pages/admin/AdminFlavors.jsx'))
const AdminExtras      = lazy(() => import('./pages/admin/AdminExtras.jsx'))

// Navbar and Footer are NOT inside Suspense — they render immediately and
// never unmount during page transitions, so admin link and cart state are stable.
function WithLayout({ children }) {
  return (
    <>
      <Navbar />
      <Suspense fallback={<InlineLoader />}>
        {children}
      </Suspense>
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <HelmetProvider>
      <Router>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <Toaster
                position="top-center"
                toastOptions={{
                  style: { fontFamily: 'Poppins, sans-serif', borderRadius: 12, fontSize: 14 },
                  success: { iconTheme: { primary: '#5B3121', secondary: '#F6CDD0' } },
                  duration: 3000,
                }}
              />
              <Routes>
                {/* Public */}
                <Route path="/"              element={<WithLayout><Home /></WithLayout>} />
                <Route path="/shop"          element={<WithLayout><Shop /></WithLayout>} />
                <Route path="/new-items"     element={<WithLayout><NewItems /></WithLayout>} />
                <Route path="/offers"        element={<WithLayout><Offers /></WithLayout>} />
                <Route path="/wishlist"      element={<WithLayout><Wishlist /></WithLayout>} />
                <Route path="/checkout"      element={<WithLayout><Checkout /></WithLayout>} />
                <Route path="/order-success" element={<WithLayout><OrderSuccess /></WithLayout>} />
                <Route path="/login"         element={<WithLayout><Login /></WithLayout>} />
                <Route path="/register"      element={<WithLayout><Register /></WithLayout>} />

                {/* Authenticated */}
                <Route path="/profile"   element={<ProtectedRoute><WithLayout><Profile /></WithLayout></ProtectedRoute>} />
                <Route path="/my-orders" element={<ProtectedRoute><WithLayout><MyOrders /></WithLayout></ProtectedRoute>} />

                {/* Admin — AdminLayout is lazy and has its own outlet for sub-pages */}
                <Route path="/admin" element={
                  <ProtectedRoute adminOnly>
                    <Suspense fallback={<PageLoader />}>
                      <AdminLayout />
                    </Suspense>
                  </ProtectedRoute>
                }>
                  <Route index           element={<AdminDashboard />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="orders"   element={<AdminOrders />} />
                  <Route path="offers"   element={<AdminOffers />} />
                  <Route path="settings"     element={<AdminSettings />} />
                  <Route path="promo-codes" element={<AdminPromoCodes />} />
                  <Route path="flavors"  element={<AdminFlavors />} />
                  <Route path="extras"   element={<AdminExtras />} />
                </Route>

                <Route path="*" element={<WithLayout><NotFound /></WithLayout>} />
              </Routes>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </Router>
    </HelmetProvider>
  )
}

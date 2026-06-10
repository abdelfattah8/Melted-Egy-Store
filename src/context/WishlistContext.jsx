/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react'

const WishlistContext = createContext()
export function useWishlist() { return useContext(WishlistContext) }

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('melted_wishlist') || '[]') }
    catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem('melted_wishlist', JSON.stringify(wishlist))
  }, [wishlist])

  function toggleWishlist(productId) {
    setWishlist(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    )
  }

  function isWishlisted(productId) { return wishlist.includes(productId) }
  const wishlistCount = wishlist.length

  return (
    <WishlistContext.Provider value={{ wishlist, toggleWishlist, isWishlisted, wishlistCount }}>
      {children}
    </WishlistContext.Provider>
  )
}

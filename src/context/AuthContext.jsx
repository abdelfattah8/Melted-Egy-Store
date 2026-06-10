/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '../firebase/config.jsx'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore'

const AuthContext = createContext()
export function useAuth() { return useContext(AuthContext) }

// 🔒 SECURITY: Only these fields can be updated by the user
// Prevents users from setting isAdmin:true from browser console
const ALLOWED_PROFILE_FIELDS = ['name', 'phone', 'address', 'city']

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userData,    setUserData]    = useState(null)
  const [loading,     setLoading]     = useState(true)

  async function register(email, password, info) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'users', cred.user.uid), {
      name:      info.name?.trim()    || '',
      phone:     info.phone?.trim()   || '',
      email:     email.toLowerCase(),
      address:   info.address?.trim() || '',
      city:      info.city            || 'cairo',
      isAdmin:   false,                          // always false on register
      createdAt: new Date(),
    })
    return cred
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password)
  }

  async function logout() {
    return signOut(auth)
  }

  // 🔒 SECURITY: Strip any fields not in whitelist before saving
  async function updateProfile(data) {
    if (!currentUser) return
    const safe = {}
    ALLOWED_PROFILE_FIELDS.forEach(field => {
      if (data[field] !== undefined) safe[field] = data[field]
    })
    if (Object.keys(safe).length === 0) return
    await updateDoc(doc(db, 'users', currentUser.uid), safe)
    setUserData(prev => ({ ...prev, ...safe }))
  }

  async function refreshUserData() {
    if (!currentUser) return
    const snap = await getDoc(doc(db, 'users', currentUser.uid))
    if (snap.exists()) setUserData(snap.data())
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid))
          if (snap.exists()) {
            setUserData(snap.data())
          } else {
            // Document missing — shouldn't happen post-registration, but handle gracefully
            console.warn('AuthContext: users/' + user.uid + ' document not found')
            setUserData(null)
          }
        } catch (err) {
          console.error('AuthContext: failed to load user document', err?.code, err?.message)
          setUserData(null)
        }
      } else {
        setUserData(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, register, login, logout, updateProfile, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  )
}

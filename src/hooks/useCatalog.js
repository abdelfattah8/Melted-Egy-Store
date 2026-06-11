import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config.jsx'

// Module-level cache: flavors/extras are small, rarely-changing lists read by every
// product card, so fetch each collection once per page load and share the promise.
const cache = {}

function fetchCollectionOnce(name) {
  if (!cache[name]) {
    cache[name] = getDocs(collection(db, name))
      .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
      .catch(err => {
        console.error(`Failed to load ${name}:`, err)
        cache[name] = null // allow a retry on next mount
        return []
      })
  }
  return cache[name]
}

function useCachedCollection(name) {
  const [items, setItems] = useState([])
  useEffect(() => {
    let cancelled = false
    fetchCollectionOnce(name).then(list => { if (!cancelled) setItems(list) })
    return () => { cancelled = true }
  }, [name])
  return items
}

/** All flavor docs ({ id, name, active }). Inactive flavors are NOT filtered here. */
export function useFlavors() { return useCachedCollection('flavors') }

/** All extra docs ({ id, name, price, active }). Inactive extras are NOT filtered here. */
export function useExtras() { return useCachedCollection('extras') }

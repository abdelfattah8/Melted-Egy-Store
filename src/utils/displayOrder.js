// Admin-controlled catalog ordering.
// Items carry a numeric `sortOrder` set from /admin/products (up/down arrows).
// Documents that don't have one yet (created before this feature) fall back to
// the END of the list, sorted by effective price ascending, so nothing breaks
// before the admin reorders everything once.

export const effectivePrice = p =>
  p.onSale && p.salePrice && p.salePrice < p.price ? p.salePrice : p.price

export function byDisplayOrder(a, b) {
  const aOrdered = typeof a.sortOrder === 'number'
  const bOrdered = typeof b.sortOrder === 'number'
  if (aOrdered && bOrdered) return a.sortOrder - b.sortOrder
  if (aOrdered) return -1
  if (bOrdered) return 1
  return effectivePrice(a) - effectivePrice(b)
}

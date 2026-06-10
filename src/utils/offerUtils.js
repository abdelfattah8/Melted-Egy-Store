/**
 * Compute the offer discount and effective delivery fee from the live cart.
 * This is the single source of truth — never trust a stored discountAmount.
 *
 * @param {object|null} offer
 * @param {Array}       cartItems  — items currently in the cart (each has id, price, quantity)
 * @param {number}      baseDeliveryFee
 * @returns {{ discountAmount: number, finalDeliveryFee: number, isValid: boolean }}
 */
/**
 * Normalises an offer's linked products into an array of product ids.
 * Supports the current `productIds` array and the legacy single `productId`.
 * An empty array means the offer applies to all products.
 */
export function getOfferProductIds(offer) {
  if (offer?.productIds?.length) return offer.productIds
  if (offer?.productId) return [offer.productId]
  return []
}

export function computeOfferResult(offer, cartItems, baseDeliveryFee) {
  if (!offer || cartItems.length === 0) {
    return { discountAmount: 0, finalDeliveryFee: baseDeliveryFee, isValid: false }
  }

  const offerIds = getOfferProductIds(offer)
  const qualifying = offerIds.length
    ? cartItems.filter(i => offerIds.includes(i.id))
    : cartItems

  if (offer.type === 'free_delivery') {
    return { discountAmount: 0, finalDeliveryFee: 0, isValid: true }
  }

  if (offer.type === 'custom' && offer.discountPercent) {
    if (qualifying.length === 0) return { discountAmount: 0, finalDeliveryFee: baseDeliveryFee, isValid: false }
    const base = qualifying.reduce((s, i) => s + i.price * i.quantity, 0)
    return { discountAmount: Math.round(base * offer.discountPercent / 100), finalDeliveryFee: baseDeliveryFee, isValid: true }
  }

  // Expand qualifying cart items into individual price units
  const units = qualifying.flatMap(i => Array(Math.max(0, i.quantity)).fill(i.price))

  if (offer.type === 'buy1get1') {
    if (units.length < 2) return { discountAmount: 0, finalDeliveryFee: baseDeliveryFee, isValid: false }
    // Cheapest unit is free
    return { discountAmount: Math.min(...units), finalDeliveryFee: baseDeliveryFee, isValid: true }
  }

  if (offer.type === 'buy2get1') {
    if (units.length < 3) return { discountAmount: 0, finalDeliveryFee: baseDeliveryFee, isValid: false }
    // Sort descending: customer pays for the expensive ones, cheapest in each group of 3 is free
    const sorted = [...units].sort((a, b) => b - a)
    let discountAmount = 0
    for (let i = 2; i < sorted.length; i += 3) discountAmount += sorted[i]
    return { discountAmount, finalDeliveryFee: baseDeliveryFee, isValid: true }
  }

  return { discountAmount: 0, finalDeliveryFee: baseDeliveryFee, isValid: false }
}

/**
 * Returns individual display units from qualifying cart items, sorted descending by price.
 * Used to show the "Applied Offer" breakdown in checkout — including which unit is FREE.
 * Each entry: { name, price, imageUrl }
 */
export function getOfferDisplayUnits(offer, cartItems) {
  if (!offer || (offer.type !== 'buy1get1' && offer.type !== 'buy2get1')) return []

  const offerIds = getOfferProductIds(offer)
  const qualifying = offerIds.length
    ? cartItems.filter(i => offerIds.includes(i.id))
    : cartItems

  return qualifying
    .flatMap(i => Array(Math.max(0, i.quantity)).fill({ name: i.name, price: i.price, imageUrl: i.imageUrl || null }))
    .sort((a, b) => b.price - a.price)
}

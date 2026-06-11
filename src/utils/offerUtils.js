/**
 * Compute the offer discount and effective delivery fee from the live cart.
 * This is the single source of truth — never trust a stored discountAmount.
 *
 * @param {object|null} offer
 * @param {Array}       cartItems  — items currently in the cart (each has id, price, quantity)
 * @param {number}      baseDeliveryFee
 * @returns {{ discountAmount: number, finalDeliveryFee: number, isValid: boolean, reason?: string }}
 */
/**
 * Normalises an offer's linked products into an array of product ids.
 * Supports the current `productIds` array and the legacy single `productId`.
 * An empty array means the offer applies to all products.
 * For `box_gift` offers these ids are the eligible BOX products.
 */
export function getOfferProductIds(offer) {
  if (offer?.productIds?.length) return offer.productIds
  if (offer?.productId) return [offer.productId]
  return []
}

/**
 * Eligible free-gift bite ids for a `box_gift` offer.
 * An empty array means any bite qualifies as the gift.
 */
export function getOfferGiftProductIds(offer) {
  return offer?.giftProductIds?.length ? offer.giftProductIds : []
}

/** Offer types where the customer picks specific products before applying. */
export function offerRequiresSelection(offer) {
  return offer?.type === 'buy1get1' || offer?.type === 'buy2get1' || offer?.type === 'box_gift'
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

  // Buy a box, get one bite free: the cart must hold exactly one eligible box unit and the
  // customer's chosen gift bite. Discount = that bite's current (verified) price.
  if (offer.type === 'box_gift') {
    const gift = offer.giftItem
    if (!gift?.id) return { discountAmount: 0, finalDeliveryFee: baseDeliveryFee, isValid: false, reason: 'gift_missing' }

    const boxUnits = cartItems
      .filter(i => i.type === 'box' && (offerIds.length === 0 || offerIds.includes(i.id)))
      .reduce((s, i) => s + Math.max(0, i.quantity), 0)
    if (boxUnits !== 1) return { discountAmount: 0, finalDeliveryFee: baseDeliveryFee, isValid: false, reason: 'box_count' }

    const giftIds = getOfferGiftProductIds(offer)
    if (giftIds.length && !giftIds.includes(gift.id)) {
      return { discountAmount: 0, finalDeliveryFee: baseDeliveryFee, isValid: false, reason: 'gift_missing' }
    }
    const giftLine = cartItems.find(i => i.id === gift.id && i.type !== 'box')
    if (!giftLine || giftLine.quantity < 1) {
      return { discountAmount: 0, finalDeliveryFee: baseDeliveryFee, isValid: false, reason: 'gift_missing' }
    }
    return { discountAmount: giftLine.price, finalDeliveryFee: baseDeliveryFee, isValid: true }
  }

  // BOGO offers work with bites only — boxes never qualify, neither toward the required
  // count nor as the free item. Expand the qualifying bites into individual price units.
  const units = qualifying
    .filter(i => i.type !== 'box')
    .flatMap(i => Array(Math.max(0, i.quantity)).fill(i.price))

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
 * Returns individual display units from qualifying cart items for the "Applied Offer"
 * breakdown in checkout. Each entry: { name, price, imageUrl, isFree }.
 * BOGO: units sorted descending by price, the cheapest marked free.
 * box_gift: the eligible box plus the chosen gift bite (marked free).
 */
export function getOfferDisplayUnits(offer, cartItems) {
  if (!offer) return []

  if (offer.type === 'box_gift') {
    const offerIds = getOfferProductIds(offer)
    const box = cartItems.find(i => i.type === 'box' && (offerIds.length === 0 || offerIds.includes(i.id)))
    const giftLine = offer.giftItem ? cartItems.find(i => i.id === offer.giftItem.id && i.type !== 'box') : null
    const units = []
    if (box)      units.push({ name: box.name,      price: box.price,      imageUrl: box.imageUrl || null,      isFree: false })
    if (giftLine) units.push({ name: giftLine.name, price: giftLine.price, imageUrl: giftLine.imageUrl || null, isFree: true })
    return units
  }

  if (offer.type !== 'buy1get1' && offer.type !== 'buy2get1') return []

  const offerIds = getOfferProductIds(offer)
  const qualifying = offerIds.length
    ? cartItems.filter(i => offerIds.includes(i.id))
    : cartItems

  const units = qualifying
    .filter(i => i.type !== 'box')
    .flatMap(i => Array(Math.max(0, i.quantity)).fill({ name: i.name, price: i.price, imageUrl: i.imageUrl || null, isFree: false }))
    .map(u => ({ ...u }))
    .sort((a, b) => b.price - a.price)

  // Mark the cheapest unit free (matches the buy1get1 discount; for buy2get1 it highlights one)
  if (units.length) units[units.length - 1].isFree = true
  return units
}

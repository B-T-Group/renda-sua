/**
 * Seller-group order total shown on web checkout (before service fee / tax lines added elsewhere).
 *
 * `deliveryFee` is the server's per-seller delivery quote. When the shopper picked fast delivery
 * the quote was requested with `requiresFastDelivery=true`, so the fast base ALREADY replaced the
 * normal base inside it. Never add a separate fast-delivery amount on top (it double counted
 * before), so the web total equals the server's order total.
 */
export function computeSellerOrderTotal(subtotal: number, deliveryFee: number): number {
  return subtotal + deliveryFee;
}

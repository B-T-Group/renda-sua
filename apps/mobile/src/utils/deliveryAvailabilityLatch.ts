/**
 * Sticky latch for checkout delivery availability.
 *
 * Preflight only returns `delivery_availability` when fulfillment is delivery.
 * After we auto-switch to pickup, availability becomes null — without a latch the
 * Delivery option would look selectable again even though choosing it immediately
 * snaps back to pickup.
 */
export function nextDeliveryUnavailableLatch(
  prev: boolean,
  availability: { available: boolean } | null | undefined
): boolean {
  if (availability == null) return prev;
  return availability.available === false;
}

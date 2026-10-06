/**
 * Human label for where the remainder of a deposit / pay-later order is paid.
 * Pickup orders (pay_at_pickup or pickup fulfillment) are "pay at pickup";
 * everything else on these paths is "pay at delivery".
 */
export function remainderTimingLabel(
  order: {
    payment_timing?: string | null;
    fulfillment_method?: string | null;
  },
  style: 'words' | 'hyphen' = 'words'
): string {
  const pickup =
    order.payment_timing === 'pay_at_pickup' ||
    order.fulfillment_method === 'pickup';
  const label = pickup ? 'pay at pickup' : 'pay at delivery';
  return style === 'hyphen' ? label.replace(/ /g, '-') : label;
}

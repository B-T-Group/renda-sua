/**
 * Reads an `admin_order_risk` push payload.
 *
 * Returns the order id, an empty string when the alert has no usable order
 * (open the queue instead), or `null` when the payload is for another feature.
 */
export function parseAdminOrderRiskPayload(
  data: Record<string, unknown> | undefined
): string | null {
  if (!data) return null;
  if (data.type !== 'admin_order_risk') return null;
  const raw = data.orderId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : '';
}

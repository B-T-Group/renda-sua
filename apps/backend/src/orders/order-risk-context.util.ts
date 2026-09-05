import type { OrderRiskActionContext } from './order-risk.types';

export interface OrderRiskContextRow {
  total_amount?: number | null;
  currency?: string | null;
  grace_deadline_at?: string | null;
  client?: {
    user?: { first_name?: string | null; last_name?: string | null } | null;
  } | null;
  business?: {
    name?: string | null;
    user?: { phone_number?: string | null } | null;
    referring_agent?: { user_id?: string | null } | null;
  } | null;
  business_location?: {
    name?: string | null;
    phone?: string | null;
    address?: { country?: string | null } | null;
  } | null;
  delivery_address?: { country?: string | null } | null;
}

/** Location address wins so ops is paged for the shop market, not the drop-off. */
export function shopCountryCode(
  order: Pick<OrderRiskContextRow, 'business_location' | 'delivery_address'>
): string | null {
  const raw =
    order.business_location?.address?.country ||
    order.delivery_address?.country ||
    null;
  if (!raw) return null;
  const trimmed = String(raw).trim().toUpperCase();
  return trimmed || null;
}

export function merchantPhone(
  order: Pick<OrderRiskContextRow, 'business_location' | 'business'>
): string | null {
  return (
    order.business_location?.phone ||
    order.business?.user?.phone_number ||
    null
  );
}

export function clientFullName(
  user?: { first_name?: string | null; last_name?: string | null } | null
): string | null {
  const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
  return name || null;
}

export function amountLabel(
  amount?: number | null,
  currency?: string | null
): string | null {
  if (amount === null || amount === undefined) return null;
  return `${Math.round(Number(amount))} ${currency ?? ''}`.trim();
}

export function minutesUntil(
  deadline?: string | null,
  nowMs = Date.now()
): number | null {
  if (!deadline) return null;
  const remainingMs = new Date(deadline).getTime() - nowMs;
  if (Number.isNaN(remainingMs) || remainingMs <= 0) return null;
  return Math.max(1, Math.round(remainingMs / 60000));
}

export function mapOrderRiskContext(
  order: OrderRiskContextRow,
  nowMs = Date.now()
): OrderRiskActionContext {
  return {
    businessName: order.business?.name ?? null,
    locationName: order.business_location?.name ?? null,
    merchantPhone: merchantPhone(order),
    clientName: clientFullName(order.client?.user),
    amountLabel: amountLabel(order.total_amount, order.currency),
    minutesUntilAutoDecline: minutesUntil(order.grace_deadline_at, nowMs),
    referringAgentUserId: order.business?.referring_agent?.user_id ?? null,
    shopCountryCode: shopCountryCode(order),
  };
}

import {
  ORDER_PRIMARY_ACTION_LABEL,
  orderProgressSteps,
  orderToPhaseInput,
  resolveOrderPhase,
  type OrderPhaseRole,
} from '../../../utils/orderPhase';
import type { ContactInfo } from '../shared/ContactCard';
import type { ProductListItem } from '../shared/ProductList';
import type { TimelineEntry } from '../shared/Timeline';
import { resolveProgressStep } from '../shared/ProgressIndicator';
import type {
  OrderActionDescriptor,
  OrderActionId,
  OrderLike,
  OrderMoneySummary,
  OrderViewModelContext,
} from './types';

export function personName(user?: {
  first_name?: string | null;
  last_name?: string | null;
} | null): string | null {
  if (!user) return null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return name || null;
}

export function toContact(
  user?: {
    first_name?: string | null;
    last_name?: string | null;
    phone_number?: string | null;
    email?: string | null;
  } | null,
  subtitle?: string | null
): ContactInfo | null {
  if (!user) return null;
  const name = personName(user);
  if (!name && !user.phone_number && !user.email) return null;
  return {
    name,
    phone: user.phone_number ?? null,
    email: user.email ?? null,
    subtitle: subtitle ?? null,
  };
}

export function mapItems(
  order: OrderLike,
  showPrices: boolean
): ProductListItem[] {
  return (order.order_items ?? []).map((item) => ({
    id: item.id,
    name: item.item_name || 'Item',
    quantity: item.quantity ?? 0,
    unitPrice: showPrices ? item.unit_price : null,
    totalPrice: showPrices ? item.total_price : null,
    currency: order.currency,
    notes: item.special_instructions ?? null,
    imageUrl: item.item?.item_images?.[0]?.image_url ?? null,
    preparationMinutes: item.item?.preparation_minutes ?? null,
  }));
}

export function mapTimeline(order: OrderLike): TimelineEntry[] {
  return (order.order_status_history ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map((entry) => ({
      id: entry.id,
      status: entry.status,
      notes: entry.notes ?? null,
      createdAt: entry.created_at,
      actorLabel: entry.changed_by_type ?? null,
    }));
}

export function moneySummary(order: OrderLike): OrderMoneySummary {
  const deliveryFee =
    (order.base_delivery_fee ?? 0) + (order.per_km_delivery_fee ?? 0);
  return {
    subtotal: order.subtotal,
    deliveryFee: deliveryFee || null,
    tax: order.tax_amount,
    total: order.total_amount,
    currency: order.currency,
  };
}

export function formatEta(
  order: OrderLike,
  ctx: OrderViewModelContext
): string | null {
  const raw = order.estimated_delivery_time || order.preferred_delivery_time;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return ctx.t('orders.client.etaBy', 'Estimated by {{when}}', {
    when: date.toLocaleString(ctx.locale),
  });
}

export function deliveryWindowLabel(
  order: OrderLike,
  ctx: OrderViewModelContext
): string | null {
  const windows = order.delivery_time_windows ?? [];
  const linked = order.delivery_time_window_id
    ? windows.find((w) => w.id === order.delivery_time_window_id)
    : null;
  const selected =
    linked ??
    windows.find((w) => w.is_selected || w.is_confirmed) ??
    windows[0] ??
    null;
  if (!selected) return null;
  const date =
    selected.window_date || selected.preferred_date || null;
  if (!date) return null;
  const start =
    (selected.start_time || selected.time_slot_start || '').slice(0, 5);
  const end = (selected.end_time || selected.time_slot_end || '').slice(0, 5);
  return ctx.t(
    'orders.deliveryWindow.selected',
    '{{date}} · {{start}} – {{end}}',
    { date, start, end }
  );
}

export function phaseFor(order: OrderLike, role: OrderPhaseRole) {
  return resolveOrderPhase(orderToPhaseInput(order), role);
}

export function progressFor(order: OrderLike) {
  const totalSteps = orderProgressSteps(order.fulfillment_method).length;
  return {
    activeStep: resolveProgressStep(
      order.current_status,
      order.fulfillment_method
    ),
    totalSteps,
  };
}

export function actionFromPrimary(
  id: OrderActionId,
  variant: OrderActionDescriptor['variant'] = 'contained',
  primary = true
): OrderActionDescriptor | null {
  if (id === 'none') return null;
  const labels = ORDER_PRIMARY_ACTION_LABEL[id as keyof typeof ORDER_PRIMARY_ACTION_LABEL];
  if (!labels) {
    return {
      id,
      labelKey: `orders.actions.${id}`,
      labelDefault: id.replace(/_/g, ' '),
      variant,
      primary,
    };
  }
  return {
    id,
    labelKey: labels[0],
    labelDefault: labels[1],
    variant,
    primary,
  };
}

export function isOverdue(deadlineAt: string | null | undefined, now: Date): boolean {
  if (!deadlineAt) return false;
  const d = new Date(deadlineAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= now.getTime();
}

export function friendlyStatus(
  order: OrderLike,
  role: OrderPhaseRole,
  ctx: OrderViewModelContext
): string {
  const status = order.current_status;
  const key = `orders.${role === 'agent' ? 'delivery' : role}.status.${status}`;
  const fallback = ctx.t(
    `common.orderStatus.${status}`,
    status.replace(/_/g, ' ')
  );
  return ctx.t(key, fallback);
}

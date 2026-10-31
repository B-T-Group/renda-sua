import { isOverdue } from './helpers';
import type { DeliveryOrderViewModel, OrderLike, OrderViewModelContext } from './types';

const PICKUP_URGENCY_STATUSES = new Set(['ready_for_pickup', 'assigned_to_agent']);
const DELIVER_URGENCY_STATUSES = new Set([
  'picked_up',
  'in_transit',
  'out_for_delivery',
]);

type Urgency = DeliveryOrderViewModel['urgency'];

function validTimestamp(raw?: string | null): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : raw;
}

function parseYmd(ymd: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function parseHourMinute(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function selectedDeliveryWindow(order: OrderLike) {
  const windows = order.delivery_time_windows ?? [];
  const linked = order.delivery_time_window_id
    ? windows.find((window) => window.id === order.delivery_time_window_id)
    : null;
  return (
    linked ??
    windows.find((window) => window.is_selected || window.is_confirmed) ??
    windows[0] ??
    null
  );
}

function windowEndAt(order: OrderLike): string | null {
  const selected = selectedDeliveryWindow(order);
  if (!selected) return null;
  const date = selected.window_date || selected.preferred_date;
  const end = selected.end_time || selected.time_slot_end;
  if (!date || !end) return null;
  if (end.includes('T')) return validTimestamp(end);
  const ymd = parseYmd(date);
  const time = parseHourMinute(end);
  if (!ymd || !time) return null;
  return new Date(
    ymd.year,
    ymd.month - 1,
    ymd.day,
    time.hour,
    time.minute,
    0,
    0
  ).toISOString();
}

export function pickupDeadlineAt(order: OrderLike): string | null {
  return validTimestamp(order.pickup_due_at ?? order.pickup_by);
}

export function deliverByDeadlineAt(order: OrderLike): string | null {
  if (order.fulfillment_timing === 'asap') return null;
  return (
    windowEndAt(order) ??
    validTimestamp(order.estimated_delivery_time) ??
    validTimestamp(order.promised_fulfill_by)
  );
}

export function formatUrgencyClock(deadlineAt: string, locale?: string): string {
  const date = new Date(deadlineAt);
  if (Number.isNaN(date.getTime())) return '';
  const isFrench = (locale ?? 'en').toLowerCase().startsWith('fr');
  return date.toLocaleTimeString(isFrench ? 'fr-FR' : locale || 'en', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !isFrench,
  });
}

function urgencyLine(
  deadlineAt: string,
  label: string,
  now: Date
): NonNullable<Urgency> {
  return {
    deadlineAt,
    label,
    overdue: isOverdue(deadlineAt, now),
  };
}

function labeledUrgency(
  deadlineAt: string | null,
  key: string,
  fallback: string,
  ctx: OrderViewModelContext
): Urgency {
  if (!deadlineAt) return null;
  const time = formatUrgencyClock(deadlineAt, ctx.locale);
  return urgencyLine(deadlineAt, ctx.t(key, fallback, { time }), ctx.now);
}

export function urgencyFor(
  order: OrderLike,
  ctx: OrderViewModelContext
): Urgency {
  const status = order.current_status;
  if (PICKUP_URGENCY_STATUSES.has(status)) {
    return labeledUrgency(
      pickupDeadlineAt(order),
      'orders.delivery.urgency.pickupBy',
      'Pick up by {{time}}',
      ctx
    );
  }
  if (DELIVER_URGENCY_STATUSES.has(status)) {
    return labeledUrgency(
      deliverByDeadlineAt(order),
      'orders.delivery.urgency.deliverBy',
      'Deliver by {{time}}',
      ctx
    );
  }
  return null;
}

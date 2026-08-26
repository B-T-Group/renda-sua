import type { TFunction } from 'i18next';
import type {
  AdminOrderNextAction,
  AdminOrderRiskLevel,
  OrderRiskType,
} from '../../../hooks/useAdminOrders';

export function riskTypeLabel(t: TFunction, riskType: OrderRiskType): string {
  const labels: Record<OrderRiskType, string> = {
    pending_acceptance: t(
      'admin.orders.riskLabels.pendingAcceptance',
      'Not confirmed by merchant'
    ),
    ready_unassigned: t(
      'admin.orders.riskLabels.readyUnassigned',
      'Ready with no agent'
    ),
    pickup_overdue: t(
      'admin.orders.riskLabels.pickupOverdue',
      'Agent has not picked up'
    ),
    delivery_delayed: t(
      'admin.orders.riskLabels.deliveryDelayed',
      'Delivery running late'
    ),
  };
  return labels[riskType];
}

export function severityLabel(t: TFunction, level: AdminOrderRiskLevel): string {
  if (level === 'critical') return t('admin.orders.riskLabels.critical', 'Critical');
  if (level === 'warning') return t('admin.orders.riskLabels.warning', 'Warning');
  return t('admin.orders.riskLabels.onTrack', 'On track');
}

export function severityColor(
  level: AdminOrderRiskLevel
): 'error' | 'warning' | 'success' {
  if (level === 'critical') return 'error';
  if (level === 'warning') return 'warning';
  return 'success';
}

export function nextActionLabel(
  t: TFunction,
  action: AdminOrderNextAction
): string | null {
  const labels: Record<AdminOrderNextAction, string | null> = {
    contact_business: t(
      'admin.orders.nextAction.contactBusiness',
      'Call the merchant to confirm or cancel'
    ),
    contact_agent: t(
      'admin.orders.nextAction.contactAgent',
      'Reach the agent, then redispatch if unreachable'
    ),
    redispatch: t(
      'admin.orders.nextAction.redispatch',
      'Redispatch to find an available agent'
    ),
    contact_client: t(
      'admin.orders.nextAction.contactClient',
      'Update the client on the delay'
    ),
    none: null,
  };
  return labels[action];
}

export function formatMinutes(t: TFunction, minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return t('admin.orders.duration.minutes', '{{count}} min', { count: total });
  const hours = Math.floor(total / 60);
  if (hours < 24) {
    return t('admin.orders.duration.hours', '{{hours}}h {{minutes}}min', {
      hours,
      minutes: total % 60,
    });
  }
  return t('admin.orders.duration.days', '{{days}}d {{hours}}h', {
    days: Math.floor(hours / 24),
    hours: hours % 24,
  });
}

/** "just now" / "12 min ago" style age, for columns tracking staleness. */
export function formatTimeAgo(t: TFunction, iso: string | null): string {
  if (!iso) return '—';
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return '—';
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return t('admin.orders.justNow', 'just now');
  return t('admin.orders.timeAgo', '{{duration}} ago', {
    duration: formatMinutes(t, minutes),
  });
}

export function formatAbsoluteTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export function statusColor(
  status: string
): 'error' | 'success' | 'warning' | 'primary' {
  if (status.includes('cancel') || status.includes('fail')) return 'error';
  if (status === 'delivered' || status === 'complete') return 'success';
  if (status === 'pending' || status === 'pending_payment') return 'warning';
  return 'primary';
}

export function formatOrderAmount(
  amount: number | null,
  currency: string | null
): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'XAF',
  }).format(amount);
}

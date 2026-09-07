import type { TFunction } from 'i18next';
import type {
  AdminOrderNextAction,
  AdminOrderRiskLevel,
  OrderContactRole,
  OrderRiskType,
} from '../types/adminOrders';

export function riskTypeLabel(t: TFunction, riskType: OrderRiskType): string {
  const labels: Record<OrderRiskType, string> = {
    pending_acceptance: t(
      'admin.orders.riskLabels.pendingAcceptance',
      'Not confirmed by merchant'
    ),
    prep_overdue: t(
      'admin.orders.riskLabels.prepOverdue',
      'Confirmed but not ready'
    ),
    ready_unassigned: t(
      'admin.orders.riskLabels.readyUnassigned',
      'Ready with no agent'
    ),
    pickup_uncollected: t(
      'admin.orders.riskLabels.pickupUncollected',
      'Waiting to be collected'
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

export function severityLabel(
  t: TFunction,
  level: AdminOrderRiskLevel
): string {
  if (level === 'critical')
    return t('admin.orders.riskLabels.critical', 'Critical');
  if (level === 'warning')
    return t('admin.orders.riskLabels.warning', 'Warning');
  return t('admin.orders.riskLabels.onTrack', 'On track');
}

export function contactRoleLabel(t: TFunction, role: OrderContactRole): string {
  const labels: Record<OrderContactRole, string> = {
    client: t('admin.orders.client', 'Client'),
    business: t('admin.orders.business', 'Business'),
    agent: t('admin.orders.agent', 'Agent'),
  };
  return labels[role];
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

export function formatOverdue(t: TFunction, minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60)
    return t('admin.orders.duration.minutes', '{{count}} min', {
      count: total,
    });
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

export function statusText(status: string): string {
  return status.replace(/_/g, ' ');
}

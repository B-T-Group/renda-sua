import type { OrderContactRole } from '../hooks/useAdminOrders';

export type EscalationReplyId =
  | 'business_confirm'
  | 'business_window'
  | 'business_support'
  | 'client_patience'
  | 'client_followup'
  | 'client_processing';

export interface EscalationReplyTemplate {
  id: EscalationReplyId;
  labelKey: string;
  bodyKey: string;
  labelDefault: string;
  bodyDefault: string;
}

const BUSINESS_REPLIES: EscalationReplyTemplate[] = [
  {
    id: 'business_confirm',
    labelKey: 'admin.orders.escalationReplies.business.confirm.label',
    bodyKey: 'admin.orders.escalationReplies.business.confirm.body',
    labelDefault: 'Confirm order',
    bodyDefault:
      "We've noticed you have a pending order. Please confirm it in the app soon to protect your store reputation and avoid cancellation.",
  },
  {
    id: 'business_window',
    labelKey: 'admin.orders.escalationReplies.business.window.label',
    bodyKey: 'admin.orders.escalationReplies.business.window.body',
    labelDefault: 'Window ending',
    bodyDefault:
      'Your confirmation window is almost up. Please respond now, or this order may be cancelled and the customer refunded.',
  },
  {
    id: 'business_support',
    labelKey: 'admin.orders.escalationReplies.business.support.label',
    bodyKey: 'admin.orders.escalationReplies.business.support.body',
    labelDefault: 'Support check-in',
    bodyDefault:
      'Rendasua support is checking in on this order. Please confirm or decline so we can help your customer.',
  },
];

const CLIENT_REPLIES: EscalationReplyTemplate[] = [
  {
    id: 'client_patience',
    labelKey: 'admin.orders.escalationReplies.client.patience.label',
    bodyKey: 'admin.orders.escalationReplies.client.patience.body',
    labelDefault: "We're on it",
    bodyDefault:
      "We're contacting the store about your order and will update you shortly. Thanks for your patience.",
  },
  {
    id: 'client_followup',
    labelKey: 'admin.orders.escalationReplies.client.followup.label',
    bodyKey: 'admin.orders.escalationReplies.client.followup.body',
    labelDefault: 'Following up',
    bodyDefault:
      'Sorry for the delay — our team is following up with the merchant on your order right now.',
  },
  {
    id: 'client_processing',
    labelKey: 'admin.orders.escalationReplies.client.processing.label',
    bodyKey: 'admin.orders.escalationReplies.client.processing.body',
    labelDefault: 'Still processing',
    bodyDefault:
      "Your order is still being processed. We'll notify you as soon as the store confirms.",
  },
];

/** Escalation quick replies for admin Order intervention contact. Agent: none. */
export function escalationRepliesForRole(
  role: OrderContactRole
): EscalationReplyTemplate[] {
  if (role === 'business') return BUSINESS_REPLIES;
  if (role === 'client') return CLIENT_REPLIES;
  return [];
}

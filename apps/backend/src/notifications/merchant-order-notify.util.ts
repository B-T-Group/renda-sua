import type { EmailLocale } from './email-template-data';
import {
  smsBusinessOrderCreated,
  smsBusinessOrderReminder,
} from './order-notification-sms.messages';

/** Prefer interactive template when Meta has approved it; else URL-only fallback. */
export function merchantOrderWhatsAppTemplateKey(
  preferActionTemplate: boolean
): 'order_action_business' | 'order_created_business' {
  return preferActionTemplate ? 'order_action_business' : 'order_created_business';
}

export function merchantOrderCreatedSmsBody(params: {
  orderNumber: string;
  locale: EmailLocale;
  acceptanceTimeoutSeconds?: number | null;
}): string {
  const mins =
    typeof params.acceptanceTimeoutSeconds === 'number' &&
    params.acceptanceTimeoutSeconds > 0
      ? Math.round(params.acceptanceTimeoutSeconds / 60)
      : null;
  return smsBusinessOrderCreated(params.orderNumber, params.locale, mins);
}

export function merchantOrderReminderSmsBody(params: {
  orderNumber: string;
  locale: EmailLocale;
  remainingSeconds?: number | null;
}): string {
  const mins =
    typeof params.remainingSeconds === 'number' && params.remainingSeconds > 0
      ? Math.max(1, Math.round(params.remainingSeconds / 60))
      : null;
  return smsBusinessOrderReminder(params.orderNumber, params.locale, mins);
}

export function normalizeAlertPhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/^\+/, '').replace(/\D/g, '');
  return digits || null;
}

/** Skip another order-created WhatsApp when one was sent this recently. */
export const MERCHANT_ORDER_WHATSAPP_BURST_MS = 10 * 60 * 1000;

/** One multi-order reminder push per business per this window. */
export const ACCEPTANCE_DIGEST_BUCKET_MS = 15 * 60 * 1000;

export function merchantOrderWhatsAppBurstSince(nowMs = Date.now()): string {
  return new Date(nowMs - MERCHANT_ORDER_WHATSAPP_BURST_MS).toISOString();
}

export function acceptanceDigestDedupeKey(
  businessId: string,
  nowMs = Date.now()
): string {
  const bucket = Math.floor(nowMs / ACCEPTANCE_DIGEST_BUCKET_MS);
  return `order.acceptance.digest:${businessId}:${bucket}`;
}

export function pendingOrdersDigestPushMessage(
  count: number,
  locale: EmailLocale
): { title: string; body: string } {
  if (locale === 'fr') {
    return {
      title: 'Commandes en attente',
      body: `${count} commandes sont en attente`,
    };
  }
  return {
    title: 'Orders waiting',
    body: `${count} orders are waiting`,
  };
}

export function recentOrderWhatsAppMatch(params: {
  userId?: string | null;
  phone?: string | null;
}): Array<Record<string, unknown>> {
  const or: Array<Record<string, unknown>> = [];
  const userId = params.userId?.trim();
  const phone = normalizeAlertPhone(params.phone);
  if (userId) or.push({ user_id: { _eq: userId } });
  if (phone) or.push({ meta: { _contains: { phone } } });
  return or;
}

export function merchantPushSmsChannels(params: {
  pushEnabled: boolean;
  phone: string;
  push: {
    title: string;
    body: string;
    interruptible?: boolean;
    data: Record<string, string | undefined>;
  };
  smsBody: string;
}): {
  push?: {
    title: string;
    body: string;
    interruptible?: boolean;
    data: Record<string, string | undefined>;
  };
  sms?: { to: string; body: string };
} {
  const phone = normalizeAlertPhone(params.phone);
  return {
    ...(params.pushEnabled
      ? {
          push: {
            title: params.push.title,
            body: params.push.body,
            interruptible: params.push.interruptible,
            data: params.push.data,
          },
        }
      : {}),
    ...(phone
      ? {
          sms: {
            to: phone.startsWith('+') ? phone : `+${phone}`,
            body: params.smsBody,
          },
        }
      : {}),
  };
}

export function phonesEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeAlertPhone(a);
  const nb = normalizeAlertPhone(b);
  return !!na && !!nb && na === nb;
}

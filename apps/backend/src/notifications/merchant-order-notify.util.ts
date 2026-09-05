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

export function phonesEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeAlertPhone(a);
  const nb = normalizeAlertPhone(b);
  return !!na && !!nb && na === nb;
}

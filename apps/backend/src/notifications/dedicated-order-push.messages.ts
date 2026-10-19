import { dedicatedSlotLabel } from './dedicated-agent-push.messages';
import { normalizeLanguage } from './email-template-data';

/** #594 PR 5 in-app message types (seeded by 20261018200000_dedicated_dispatch_notice_types). */
export const DEDICATED_ORDER_MESSAGE_TYPES = {
  autoAssigned: 'DEDICATED_ORDER_AUTO_ASSIGNED',
  confirmReminder: 'DEDICATED_COVERAGE_CONFIRM_REMINDER',
} as const;

/** Agent: the dispatch gate assigned this order to them as the slot's only eligible internal agent. */
export function buildDedicatedAutoAssignedMessage(params: {
  orderNumber: string;
  storeName: string;
  slotKey: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const slot = dedicatedSlotLabel(params.slotKey, locale);
  if (locale === 'fr') {
    return {
      title: 'Livraison attribuée',
      body: `Commande ${params.orderNumber} de ${params.storeName} (${slot}) vous est attribuée comme livreur dédié`,
    };
  }
  return {
    title: 'Delivery assigned',
    body: `Order ${params.orderNumber} from ${params.storeName} (${slot}) is assigned to you as its dedicated agent`,
  };
}

/** Agent: dedicated offer push (the offer screen shows the details and the countdown). */
export function buildDedicatedOfferMessage(params: {
  storeName: string;
  slotKey: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const slot = dedicatedSlotLabel(params.slotKey, locale);
  if (locale === 'fr') {
    return {
      title: 'Livraison dédiée disponible',
      body: `Retrait : ${params.storeName} (${slot}) - Touchez pour répondre`,
    };
  }
  return {
    title: 'Dedicated delivery available',
    body: `Pickup: ${params.storeName} (${slot}) - Tap to respond`,
  };
}

/** Business: confirm the window of an order placed on dedicated coverage, or it dispatches under today's rules. */
export function buildDedicatedConfirmReminderMessage(params: {
  orderNumber: string;
  slotKey: string;
  date: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const slot = dedicatedSlotLabel(params.slotKey, locale);
  if (locale === 'fr') {
    return {
      title: 'Confirmez le créneau de livraison',
      body: `Commande ${params.orderNumber} : un livreur dédié couvre ${slot} le ${params.date}. Confirmez le créneau pour qu'il soit envoyé.`,
    };
  }
  return {
    title: 'Confirm the delivery window',
    body: `Order ${params.orderNumber}: a dedicated agent covers ${slot} on ${params.date}. Confirm the window so they are sent.`,
  };
}

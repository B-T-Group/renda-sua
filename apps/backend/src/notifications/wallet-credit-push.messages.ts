import { normalizeLanguage, type EmailLocale } from './email-template-data';

export type WalletCreditCommissionType =
  | 'base_delivery_fee'
  | 'per_km_delivery_fee'
  | 'item_sale'
  | 'order_subtotal';

function formatAmount(amount: number, currency: string, locale: EmailLocale): string {
  try {
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function sourceLabel(
  locale: EmailLocale,
  commissionType: WalletCreditCommissionType
): string {
  const en: Record<WalletCreditCommissionType, string> = {
    order_subtotal: 'sale',
    item_sale: 'sale commission',
    base_delivery_fee: 'delivery',
    per_km_delivery_fee: 'distance delivery',
  };
  const fr: Record<WalletCreditCommissionType, string> = {
    order_subtotal: 'vente',
    item_sale: 'commission sur vente',
    base_delivery_fee: 'livraison',
    per_km_delivery_fee: 'livraison (distance)',
  };
  return locale === 'fr' ? fr[commissionType] : en[commissionType];
}

export function buildWalletCreditPushMessage(params: {
  amount: number;
  currency: string;
  commissionType: WalletCreditCommissionType;
  orderNumber: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const formatted = formatAmount(params.amount, params.currency, locale);
  const source = sourceLabel(locale, params.commissionType);
  const orderRef = params.orderNumber;

  if (locale === 'fr') {
    return {
      title: 'Crédit reçu',
      body: `+${formatted} — ${source} (commande ${orderRef})`,
    };
  }
  return {
    title: 'Funds received',
    body: `+${formatted} — ${source} (order ${orderRef})`,
  };
}

export function buildNewOrderMessagePushMessage(params: {
  orderNumber: string;
  senderName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const sender =
    params.senderName?.trim() || (locale === 'fr' ? 'Quelqu’un' : 'Someone');
  if (locale === 'fr') {
    return {
      title: `Nouveau message · Commande ${params.orderNumber}`,
      body: `${sender} vous a envoyé un message`,
    };
  }
  return {
    title: `New message · Order ${params.orderNumber}`,
    body: `${sender} sent you a message`,
  };
}

export function buildNewRentalBookingMessagePushMessage(params: {
  bookingNumber: string;
  senderName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const sender =
    params.senderName?.trim() || (locale === 'fr' ? 'Quelqu’un' : 'Someone');
  const ref = params.bookingNumber?.trim() || '';
  if (locale === 'fr') {
    return {
      title: ref
        ? `Nouveau message · Location ${ref}`
        : 'Nouveau message · Location',
      body: `${sender} vous a envoyé un message`,
    };
  }
  return {
    title: ref
      ? `New message · Rental ${ref}`
      : 'New message · Rental',
    body: `${sender} sent you a message`,
  };
}

export function buildBusinessOrderCreatedPushMessage(params: {
  orderNumber: string;
  clientName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const client = params.clientName?.trim() || (locale === 'fr' ? 'un client' : 'a customer');
  if (locale === 'fr') {
    return {
      title: 'Nouvelle commande',
      body: `Commande ${params.orderNumber} de ${client}`,
    };
  }
  return {
    title: 'New order',
    body: `Order ${params.orderNumber} from ${client}`,
  };
}

export function buildMentionPushMessage(params: {
  orderNumber: string;
  senderName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const sender =
    params.senderName?.trim() || (locale === 'fr' ? "Quelqu'un" : 'Someone');
  if (locale === 'fr') {
    return {
      title: `Vous avez été mentionné · Commande ${params.orderNumber}`,
      body: `${sender} vous a mentionné dans la commande ${params.orderNumber}`,
    };
  }
  return {
    title: `You were mentioned · Order ${params.orderNumber}`,
    body: `${sender} mentioned you in Order ${params.orderNumber}`,
  };
}

export function buildDeliveryPinSharedPushMessage(params: {
  orderNumber: string;
  senderName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const sender =
    params.senderName?.trim() || (locale === 'fr' ? 'Le client' : 'The client');
  if (locale === 'fr') {
    return {
      title: 'Code PIN de livraison partagé',
      body: `${sender} a partagé le code PIN de livraison pour la commande ${params.orderNumber}`,
    };
  }
  return {
    title: 'Delivery PIN shared',
    body: `${sender} shared the delivery PIN for order ${params.orderNumber}`,
  };
}

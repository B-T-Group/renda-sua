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

export function buildRentalStartPinSharedPushMessage(params: {
  bookingNumber: string;
  senderName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const sender =
    params.senderName?.trim() || (locale === 'fr' ? 'le client' : 'the client');
  const ref = params.bookingNumber?.trim() || '';
  if (locale === 'fr') {
    return {
      title: ref ? `Code PIN · Location ${ref}` : 'Code PIN · Location',
      body: `${sender} a partagé le code PIN de démarrage`,
    };
  }
  return {
    title: ref ? `Start PIN · Rental ${ref}` : 'Start PIN · Rental',
    body: `${sender} shared the rental start PIN`,
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
  fulfillmentMethod?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const sender =
    params.senderName?.trim() || (locale === 'fr' ? 'Le client' : 'The client');
  const isPickup = params.fulfillmentMethod === 'pickup';
  if (locale === 'fr') {
    return isPickup
      ? {
          title: 'Code PIN de retrait partagé',
          body: `${sender} a partagé le code PIN de retrait pour la commande ${params.orderNumber}`,
        }
      : {
          title: 'Code PIN de livraison partagé',
          body: `${sender} a partagé le code PIN de livraison pour la commande ${params.orderNumber}`,
        };
  }
  return isPickup
    ? {
        title: 'Pickup PIN shared',
        body: `${sender} shared the pickup PIN for order ${params.orderNumber}`,
      }
    : {
        title: 'Delivery PIN shared',
        body: `${sender} shared the delivery PIN for order ${params.orderNumber}`,
      };
}

export function buildStockAvailabilityCheckPushMessage(params: {
  itemName: string;
  clientName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const item = params.itemName?.trim() || (locale === 'fr' ? 'un article' : 'an item');
  const client =
    params.clientName?.trim() || (locale === 'fr' ? 'Un client' : 'A shopper');
  if (locale === 'fr') {
    return {
      title: 'Vérifier la disponibilité',
      body: `${client} demande si « ${item} » est encore disponible`,
    };
  }
  return {
    title: 'Check stock availability',
    body: `${client} wants to know if “${item}” is still available`,
  };
}

export function buildStockAvailabilityResultPushMessage(params: {
  itemName: string;
  status: 'confirmed' | 'adjusted' | 'unavailable';
  quantity?: number;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const locale = normalizeLanguage(params.preferredLanguage);
  const item = params.itemName?.trim() || (locale === 'fr' ? 'cet article' : 'this item');
  if (locale === 'fr') {
    if (params.status === 'unavailable') {
      return {
        title: 'Indisponible',
        body: `Le magasin a indiqué que « ${item} » n’est plus disponible`,
      };
    }
    if (params.status === 'adjusted' && params.quantity != null) {
      return {
        title: 'Stock mis à jour',
        body: `« ${item} » est disponible — ${params.quantity} en stock`,
      };
    }
    return {
      title: 'Toujours disponible',
      body: `Le magasin a confirmé que « ${item} » est encore disponible`,
    };
  }
  if (params.status === 'unavailable') {
    return {
      title: 'Not available',
      body: `The store said “${item}” is no longer available`,
    };
  }
  if (params.status === 'adjusted' && params.quantity != null) {
    return {
      title: 'Stock updated',
      body: `“${item}” is available — ${params.quantity} in stock`,
    };
  }
  return {
    title: 'Still available',
    body: `The store confirmed “${item}” is still available`,
  };
}

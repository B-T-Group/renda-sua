import type { NotificationData } from './notification-types';

export type EmailLocale = 'en' | 'fr';

export function normalizeLanguage(lang?: string | null): EmailLocale {
  if (!lang?.trim()) return 'fr';
  return lang.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function labels(locale: EmailLocale) {
  return locale === 'fr'
    ? {
        est: 'Livraison estimée :',
        spec: 'Instructions spéciales :',
        notes: 'Raison :',
        agent: 'Agent de livraison :',
      }
    : {
        est: 'Estimated Delivery:',
        spec: 'Special Instructions:',
        notes: 'Reason:',
        agent: 'Delivery Agent:',
      };
}

export function buildEstimatedDeliverySection(
  value: string | undefined,
  locale: EmailLocale
): string {
  if (!value?.trim()) return '';
  const L = labels(locale);
  return `<p><strong>${L.est}</strong> ${esc(value)}</p>`;
}

export function buildSpecialInstructionsSection(
  value: string | undefined,
  locale: EmailLocale
): string {
  if (!value?.trim()) return '';
  const L = labels(locale);
  return `<p><strong>${L.spec}</strong> ${esc(value)}</p>`;
}

export function buildNotesSection(
  value: string | undefined,
  locale: EmailLocale
): string {
  if (!value?.trim()) return '';
  const L = labels(locale);
  return `<p><strong>${L.notes}</strong> ${esc(value)}</p>`;
}

export function buildAgentNameSection(
  agentName: string | undefined,
  locale: EmailLocale
): string {
  if (!agentName?.trim()) return '';
  const L = labels(locale);
  return `<p><strong>${L.agent}</strong> ${esc(agentName)}</p>`;
}

export function buildBusinessLocationSection(
  name: string | undefined,
  locale: EmailLocale
): string {
  const n = name?.trim();
  if (!n) return '';
  const label = locale === 'fr' ? 'Lieu' : 'Location';
  return `<p><strong>${label} :</strong> ${esc(n)}</p>`;
}

export function buildOrderItemsHtml(
  items: NotificationData['orderItems'],
  currency: string,
  variant: 'default' | 'agentAssigned'
): string {
  if (!items?.length) return '';
  const cur = esc(currency);
  return items
    .map((item) => {
      const name = esc(item.name || '');
      const qty = item.quantity;
      const price = item.totalPrice;
      if (variant === 'agentAssigned') {
        return `<div style="padding: 5px 0; border-bottom: 1px solid #eee"><strong>${name}</strong> - Qty: ${qty} - ${cur} ${price}</div>`;
      }
      return `<div class="item-row"><span>${name} (Qty: ${qty})</span><span>${cur} ${price}</span></div>`;
    })
    .join('');
}

export function buildProximityVariables(
  agentName: string,
  orderData: {
    orderId: string;
    orderNumber: string;
    businessName: string;
    businessAddress: string;
  },
  message: string
): Record<string, string | number> {
  return {
    recipientName: esc(agentName),
    orderNumber: esc(orderData.orderNumber),
    orderId: esc(orderData.orderId),
    businessName: esc(orderData.businessName),
    businessAddress: esc(orderData.businessAddress),
    message: esc(message),
    currentYear: new Date().getFullYear(),
  };
}

export function buildResendTemplateVariables(
  data: NotificationData,
  userType: string,
  locale: EmailLocale,
  options?: { orderItemsVariant?: 'default' | 'agentAssigned' }
): Record<string, string | number> {
  const variant = options?.orderItemsVariant ?? 'default';
  const cur = data.currency || 'USD';
  const htmlBlocks: Record<string, string> = {
    ORDER_ITEMS_HTML: buildOrderItemsHtml(data.orderItems || [], cur, variant),
    ESTIMATED_DELIVERY_SECTION_HTML: buildEstimatedDeliverySection(
      data.estimatedDeliveryTime,
      locale
    ),
    SPECIAL_INSTRUCTIONS_SECTION_HTML: buildSpecialInstructionsSection(
      data.specialInstructions,
      locale
    ),
    NOTES_SECTION_HTML: buildNotesSection(data.notes, locale),
    AGENT_NAME_SECTION_HTML: buildAgentNameSection(data.agentName, locale),
    BUSINESS_LOCATION_SECTION_HTML:
      userType === 'client'
        ? buildBusinessLocationSection(data.businessLocationName, locale)
        : '',
  };
  const estRaw = data.estimatedDeliveryTime;
  const est =
    estRaw !== null &&
    estRaw !== undefined &&
    String(estRaw).trim() !== ''
      ? esc(String(estRaw).trim())
      : '';

  const businessVerified =
    typeof data.businessVerified === 'boolean'
      ? String(data.businessVerified)
      : '';

  const base: Record<string, string | number> = {
    orderId: esc(data.orderId || 'Unknown'),
    orderNumber: esc(data.orderNumber || 'Unknown'),
    orderStatus: esc(data.orderStatus || 'Unknown'),
    subtotal: data.subtotal || 0,
    deliveryFee: data.deliveryFee || 0,
    taxAmount: data.taxAmount || 0,
    totalAmount: data.totalAmount || 0,
    currency: esc(cur),
    deliveryAddress: esc(data.deliveryAddress || 'Unknown Address'),
    specialInstructions: data.specialInstructions?.trim()
      ? esc(data.specialInstructions.trim())
      : '',
    notes: data.notes?.trim() ? esc(data.notes.trim()) : '',
    estimatedDeliveryTime: est,
    deliveryTimeWindow: est,
    businessVerified,
    currentYear: new Date().getFullYear(),
    ...htmlBlocks,
  };

  switch (userType) {
    case 'client':
      return {
        ...base,
        recipientName: esc(data.clientName || ''),
        businessName: esc(data.businessName || ''),
        agentName: esc(data.agentName || 'Delivery Agent'),
      };
    case 'business':
      return {
        ...base,
        recipientName: esc(data.businessName || ''),
        clientName: esc(data.clientName || ''),
        agentName: esc(data.agentName || 'Delivery Agent'),
      };
    case 'agent':
      return {
        ...base,
        recipientName: esc(data.agentName || ''),
        clientName: esc(data.clientName || ''),
        businessName: esc(data.businessName || ''),
      };
    default:
      return base;
  }
}

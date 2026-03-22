import type { NotificationData } from './notification-types';

export type EmailLocale = 'en' | 'fr';

export function normalizeLanguage(lang?: string | null): EmailLocale {
  if (!lang?.trim()) return 'fr';
  return lang.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function emptyToNull(s: string): string | null {
  return s.trim() === '' ? null : s;
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
): Record<string, string | number | null> {
  const variant = options?.orderItemsVariant ?? 'default';
  const cur = data.currency || 'USD';
  const htmlBlocks = {
    ORDER_ITEMS_HTML: emptyToNull(
      buildOrderItemsHtml(data.orderItems || [], cur, variant)
    ),
    ESTIMATED_DELIVERY_SECTION_HTML: emptyToNull(
      buildEstimatedDeliverySection(data.estimatedDeliveryTime, locale)
    ),
    SPECIAL_INSTRUCTIONS_SECTION_HTML: emptyToNull(
      buildSpecialInstructionsSection(data.specialInstructions, locale)
    ),
    NOTES_SECTION_HTML: emptyToNull(buildNotesSection(data.notes, locale)),
    AGENT_NAME_SECTION_HTML: emptyToNull(
      buildAgentNameSection(data.agentName, locale)
    ),
  };
  const estRaw = data.estimatedDeliveryTime;
  const est =
    estRaw !== null &&
    estRaw !== undefined &&
    String(estRaw).trim() !== ''
      ? esc(String(estRaw).trim())
      : null;

  const businessVerified =
    typeof data.businessVerified === 'boolean'
      ? String(data.businessVerified)
      : null;

  const base: Record<string, string | number | null> = {
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
      : null,
    notes: data.notes?.trim() ? esc(data.notes.trim()) : null,
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

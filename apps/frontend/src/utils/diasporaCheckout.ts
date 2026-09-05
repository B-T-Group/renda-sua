/** Indicative payer-currency total returned by checkout preflight. */
export interface PayerChargeEstimate {
  currency: string;
  amount: number;
  rate: number;
  source: string;
}

/** Payer-vs-recipient context returned by `POST /orders/checkout/preflight`. */
export interface CheckoutDiaspora {
  is_diaspora: boolean;
  payer_country?: string | null;
  fulfillment_country?: string | null;
  rail_source: 'seller' | 'payer';
  payer_charge_estimate?: PayerChargeEstimate | null;
  requires_recipient_contact: boolean;
}

/** Recipient details collected at checkout when buying for someone else. */
export interface RecipientDraft {
  name: string;
  phone: string;
  notifyWhatsapp: boolean;
  recipient_id?: string;
}

export const EMPTY_RECIPIENT_DRAFT: RecipientDraft = {
  name: '',
  phone: '',
  notifyWhatsapp: false,
};

/**
 * True when the payer is billing from a different country than the one the
 * order is delivered to. Drives the "Paying from X · Delivering to Y" chips.
 */
export function isCrossBorderCheckout(
  diaspora?: CheckoutDiaspora | null
): boolean {
  if (!diaspora) return false;
  if (diaspora.is_diaspora) return true;
  return Boolean(
    diaspora.payer_country &&
      diaspora.fulfillment_country &&
      diaspora.payer_country !== diaspora.fulfillment_country
  );
}

/** True when name and phone still need to be filled in before paying. */
export function isRecipientDraftIncomplete(params: {
  sendingToSomeoneElse: boolean;
  recipient: RecipientDraft;
}): boolean {
  if (!params.sendingToSomeoneElse) return false;
  return !params.recipient.name.trim() || !params.recipient.phone.trim();
}

/** Recipient payload for the checkout APIs, or undefined when self-ordering. */
export function buildRecipientPayload(params: {
  sendingToSomeoneElse: boolean;
  recipient: RecipientDraft;
}):
  | { name: string; phone: string; notify_whatsapp: boolean; recipient_id?: string }
  | undefined {
  if (!params.sendingToSomeoneElse) return undefined;
  const name = params.recipient.name.trim();
  const phone = params.recipient.phone.trim();
  if (!name || !phone) return undefined;
  return {
    name,
    phone,
    notify_whatsapp: params.recipient.notifyWhatsapp,
    ...(params.recipient.recipient_id && { recipient_id: params.recipient.recipient_id }),
  };
}

/**
 * Formats the payer-facing estimate. Returns null when the backend has no rate,
 * so the UI shows nothing rather than an invented number.
 */
export function formatPayerChargeEstimate(
  estimate: PayerChargeEstimate | null | undefined,
  locale = 'en'
): string | null {
  if (!estimate || !(estimate.amount > 0)) return null;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: estimate.currency,
    }).format(estimate.amount);
  } catch {
    return `${estimate.amount.toFixed(2)} ${estimate.currency}`;
  }
}

/** Country code as shown in the banner, falling back to a readable dash. */
export function displayCountry(code?: string | null): string {
  const trimmed = code?.trim().toUpperCase();
  return trimmed && trimmed.length === 2 ? trimmed : '—';
}

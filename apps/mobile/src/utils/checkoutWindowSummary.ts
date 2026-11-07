import { formatCheckoutEtaRange } from './deliveryWindowUtils';

/** The time card is on screen only when delivery or pickup has a country and region. */
export function checkoutWindowSectionVisible(input: {
  confirmed: boolean;
  fulfillment: string;
  country?: string | null;
  state?: string | null;
}): boolean {
  if (!input.confirmed) return false;
  if (input.fulfillment !== 'delivery' && input.fulfillment !== 'pickup') return false;
  return Boolean(input.country?.trim() && input.state?.trim());
}

export function checkoutEtaLine(
  readyAt: string | null | undefined,
  fulfillBy: string | null | undefined,
  formatEta: (eta: string) => string
): string | null {
  const eta = formatCheckoutEtaRange(readyAt, fulfillBy);
  return eta ? formatEta(eta) : null;
}

export interface CheckoutWindowStickyTextInput {
  /** A slot is required and none is selected yet. */
  needsChoice: boolean;
  /** Human label for a chosen slot. Null means as soon as possible. */
  windowLabel: string | null;
  asapTitle: string;
  /** Already translated, e.g. "Usually ready Fri 10:07 AM–Fri 10:37 AM". */
  etaLine: string | null;
  missingLabel: string;
}

/** One line for the checkout sticky bar. The picker itself stays in the scroll. */
export function checkoutWindowStickyText(input: CheckoutWindowStickyTextInput): string {
  if (input.needsChoice) return input.missingLabel;
  if (input.windowLabel) return input.windowLabel;
  if (input.etaLine) return `${input.asapTitle} · ${input.etaLine}`;
  return input.asapTitle;
}

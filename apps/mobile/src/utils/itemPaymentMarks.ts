export type PaymentRail = 'mobile_money' | 'stripe';

export type PaymentMark = 'cm' | 'airtel' | 'moov' | 'card' | 'generic';

const STRIPE_COUNTRIES = new Set(['CA', 'US', 'PH']);

const MARK_ORDER: PaymentMark[] = ['cm', 'airtel', 'moov', 'card'];

/** Logos for the item's country. Card rails always show a card. */
export function itemPaymentMarks(params: {
  method: PaymentRail;
  countryIsos?: Array<string | null | undefined>;
}): PaymentMark[] {
  if (params.method === 'stripe') return ['card'];
  const marks = new Set<PaymentMark>();
  for (const raw of params.countryIsos ?? []) {
    collectCountryMarks(raw, marks);
  }
  const ordered = MARK_ORDER.filter((mark) => marks.has(mark));
  return ordered.length > 0 ? ordered : ['generic'];
}

function collectCountryMarks(
  raw: string | null | undefined,
  marks: Set<PaymentMark>
): void {
  const code = raw?.trim().toUpperCase();
  if (code === 'CM') {
    marks.add('cm');
    return;
  }
  if (code === 'GA') {
    marks.add('airtel');
    marks.add('moov');
    return;
  }
  if (code && STRIPE_COUNTRIES.has(code)) marks.add('card');
}

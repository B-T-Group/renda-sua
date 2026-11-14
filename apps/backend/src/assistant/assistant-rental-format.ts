const NBSP = '\u00A0';

export function formatRentalAmount(amount: number, currency: string, locale: 'en' | 'fr' = 'en'): string {
  if ((currency || '').toUpperCase() === 'CAD') return formatCadAmount(amount, locale);
  const rounded = Math.round(Number(amount) || 0);
  const groups = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const code = currency === 'XAF' || currency === 'XOF' ? 'FCFA' : currency;
  return `${groups}${NBSP}${code}`;
}

function formatCadAmount(amount: number, locale: 'en' | 'fr'): string {
  const tag = locale === 'fr' ? 'fr-CA' : 'en-CA';
  return new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function perDayPriceLabel(amount: number, currency: string, locale: 'en' | 'fr'): string {
  const money = formatRentalAmount(amount, currency, locale);
  return locale === 'fr' ? `${money}/jour` : `${money}/day`;
}

export function estimatedPeriodLabel(
  amount: number,
  currency: string,
  dayCount: number,
  locale: 'en' | 'fr'
): string {
  const money = formatRentalAmount(amount, currency, locale);
  if (locale === 'fr') {
    const unit = dayCount === 1 ? 'jour' : 'jours';
    return `Env. ${money} · ${dayCount} ${unit}`;
  }
  const unit = dayCount === 1 ? 'day' : 'days';
  return `Est. ${money} · ${dayCount} ${unit}`;
}

const CODES = new Set([
  'RENTAL_INSPECTION_STRIPE_WINDOW',
  'RENTAL_STRIPE_BOOKING_WINDOW_EXCEEDED',
]);

export function isCardWindowCode(code: unknown): boolean {
  return typeof code === 'string' && CODES.has(code);
}

/** Friendly EN/FR sentence. Never the raw authorization message. */
export function friendlyCardWindowCopy(input: {
  code: unknown;
  latestCardEndAt: string | null;
  timezone: string;
  locale: string;
}): string | null {
  if (!isCardWindowCode(input.code) || !input.latestCardEndAt) return null;
  const cutoff = formatCardCutoff(input.latestCardEndAt, input.timezone, input.locale);
  if (input.locale.toLowerCase().startsWith('fr')) {
    return `Avec une carte, cette location doit se terminer le ${cutoff}. Choisissez des dates plus tôt.`;
  }
  return `With a card, this rental must end by ${cutoff}. Choose earlier dates.`;
}

export function formatCardCutoff(iso: string, timeZone: string, locale: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone }).format(date);
  const month = monthLabel(date, timeZone, locale);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date);
  return `${day} ${month} · ${time}`;
}

function monthLabel(date: Date, timeZone: string, locale: string): string {
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone }).format(date);
  return locale.toLowerCase().startsWith('fr') ? month.toLocaleLowerCase('fr') : month;
}

/** Earlier stay that ends on the card cutoff day. Does not offer a later end. */
export function suggestedCardStay(
  latestIso: string,
  timeZone: string,
  now: Date
): { start: string; end: string; dayCount: number } | null {
  const latest = new Date(latestIso);
  if (!Number.isFinite(latest.getTime()) || latest.getTime() <= now.getTime()) return null;
  const today = calendarDay(now, timeZone);
  const end = calendarDay(latest, timeZone);
  const start = addIsoDays(today, 1);
  const from = start <= end ? start : end;
  return { start: from, end, dayCount: isoDaySpan(from, end) };
}

function calendarDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return parts;
}

function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function isoDaySpan(start: string, end: string): number {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  return Math.round((to - from) / 86400000) + 1;
}

export type CardPaymentMode = 'authorize_upfront' | 'charge_at_pickup';
export type CardPaymentRail = 'stripe' | 'mobile_money';

/** Fields from listing, search, availability, and the rejection body. */
export interface CardWindowFields {
  mode?: CardPaymentMode;
  payment_rail?: CardPaymentRail;
  momo_available?: boolean;
  inspection_enabled?: boolean;
  latest_card_end_at?: string | null;
  card_auth_window_days?: number;
  stripe_review_hours?: number;
  timezone?: string;
}

const CODES = new Set(['RENTAL_INSPECTION_STRIPE_WINDOW', 'RENTAL_STRIPE_BOOKING_WINDOW_EXCEEDED']);

export function isCardWindowCode(code: unknown): boolean {
  return typeof code === 'string' && CODES.has(code);
}

/** Null when the 6-day window does not limit dates, including charge-at-pickup. */
export function effectiveCardEnd(
  fields: CardWindowFields | null | undefined,
  payingByCard: boolean,
  now = new Date()
): string | null {
  if (!fields || fields.mode === 'charge_at_pickup') return null;
  if (fields.latest_card_end_at) return fields.latest_card_end_at;
  if (!payingByCard || fields.inspection_enabled !== true) return null;
  if (fields.payment_rail !== 'mobile_money') return null;
  const days = fields.card_auth_window_days ?? 6;
  const hours = fields.stripe_review_hours ?? 72;
  return new Date(now.getTime() + days * 86400000 - hours * 3600000).toISOString();
}

/** A day is blocked when its local midnight is after the cutoff. The cutoff day stays open. */
export function cardDayBlocked(day: string, latestIso: string | null, timeZone: string): boolean {
  if (!latestIso) return false;
  const midnight = zonedMidnightUtc(day, timeZone);
  return midnight != null && midnight > Date.parse(latestIso);
}

export function cardEndMisses(endIso: string | null, latestIso: string | null): boolean {
  if (!endIso || !latestIso) return false;
  return Date.parse(endIso) > Date.parse(latestIso);
}

export function formatCardCutoff(iso: string, timeZone: string, locale: string): string {
  const date = new Date(iso);
  const french = locale.toLowerCase().startsWith('fr');
  const day = new Intl.DateTimeFormat(french ? 'fr' : 'en-GB', { day: 'numeric', timeZone }).format(date);
  const month = new Intl.DateTimeFormat(french ? 'fr' : 'en-GB', { month: 'short', timeZone }).format(date);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date);
  const label = french ? month.toLocaleLowerCase('fr') : month;
  return `${day} ${label} · ${time}`;
}

export function cardWindowNote(cutoff: string, locale: string): string {
  return locale.toLowerCase().startsWith('fr')
    ? `Avec une carte, cette location doit se terminer le ${cutoff}. Choisissez des dates plus tôt.`
    : `With a card, this rental must end by ${cutoff}. Choose earlier dates.`;
}

export function cardWindowWarning(cutoff: string, locale: string): string {
  return locale.toLowerCase().startsWith('fr')
    ? `Ces dates ne conviennent plus pour un paiement par carte. Cette location doit se terminer le ${cutoff}.`
    : `These dates no longer fit a card payment. This rental must end by ${cutoff}.`;
}

export function timezoneLine(timeZone: string, locale: string, close: string): string {
  const known = ZONE_LABELS[timeZone];
  const french = locale.toLowerCase().startsWith('fr');
  const city = known ? (french ? known.fr : known.en) : timeZone;
  const abbr = known ? ` (${known.abbr})` : '';
  return french
    ? `Heures de ${city}${abbr} · fermeture ${close}`
    : `${city} time${abbr} · closes ${close}`;
}

export function monthCells(year: number, month: number): Array<string | null> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const lead = (start.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= count; day += 1) cells.push(isoDay(year, month, day));
  return cells;
}

export function calendarDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function cardWindowErrorMessage(error: unknown, locale: string): string | null {
  const body = readErrorBody(error);
  if (!body || !isCardWindowCode(body.code)) return null;
  if (!body.latest_card_end_at || !body.timezone) return earlierCopy(locale);
  return cardWindowNote(formatCardCutoff(body.latest_card_end_at, body.timezone, locale), locale);
}

export function readErrorBody(error: unknown): CardWindowFields & { code?: string } | null {
  const record = error as {
    code?: string;
    data?: CardWindowFields & { code?: string };
    response?: { data?: CardWindowFields & { code?: string } };
  };
  const data = record?.response?.data ?? record?.data;
  if (data && typeof data === 'object') return { ...data, code: data.code ?? record.code };
  if (record?.code) return { code: record.code };
  return null;
}

function earlierCopy(locale: string): string {
  return locale.toLowerCase().startsWith('fr')
    ? 'Avec une carte, cette location doit se terminer plus tôt. Choisissez des dates plus tôt.'
    : 'With a card, this rental must end earlier. Choose earlier dates.';
}

function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function zonedMidnightUtc(day: string, timeZone: string): number | null {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return null;
  const guess = Date.UTC(year, month - 1, date);
  return guess - zoneOffsetMs(new Date(guess), timeZone);
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour'), pick('minute'), pick('second'));
  return wall - instant.getTime();
}

const ZONE_LABELS: Record<string, { en: string; fr: string; abbr: string }> = {
  'Africa/Douala': { en: 'Douala', fr: 'Douala', abbr: 'WAT' },
  'Africa/Libreville': { en: 'Libreville', fr: 'Libreville', abbr: 'WAT' },
  'Africa/Lome': { en: 'Lomé', fr: 'Lomé', abbr: 'GMT' },
  'America/Toronto': { en: 'Toronto', fr: 'Toronto', abbr: 'EST' },
  'America/New_York': { en: 'New York', fr: 'New York', abbr: 'EST' },
  'Asia/Manila': { en: 'Manila', fr: 'Manille', abbr: 'PHT' },
};

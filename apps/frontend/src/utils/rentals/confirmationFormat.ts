function french(language?: string | null): boolean {
  return (language || '').toLowerCase().startsWith('fr');
}

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((row) => row.type === type)?.value ?? '';
}

export function formatConfirmationMoney(
  amount: number,
  currency: string,
  language?: string | null
): string {
  const fr = french(language);
  const code = (currency || 'CAD').toUpperCase();
  if (code === 'XAF' || code === 'XOF') return formatFcfa(amount, fr);
  const formatted = new Intl.NumberFormat(fr ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return fr ? formatted.replace(/ (?=\$)/g, '\u00a0') : formatted;
}

function formatFcfa(amount: number, fr: boolean): string {
  const digits = Math.round(amount)
    .toLocaleString(fr ? 'fr-FR' : 'en-CA')
    .replace(/[\u00a0\u202f,]/g, '\u00a0');
  return `${digits}\u00a0FCFA`;
}

export function formatConfirmationDue(
  iso: string | null | undefined,
  timeZone: string,
  language?: string | null
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const fr = french(language);
  const parts = new Intl.DateTimeFormat(fr ? 'fr-CA' : 'en-CA', {
    timeZone: timeZone || 'UTC',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return `${part(parts, 'day')} ${shortMonth(parts, fr)} · ${part(parts, 'hour')}:${part(parts, 'minute')}`;
}

function shortMonth(parts: Intl.DateTimeFormatPart[], fr: boolean): string {
  const raw = part(parts, 'month').replace(/\.$/, '');
  return fr ? `${raw.toLowerCase()}.` : raw;
}

function spanPoint(iso: string | null | undefined, timeZone: string, language?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const fr = french(language);
  const parts = new Intl.DateTimeFormat(fr ? 'fr-CA' : 'en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const key = `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
  const text = `${part(parts, 'day')} ${shortMonth(parts, fr)} ${part(parts, 'hour')}:${part(parts, 'minute')}`;
  return { key, text };
}

/** Cross-day stay in the listing zone. Same-day windows keep the shorter period line. */
export function formatBookedSpan(
  start: string | null | undefined,
  end: string | null | undefined,
  timeZone: string,
  language?: string | null,
  zoneLabel?: string | null
): string {
  const left = spanPoint(start, timeZone, language);
  const right = spanPoint(end, timeZone, language);
  if (!left || !right || left.key === right.key) return '';
  const body = `${left.text} → ${right.text}`;
  return zoneLabel ? `${body} (${zoneLabel})` : body;
}

export function confirmationDepositHeld(paymentStatus?: string | null): boolean {
  return paymentStatus === 'authorized';
}

export function formatConfirmationStamp(
  iso: string | null | undefined,
  timeZone: string,
  language?: string | null
): string {
  return formatConfirmationDue(iso, timeZone, language);
}

const LISTING_ZONES: Record<string, { zone: string; key: string; en: string; fr: string }> = {
  CM: { zone: 'Africa/Douala', key: 'rentalInspection.confirm.zoneDouala', en: 'Douala time', fr: 'heure de Douala' },
  GA: { zone: 'Africa/Libreville', key: 'rentalInspection.confirm.zoneLibreville', en: 'Libreville time', fr: 'heure de Libreville' },
  TG: { zone: 'Africa/Lome', key: 'rentalInspection.confirm.zoneLome', en: 'Lome time', fr: 'heure de Lomé' },
  BJ: { zone: 'Africa/Porto-Novo', key: 'rentalInspection.confirm.zonePortoNovo', en: 'Porto-Novo time', fr: 'heure de Porto-Novo' },
  CI: { zone: 'Africa/Abidjan', key: 'rentalInspection.confirm.zoneAbidjan', en: 'Abidjan time', fr: "heure d'Abidjan" },
  CG: { zone: 'Africa/Brazzaville', key: 'rentalInspection.confirm.zoneBrazzaville', en: 'Brazzaville time', fr: 'heure de Brazzaville' },
  CD: { zone: 'Africa/Kinshasa', key: 'rentalInspection.confirm.zoneKinshasa', en: 'Kinshasa time', fr: 'heure de Kinshasa' },
  TD: { zone: 'Africa/Ndjamena', key: 'rentalInspection.confirm.zoneNdjamena', en: "N'Djamena time", fr: "heure de N'Djamena" },
  CF: { zone: 'Africa/Bangui', key: 'rentalInspection.confirm.zoneBangui', en: 'Bangui time', fr: 'heure de Bangui' },
  GQ: { zone: 'Africa/Malabo', key: 'rentalInspection.confirm.zoneMalabo', en: 'Malabo time', fr: 'heure de Malabo' },
  PH: { zone: 'Asia/Manila', key: 'rentalInspection.confirm.zoneManila', en: 'Manila time', fr: 'heure de Manille' },
  CA: { zone: 'America/Toronto', key: 'rentalInspection.confirm.zoneMontreal', en: 'Montréal time', fr: 'heure de Montréal' },
  US: { zone: 'America/New_York', key: 'rentalInspection.confirm.zoneNewYork', en: 'New York time', fr: 'heure de New York' },
};

function listingZone(country?: string | null, currency?: string | null) {
  const fromCountry = LISTING_ZONES[(country || '').trim().toUpperCase()];
  if (fromCountry) return fromCountry;
  const code = (currency || '').toUpperCase();
  if (code === 'XAF') return LISTING_ZONES.CM;
  if (code === 'XOF') return LISTING_ZONES.TG;
  return LISTING_ZONES.CA;
}

export function confirmationZoneKey(country?: string | null, currency?: string | null): string {
  return listingZone(country, currency).key;
}

export function confirmationZoneDefault(
  country?: string | null,
  currency?: string | null,
  language?: string | null
): string {
  const row = listingZone(country, currency);
  return (language || '').toLowerCase().startsWith('fr') ? row.fr : row.en;
}

export function confirmationTimeZone(country?: string | null, currency?: string | null): string {
  return listingZone(country, currency).zone;
}

export function rentalCalendarIcs(input: {
  title: string;
  start?: string | null;
  end?: string | null;
  location?: string | null;
}): string {
  const start = icsStamp(input.start);
  const end = icsStamp(input.end) || start;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rendasua//Rentals//EN',
    'BEGIN:VEVENT',
    start ? `DTSTART:${start}` : '',
    end ? `DTEND:${end}` : '',
    `SUMMARY:${input.title.replace(/\n/g, ' ')}`,
    input.location ? `LOCATION:${input.location.replace(/\n/g, ' ')}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.filter(Boolean).join('\r\n');
}

function icsStamp(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

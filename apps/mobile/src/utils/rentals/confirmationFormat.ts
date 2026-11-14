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
  const month = part(parts, 'month').replace(/\.$/, '');
  return `${part(parts, 'day')} ${fr ? month.toLowerCase() : month} · ${part(parts, 'hour')}:${part(parts, 'minute')}`;
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
  return code === 'XAF' || code === 'XOF' ? LISTING_ZONES.CM : LISTING_ZONES.CA;
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
  return [
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
  ]
    .filter(Boolean)
    .join('\r\n');
}

function icsStamp(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

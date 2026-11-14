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

export function formatConfirmationStamp(
  iso: string | null | undefined,
  timeZone: string,
  language?: string | null
): string {
  return formatConfirmationDue(iso, timeZone, language);
}

export function confirmationZoneKey(country?: string | null): string {
  const code = (country || '').trim().toUpperCase();
  if (code === 'CM') return 'rentalInspection.confirm.zoneDouala';
  return 'rentalInspection.confirm.zoneMontreal';
}

export function confirmationTimeZone(country?: string | null): string {
  return (country || '').trim().toUpperCase() === 'CM' ? 'Africa/Douala' : 'America/Toronto';
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

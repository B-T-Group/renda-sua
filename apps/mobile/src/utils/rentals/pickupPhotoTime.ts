const CITY_BY_ZONE: Record<string, string> = {
  'America/Toronto': 'Toronto',
  'America/New_York': 'New York',
  'Africa/Douala': 'Douala',
  'Africa/Libreville': 'Libreville',
};

export function slotTileLabel(slotKey: string, language: string): string {
  const french = language.startsWith('fr');
  if (slotKey === 'overview') return french ? "Vue d'ensemble" : 'Overview';
  if (slotKey === 'other_side') return french ? 'Autre côté' : 'Other side';
  if (slotKey === 'accessories') return french ? 'Accessoires' : 'Accessories';
  if (slotKey.startsWith('extra:')) return french ? `Supp. ${slotKey.slice(6)}` : `Extra ${slotKey.slice(6)}`;
  return slotKey;
}

export function listingCity(timeZone: string): string {
  return CITY_BY_ZONE[timeZone] ?? timeZone.split('/').pop()?.replace(/_/g, ' ') ?? timeZone;
}

export function formatListingDay(iso: string, timeZone: string, language: string): string {
  const date = new Date(iso);
  if (language.startsWith('fr')) return frenchDay(date, timeZone);
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short' }).format(date);
}

export function formatListingStamp(iso: string, timeZone: string, language: string): string {
  const date = new Date(iso);
  const day = formatListingDay(iso, timeZone, language);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${day} · ${time}`;
}

function frenchDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('fr-CA', { timeZone, day: 'numeric', month: 'short' }).formatToParts(date);
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = (parts.find((part) => part.type === 'month')?.value ?? '').replace(/\./g, '').toLocaleLowerCase('fr');
  return `${day} ${month}.`;
}

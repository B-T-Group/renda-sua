import { BOOKING_CLOCK, formatZonedDay } from './rentalStartWindow';

const CITY_BY_ZONE: Record<string, string> = {
  'America/Toronto': 'Montréal',
  'America/New_York': 'New York',
  'Africa/Douala': 'Douala',
  'Africa/Libreville': 'Libreville',
};

export function slotTileLabel(slotKey: string, language: string): string {
  const french = language.startsWith('fr');
  if (slotKey === 'overview') return french ? 'Vue d’ensemble' : 'Overview';
  if (slotKey === 'other_side') return french ? 'Autre côté' : 'Other side';
  if (slotKey === 'accessories') return french ? 'Accessoires' : 'Accessories';
  if (slotKey.startsWith('extra:')) return french ? `Supp. ${slotKey.slice(6)}` : `Extra ${slotKey.slice(6)}`;
  return slotKey;
}

export function listingCity(timeZone: string): string {
  return CITY_BY_ZONE[timeZone] ?? timeZone.split('/').pop()?.replace(/_/g, ' ') ?? timeZone;
}

/** Booking start_at is listing wall clock saved with a Z suffix. */
export function formatPickupDay(iso: string, language: string): string {
  return formatZonedDay(iso, BOOKING_CLOCK, language);
}

export function formatListingDay(iso: string, timeZone: string, language: string): string {
  const date = new Date(iso);
  if (language.startsWith('fr')) return frenchDay(date, timeZone);
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short' }).format(date);
}

export function formatListingStamp(iso: string, timeZone: string, language: string): string {
  const date = new Date(iso);
  const day = formatListingDay(iso, timeZone, language);
  // English in the Americas reads a 12-hour clock ("9:18 AM"); everywhere else 24-hour.
  const twelve = !language.startsWith('fr') && timeZone.startsWith('America/');
  const time = twelve
    ? new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(date).replace(/\u202f/g, ' ')
    : new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return `${day} · ${time}`;
}

function frenchDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('fr-CA', { timeZone, day: 'numeric', month: 'short' }).formatToParts(date);
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = (parts.find((part) => part.type === 'month')?.value ?? '').replace(/\./g, '').toLocaleLowerCase('fr');
  return `${day} ${month}.`;
}

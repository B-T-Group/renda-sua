export type PickupPhase = 'before' | 'today' | 'late' | 'closed' | 'started';

export interface PickupWindowInput {
  now: number;
  startAt: string;
  endAt: string;
  startOpensAt?: string | null;
  timeZone: string;
  started?: boolean;
}

export function pickupPhase(input: PickupWindowInput): PickupPhase {
  if (input.started) return 'started';
  const start = Date.parse(input.startAt);
  const end = Date.parse(input.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'before';
  const opens = opensAt(input);
  if (input.now < opens) return 'before';
  if (input.now >= end) return 'closed';
  if (input.now > start) return 'late';
  return 'today';
}

export function opensAt(input: PickupWindowInput): number {
  const given = input.startOpensAt ? Date.parse(input.startOpensAt) : NaN;
  if (Number.isFinite(given)) return given;
  return zonedStartOfDay(input.startAt, input.timeZone);
}

export function zonedStartOfDay(iso: string, timeZone: string): number {
  const date = new Date(iso);
  const parts = zonedParts(date, timeZone);
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day);
  const adjusted = guess - zoneOffset(new Date(guess), timeZone);
  const landed = zonedParts(new Date(adjusted), timeZone);
  if (landed.day === parts.day) return adjusted;
  return adjusted + (landed.day > parts.day ? -3600000 : 3600000);
}

export function windowStatusLabel(input: {
  phase: PickupPhase;
  photosAsked: boolean;
  day: string;
  t: (key: string, fallback: string, vars?: Record<string, string>) => string;
}): string | null {
  if (input.photosAsked) return input.t('rentals.business.photosPill', 'New photos asked');
  if (input.phase === 'closed') return null;
  if (input.phase === 'before') return input.t('rentals.start.pillDay', 'Pickup {{day}}', { day: input.day });
  if (input.phase === 'late') return input.t('rentals.start.latePickup', 'Late pickup');
  if (input.phase === 'started') return input.t('rentals.journey.inProgress', 'In progress');
  return input.t('rentals.start.pickupToday', 'Pickup today');
}

export function formatZonedDay(iso: string, timeZone: string, language: string): string {
  const parts = zonedParts(new Date(iso), timeZone);
  const month = monthName(parts.month, language);
  return `${parts.day} ${month}`;
}

export function formatZonedWeekday(iso: string, timeZone: string, language: string): string {
  const french = language.toLowerCase().startsWith('fr');
  const raw = new Intl.DateTimeFormat(french ? 'fr-CA' : 'en-GB', {
    timeZone,
    weekday: 'short',
  }).format(new Date(iso));
  return french ? raw.replace(/\.$/, '').toLowerCase() : raw.replace(/\.$/, '');
}

export function formatZonedTime(iso: string, timeZone: string): string {
  const parts = zonedParts(new Date(iso), timeZone);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatPhotoStamp(iso: string, timeZone: string, language: string): string {
  return `${formatZonedDay(iso, timeZone, language)} ${formatZonedTime(iso, timeZone)}`;
}

export function formatZonedWhen(iso: string, timeZone: string, language: string): string {
  const day = `${formatZonedWeekday(iso, timeZone, language)} ${formatZonedDay(iso, timeZone, language)}`;
  return `${day} · ${formatZonedTime(iso, timeZone)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function monthName(month: number, language: string): string {
  const french = language.toLowerCase().startsWith('fr');
  const date = new Date(Date.UTC(2026, month - 1, 15));
  const raw = new Intl.DateTimeFormat(french ? 'fr-CA' : 'en-GB', {
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
  const clean = raw.replace(/\.$/, '');
  return french ? `${clean.toLowerCase()}.` : clean;
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((row) => row.type === type)?.value ?? 0);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute') };
}

function zoneOffset(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return asUtc - date.getTime();
}

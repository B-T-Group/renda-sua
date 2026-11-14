import { cutoffPlace, floorCardInstant } from './assistant-rental-suggestion';

/** Cutoff rounded down to the hour, named once in the listing city's time. */
export function formatCardCutoff(iso: string, timeZone: string, locale: string): string {
  const date = new Date(floorCardInstant(iso, timeZone));
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone }).format(date);
  const month = monthLabel(date, timeZone, locale);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date);
  const place = cutoffPlace(timeZone);
  const where = locale.toLowerCase().startsWith('fr') ? `(heure de ${place})` : `(${place} time)`;
  return `${day} ${month} · ${time} ${where}`;
}

export function cardWindowCutoffOnly(locale: string, cutoff: string): string {
  if (locale.toLowerCase().startsWith('fr')) {
    return `Avec une carte, cette location doit se terminer le ${cutoff}.`;
  }
  return `With a card, this rental must end by ${cutoff}.`;
}

export function cardWindowUnfitReply(locale: string, cutoff: string): string {
  if (locale.toLowerCase().startsWith('fr')) {
    return `Avec une carte, cette location doit se terminer le ${cutoff}. Voici des dates possibles :`;
  }
  return `With a card, this rental must end by ${cutoff}. Here are dates that work:`;
}

/** Cutoff, then a label for a different range. The asked dates on the card do not work. */
export function cardWindowInsteadReply(locale: string, cutoff: string): string {
  if (locale.toLowerCase().startsWith('fr')) {
    return `Avec une carte, cette location doit se terminer le ${cutoff}. Ces dates conviennent à la place :`;
  }
  return `With a card, this rental must end by ${cutoff}. These dates work instead:`;
}

/** Same day-then-month shape as the active range chip: `13 Nov` / `13 nov.`. */
export function formatSuggestedRange(start: string, end: string, days: number, locale: string): string {
  return `${formatChipDay(start, locale)} → ${formatChipDay(end, locale)} · ${days} ${rangeUnit(days, locale)}`;
}

function formatChipDay(iso: string, locale: string): string {
  const day = iso.slice(0, 10);
  const date = new Date(`${day}T00:00:00.000Z`);
  const french = locale.toLowerCase().startsWith('fr');
  const raw = new Intl.DateTimeFormat(french ? 'fr' : 'en', { month: 'short', timeZone: 'UTC' }).format(date);
  const month = french ? raw : capitalize(raw.replace(/\./g, ''));
  return `${Number(day.slice(8, 10))} ${month}`;
}

function rangeUnit(days: number, locale: string): string {
  const french = locale.toLowerCase().startsWith('fr');
  if (days === 1) return french ? 'jour' : 'day';
  return french ? 'jours' : 'days';
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function monthLabel(date: Date, timeZone: string, locale: string): string {
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone }).format(date);
  return locale.toLowerCase().startsWith('fr') ? month.toLocaleLowerCase('fr') : month;
}

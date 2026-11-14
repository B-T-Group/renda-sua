/** Same cutoff shape as the rental date guard: "16 Nov · 13:00". */
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

function monthLabel(date: Date, timeZone: string, locale: string): string {
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone }).format(date);
  return locale.toLowerCase().startsWith('fr') ? month.toLocaleLowerCase('fr') : month;
}

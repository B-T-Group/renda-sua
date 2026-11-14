export function formatListingDay(iso: string, timeZone: string, language: string): string {
  return new Intl.DateTimeFormat(language.startsWith('fr') ? 'fr-CA' : 'en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

export function formatListingStamp(iso: string, timeZone: string, language: string): string {
  const locale = language.startsWith('fr') ? 'fr-CA' : 'en-GB';
  const day = formatListingDay(iso, timeZone, language);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
  return `${day} · ${time}`;
}

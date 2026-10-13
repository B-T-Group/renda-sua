const ZONE = 'Africa/Douala';

export function doualaYearMonth(at: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(at);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
  };
}

export function periodBounds(year: number, month: number): { start: string; end: string } {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return { start: isoDate(year, month, 1), end: isoDate(nextYear, nextMonth, 1) };
}

export function previousPeriod(at: Date): { start: string; end: string } {
  const current = doualaYearMonth(at);
  const month = current.month === 1 ? 12 : current.month - 1;
  const year = current.month === 1 ? current.year - 1 : current.year;
  return periodBounds(year, month);
}

export function currentPeriod(at: Date): { start: string; end: string } {
  const current = doualaYearMonth(at);
  return periodBounds(current.year, current.month);
}

export function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Africa/Douala is UTC+1 all year. Month bounds use this midnight, not UTC. */
export function doualaMidnight(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000+01:00`);
}

export function doualaNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000+01:00`);
}

export function periodRange(period: { start: string; end: string }): { start: string; end: string } {
  return {
    start: doualaMidnight(period.start).toISOString(),
    end: doualaMidnight(period.end).toISOString(),
  };
}

function isoDate(year: number, month: number, day: number): string {
  const monthText = String(month).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  return `${year}-${monthText}-${dayText}`;
}

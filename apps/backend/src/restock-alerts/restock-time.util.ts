import { RESTOCK_RULES } from './restock-alerts.types';

const MINUTE = 60 * 1000;

/** Offset (ms) of `timeZone` from UTC at `at`. Invalid zones fall back to UTC. */
export function tzOffsetMs(at: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at);
    const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(
      n('year'),
      n('month') - 1,
      n('day'),
      n('hour'),
      n('minute'),
      n('second')
    );
    return asUtc - Math.floor(at.getTime() / 1000) * 1000;
  } catch {
    return 0;
  }
}

const MARKET_TIMEZONES: Record<string, string> = {
  CM: 'Africa/Douala',
  GA: 'Africa/Libreville',
  CA: 'America/Toronto',
  CG: 'Africa/Brazzaville',
  TG: 'Africa/Lome',
  BJ: 'Africa/Porto-Novo',
  CI: 'Africa/Abidjan',
  PH: 'Asia/Manila',
};

/** User's own timezone, else the market timezone for their country, else Africa/Douala. */
export function resolveTimeZone(
  timezone: string | null | undefined,
  countryIso: string | null | undefined
): string {
  const tz = timezone?.trim();
  if (tz) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    } catch {
      /* fall through to market timezone */
    }
  }
  const iso = countryIso?.trim().toUpperCase() ?? '';
  return MARKET_TIMEZONES[iso] ?? 'Africa/Douala';
}

export function localHour(at: Date, timeZone: string): number {
  return new Date(at.getTime() + tzOffsetMs(at, timeZone)).getUTCHours();
}

export function isQuietHour(at: Date, timeZone: string): boolean {
  const h = localHour(at, timeZone);
  return h >= RESTOCK_RULES.quietStartHour || h < RESTOCK_RULES.quietEndHour;
}

/** The next 08:00 local after `at` (only meaningful when `at` is inside quiet hours). */
export function nextQuietEnd(at: Date, timeZone: string): Date {
  const offset = tzOffsetMs(at, timeZone);
  const local = new Date(at.getTime() + offset);
  const minutesOfDay = local.getUTCHours() * 60 + local.getUTCMinutes();
  const endMin = RESTOCK_RULES.quietEndHour * 60;
  const deltaMin =
    minutesOfDay < endMin ? endMin - minutesOfDay : 24 * 60 - minutesOfDay + endMin;
  const base = Math.floor(at.getTime() / MINUTE) * MINUTE;
  return new Date(base + deltaMin * MINUTE);
}

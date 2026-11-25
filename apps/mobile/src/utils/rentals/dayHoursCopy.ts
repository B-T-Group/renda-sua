/**
 * Copy and formatting for the day-and-hours picker. EN and FR ("vous").
 * Amounts use the house money format (NBSP before FCFA and between groups).
 * A copy lives in apps/frontend/src/utils/rentalDayHoursCopy.ts.
 */
import type { BlockNote, DayInfo, PickedDay } from './dayHoursPicker';

export type PickerLang = 'en' | 'fr';

export function pickerLang(language?: string | null): PickerLang {
  return (language ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

const EN = {
  title: 'When do you need it?',
  subtitle: 'Tap the days you need. Times are {{city}} time.',
  perDay: '{{amount}} / day',
  perHour: '{{amount}} / h',
  minHours: 'Min {{count}}\u00A0h',
  someBooked: 'Some hours booked',
  unavailable: 'Unavailable',
  empty: 'Tap one or more days on the calendar.',
  yourDays: 'Your days',
  fullDay: 'Full day',
  hours: 'Hours',
  sameForAll: 'Same for all days',
  allDays: 'All {{count}} days',
  oneSetting: 'One setting for every day',
  tapHint: 'Tap a start hour, then an end hour.',
  /** Web (mouse) wording of tapHint. */
  chooseHint: 'Choose a start hour, then an end hour.',
  tapEnd: 'Now tap the end hour.',
  sharedHint: 'Hours booked on any of these days are greyed out.',
  lockBooked: 'Full day isn’t possible: {{range}} is already booked.',
  lockToday: 'Full day isn’t possible today: it has already started.',
  lockTodaySoon: 'Full day isn’t possible today: it starts in less than 2\u00A0h.',
  sharedLockBooked: 'Full day isn’t possible: {{day}} is partly booked.',
  fromPerHour: 'from {{amount}} / h',
  stretched: 'Minimum {{count}}\u00A0h, so the end moved to {{time}}.',
  capped: 'Maximum {{count}}\u00A0h, so the end moved to {{time}}.',
  tooShort: 'Not enough free hours from {{time}}. Pick another start.',
  notInARow: 'Pick days in a row.',
  notInARowRemove: 'Remove days from the start or the end, so the rest stay in a row.',
  todayFrom: 'Today · from {{time}}',
  daysChanged: '{{count}} days · tap to change',
  noDays: 'No days yet',
  noDaysSub: 'Full day or hours — you choose per day.',
  dailyOnly: 'Rents by the day only',
  hourlyOnly: 'Rents by the hour only',
  pickup: 'Pickup {{when}}',
  eachDay: '{{range}} each day',
  continue: 'Continue',
  close: 'Close',
  remove: 'Remove {{day}}',
  changeDays: 'Change days',
  prevMonth: 'Previous month',
  nextMonth: 'Next month',
  day1: '{{count}} day',
  dayN: '{{count}} days',
  full1: '1 full',
  fullN: '{{count}} full',
  fullDays: 'Full days',
  hourBlock: '{{count}}\u00A0h',
} as const;

const FR: Record<keyof typeof EN, string> = {
  title: 'Quand en avez-vous besoin\u00A0?',
  subtitle: 'Touchez les jours voulus. Heures de {{city}}.',
  perDay: '{{amount}} / jour',
  perHour: '{{amount}} / h',
  minHours: 'Min.\u00A0{{count}}\u00A0h',
  someBooked: 'Quelques heures prises',
  unavailable: 'Indisponible',
  empty: 'Touchez un ou plusieurs jours du calendrier.',
  yourDays: 'Vos jours',
  fullDay: 'Journée',
  hours: 'Heures',
  sameForAll: 'Pareil pour tous',
  allDays: 'Les {{count}} jours',
  oneSetting: 'Un seul réglage pour chaque jour',
  tapHint: 'Touchez l’heure de début, puis l’heure de fin.',
  chooseHint: 'Choisissez l’heure de début, puis l’heure de fin.',
  tapEnd: 'Touchez maintenant l’heure de fin.',
  sharedHint: 'Les heures prises sur l’un de ces jours sont grisées.',
  lockBooked: 'Journée impossible\u00A0: {{range}} est déjà réservé.',
  lockToday: 'Journée impossible aujourd’hui\u00A0: elle a déjà commencé.',
  lockTodaySoon: 'Journée impossible aujourd’hui\u00A0: elle commence dans moins de 2\u00A0h.',
  sharedLockBooked: 'Journée impossible\u00A0: {{day}} est en partie réservé.',
  fromPerHour: 'dès\u00A0{{amount}} / h',
  stretched: 'Minimum {{count}}\u00A0h\u00A0: la fin passe à {{time}}.',
  capped: 'Maximum {{count}}\u00A0h\u00A0: la fin passe à {{time}}.',
  tooShort: 'Pas assez d’heures libres à partir de {{time}}. Choisissez un autre début.',
  notInARow: 'Choisissez des jours qui se suivent.',
  notInARowRemove: 'Retirez plutôt le premier ou le dernier jour, pour que les autres se suivent.',
  todayFrom: 'Aujourd’hui · dès\u00A0{{time}}',
  daysChanged: '{{count}} jours · touchez pour modifier',
  noDays: 'Aucun jour pour l’instant',
  noDaysSub: 'Journée ou heures\u00A0: vous choisissez pour chaque jour.',
  dailyOnly: 'Se loue à la journée uniquement',
  hourlyOnly: 'Se loue à l’heure uniquement',
  pickup: 'Retrait {{when}}',
  eachDay: '{{range}} chaque jour',
  continue: 'Continuer',
  close: 'Fermer',
  remove: 'Retirer {{day}}',
  changeDays: 'Modifier les jours',
  prevMonth: 'Mois précédent',
  nextMonth: 'Mois suivant',
  day1: '{{count}} jour',
  dayN: '{{count}} jours',
  full1: '1 journée',
  fullN: '{{count}} journées',
  fullDays: 'Journées',
  hourBlock: '{{count}}\u00A0h',
};

export type PickerCopyKey = keyof typeof EN;

export function pickerText(lang: PickerLang, key: PickerCopyKey, vars: Record<string, string | number> = {}): string {
  const raw = (lang === 'fr' ? FR : EN)[key];
  return raw.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? ''));
}

function groupedDigits(amount: number, sep: string): string {
  const rounded = Math.round(amount);
  return String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** "27 000 FCFA", "$40.00", "40,00 $". */
export function pickerMoney(amount: number, currency: string, lang: PickerLang): string {
  const code = (currency || 'XAF').toUpperCase();
  const value = Number.isFinite(amount) ? amount : 0;
  if (code === 'XAF' || code === 'XOF' || code === 'FCFA') return `${groupedDigits(value, '\u00A0')}\u00A0FCFA`;
  const digits = value.toFixed(2);
  if (code === 'CAD' || code === 'USD') {
    return lang === 'fr' ? `${digits.replace('.', ',')}\u00A0$` : `$${digits}`;
  }
  return `${digits}\u00A0${code}`;
}

/** 12-hour clock only for English in the Americas; 24-hour everywhere else (mockups). */
export function uses12h(lang: PickerLang, timeZone?: string | null): boolean {
  return lang === 'en' && (timeZone ?? '').startsWith('America/');
}

export function hourLabel(hour: number, lang: PickerLang, timeZone?: string | null, minutes = 0): string {
  const h = Math.floor(hour) % 24;
  if (uses12h(lang, timeZone)) {
    const suffix = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return minutes ? `${h12}:${String(minutes).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
  }
  return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function minuteLabel(totalMinutes: number, lang: PickerLang, timeZone?: string | null): string {
  return hourLabel(Math.floor(totalMinutes / 60), lang, timeZone, totalMinutes % 60);
}

/** "08:00 – 10:00" or "2 PM – 5 PM" (mockup 09). */
export function rangeLabel(start: number, end: number, lang: PickerLang, timeZone?: string | null): string {
  return `${hourLabel(start, lang, timeZone)} – ${hourLabel(end, lang, timeZone)}`;
}

const EN_WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FR_WD = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const EN_MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FR_MO = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const EN_MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FR_MONTH = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/** "Fri 27 Nov" / "ven. 27 nov." */
export function dayLabel(key: string, lang: PickerLang): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  const wd = (lang === 'fr' ? FR_WD : EN_WD)[d.getUTCDay()];
  const mo = (lang === 'fr' ? FR_MO : EN_MO)[d.getUTCMonth()];
  return `${wd}\u00A0${d.getUTCDate()}\u00A0${mo}`;
}

export function monthTitle(year: number, month0: number, lang: PickerLang): string {
  return `${(lang === 'fr' ? FR_MONTH : EN_MONTH)[month0]} ${year}`;
}

/** Calendar column heads: S M T W T F S (EN, Sunday first) or L M M J V S D (FR, Monday first). */
export function weekdayHeads(lang: PickerLang): string[] {
  return lang === 'fr' ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
}

export function weekStart(lang: PickerLang): 0 | 1 {
  return lang === 'fr' ? 1 : 0;
}

function plural(lang: PickerLang, count: number, one: PickerCopyKey, many: PickerCopyKey): string {
  return pickerText(lang, count === 1 ? one : many, { count });
}

/** Footer line 1: "3 days · 1 full, 2 × 3 h" / "1 day · 2 h" / "2 days · Full days". */
export function summaryLine(days: PickedDay[], lang: PickerLang): string {
  const head = plural(lang, days.length, 'day1', 'dayN');
  const full = days.filter((d) => d.mode === 'full').length;
  const blocks = days.filter((d) => d.mode === 'hours').map((d) => Math.max(1, d.end - d.start));
  const parts: string[] = [];
  if (full && !blocks.length) {
    parts.push(days.length === 1 ? pickerText(lang, 'fullDay') : pickerText(lang, 'fullDays'));
  } else if (full) {
    parts.push(plural(lang, full, 'full1', 'fullN'));
  }
  if (blocks.length) {
    const same = blocks.every((b) => b === blocks[0]);
    if (blocks.length === 1) parts.push(`${blocks[0]}\u00A0h`);
    else if (same) parts.push(`${blocks.length} × ${blocks[0]}\u00A0h`);
    else parts.push(blocks.map((b) => `${b}\u00A0h`).join(' + '));
  }
  return [head, parts.join(', ')].filter(Boolean).join(' · ');
}

/** Footer line 2: the single day's times, or the pickup moment. */
export function footerDetail(
  days: PickedDay[],
  infos: Record<string, DayInfo>,
  lang: PickerLang,
  timeZone?: string | null,
  opts: { shared?: boolean; todayKey?: string; cityLabel?: string } = {}
): string {
  if (!days.length) return pickerText(lang, 'noDaysSub');
  const first = days[0];
  const info = infos[first.key];
  const dayText = opts.todayKey === first.key ? (lang === 'fr' ? 'Aujourd’hui' : 'Today') : dayLabel(first.key, lang);
  if (opts.shared && days.length > 1 && first.mode === 'hours') {
    return pickerText(lang, 'eachDay', { range: rangeLabel(first.start, first.end, lang, timeZone) });
  }
  if (days.length === 1) {
    const range =
      first.mode === 'full' && info?.openMin != null && info.closeMin != null
        ? `${minuteLabel(info.openMin, lang, timeZone)} – ${minuteLabel(info.closeMin, lang, timeZone)}`
        : rangeLabel(first.start, first.end, lang, timeZone);
    return `${dayText} · ${range}`;
  }
  const startMin = first.mode === 'full' ? info?.openMin ?? first.start * 60 : first.start * 60;
  const sep = lang === 'fr' ? ', ' : ', ';
  const when = `${dayText}${sep}${minuteLabel(startMin, lang, timeZone)}`;
  const city = opts.cityLabel ? ` · ${opts.cityLabel}` : '';
  return `${pickerText(lang, 'pickup', { when })}${city}`;
}

export function noteText(note: BlockNote, lang: PickerLang, timeZone: string | null | undefined, minHours: number, maxHours: number | null): string {
  const time = hourLabel(note.hour, lang, timeZone);
  if (note.kind === 'stretched') return pickerText(lang, 'stretched', { count: Math.max(1, minHours), time });
  if (note.kind === 'capped') return pickerText(lang, 'capped', { count: maxHours ?? 0, time });
  return pickerText(lang, 'tooShort', { time });
}

/** "Libreville" from the listing city, else the time zone. */
export function cityName(city?: string | null, timeZone?: string | null): string {
  const c = (city ?? '').trim();
  if (c) return c;
  const tail = (timeZone ?? '').split('/').pop() ?? '';
  return tail.replace(/_/g, ' ') || 'local';
}

/** Amber lock line for a single day; null when Full day is open. */
export function lockReason(info: DayInfo, lang: PickerLang, timeZone?: string | null): string | null {
  if (info.fullDayLock === 'booked' && info.bookedRun) {
    return pickerText(lang, 'lockBooked', { range: rangeLabel(info.bookedRun.from, info.bookedRun.to, lang, timeZone) });
  }
  if (info.fullDayLock === 'today') return pickerText(lang, info.todayStarted ? 'lockToday' : 'lockTodaySoon');
  return null;
}

/** Same for all days: why Full day is locked, naming the first day that locks it. */
export function sharedLockReason(infos: DayInfo[], lang: PickerLang): string | null {
  const booked = infos.find((i) => i.fullDayLock === 'booked');
  if (booked) return pickerText(lang, 'sharedLockBooked', { day: dayLabel(booked.key, lang) });
  const today = infos.find((i) => i.fullDayLock === 'today');
  if (today) return pickerText(lang, today.todayStarted ? 'lockToday' : 'lockTodaySoon');
  return null;
}

/** Hourly-only listings never show a day price: "from 3 000 FCFA / h". */
export function fromHourlyPrice(hourRate: number, currency: string, lang: PickerLang): string {
  return pickerText(lang, 'fromPerHour', { amount: pickerMoney(hourRate, currency, lang) });
}

const SERVER_RULES: Record<string, { en: string; fr: string }> = {
  RENTAL_LEAD_TIME: {
    en: 'That start is now less than 2\u00A0h away. Pick a later time.',
    fr: 'Ce début est maintenant dans moins de 2\u00A0h. Choisissez une heure plus tard.',
  },
  RENTAL_DAYS_NOT_IN_A_ROW: { en: 'Pick days in a row.', fr: 'Choisissez des jours qui se suivent.' },
  RENTAL_ONE_BLOCK_PER_DAY: {
    en: 'Pick one time range per day.',
    fr: 'Choisissez une seule plage horaire par jour.',
  },
  RENTAL_BLOCK_BELOW_MIN_HOURS: {
    en: 'Each time range must meet the minimum hours.',
    fr: 'Chaque plage horaire doit atteindre le minimum d’heures.',
  },
  RENTAL_BLOCK_ABOVE_MAX_HOURS: {
    en: 'A time range is longer than the maximum hours.',
    fr: 'Une plage horaire dépasse le maximum d’heures.',
  },
  RENTAL_DAILY_NOT_OFFERED: {
    en: 'This listing doesn’t rent by the day. Pick hours instead.',
    fr: 'Cette annonce ne se loue pas à la journée. Choisissez des heures.',
  },
  RENTAL_HOURLY_NOT_OFFERED: {
    en: 'This listing rents by the day only. Pick full days instead.',
    fr: 'Cette annonce se loue à la journée uniquement. Choisissez des journées.',
  },
};

/** EN/FR text for a server day-and-hours rule code; null when the code isn't one of them. */
export function serverRuleText(code: unknown, lang: PickerLang): string | null {
  if (typeof code !== 'string') return null;
  const hit = SERVER_RULES[code];
  return hit ? hit[lang] : null;
}

/** Reads `code` from an API error (axios-style body, or the app's ApiError). */
export function serverRuleCode(error: unknown): string | null {
  const e = error as { code?: unknown; data?: { code?: unknown }; response?: { data?: { code?: unknown } } };
  const code = e?.response?.data?.code ?? e?.data?.code ?? e?.code;
  return typeof code === 'string' ? code : null;
}

/**
 * Submit failed: the EN/FR text to show inside the reopened picker when the server refused a
 * day-and-hours rule, or null (picker off, or some other error that stays on the page).
 */
export function submitRuleText(error: unknown, pickerOn: boolean, language?: string | null): string | null {
  if (!pickerOn) return null;
  return serverRuleText(serverRuleCode(error), pickerLang(language));
}

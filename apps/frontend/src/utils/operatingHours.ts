import {
  ServiceHourConfig,
  ServiceHoursValue,
} from '../components/admin/ServiceHoursEditor';

export type DayName =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface OperatingHoursDay {
  open?: string;
  close?: string;
  closed?: boolean;
}

export type OperatingHours = Partial<Record<DayName, OperatingHoursDay>>;

const DAY_ORDER: DayName[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** Mon-Fri 08:00-20:00, Sat/Sun closed — matches the backend default for new/existing business locations. */
export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  monday: { open: '08:00', close: '20:00' },
  tuesday: { open: '08:00', close: '20:00' },
  wednesday: { open: '08:00', close: '20:00' },
  thursday: { open: '08:00', close: '20:00' },
  friday: { open: '08:00', close: '20:00' },
  saturday: { closed: true },
  sunday: { closed: true },
};

/** Converts the `{ open, close, closed }` DB shape into the `{ start, end, enabled }` shape ServiceHoursEditor expects. */
export function operatingHoursToEditorValue(
  hours: OperatingHours | null | undefined
): ServiceHoursValue {
  const source = hours ?? DEFAULT_OPERATING_HOURS;
  const value: ServiceHoursValue = {};
  for (const day of DAY_ORDER) {
    const dayHours = source[day];
    const enabled = !!(dayHours && !dayHours.closed);
    value[day] = {
      enabled,
      start: (enabled && dayHours?.open) || '08:00',
      end: (enabled && dayHours?.close) || '20:00',
    };
  }
  return value;
}

/** Converts the ServiceHoursEditor `{ start, end, enabled }` shape back into the `{ open, close, closed }` DB shape. */
export function editorValueToOperatingHours(
  value: ServiceHoursValue
): OperatingHours {
  const hours: OperatingHours = {};
  for (const day of DAY_ORDER) {
    const config: ServiceHourConfig | undefined = value[day];
    if (!config || !config.enabled) {
      hours[day] = { closed: true };
    } else {
      hours[day] = { open: config.start, close: config.end };
    }
  }
  return hours;
}

const SHORT_DAY: Record<DayName, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

type TranslateFn = (key: string, defaultValue: string) => string;

function dayRangeLabel(days: DayName[], t: TranslateFn): string {
  if (days.length === 1) {
    return t(`common.weekdays.short.${days[0]}`, SHORT_DAY[days[0]]);
  }
  const first = t(`common.weekdays.short.${days[0]}`, SHORT_DAY[days[0]]);
  const last = t(
    `common.weekdays.short.${days[days.length - 1]}`,
    SHORT_DAY[days[days.length - 1]]
  );
  return `${first}–${last}`;
}

function isConsecutive(days: DayName[]): boolean {
  if (days.length <= 1) return true;
  const indexes = days.map((day) => DAY_ORDER.indexOf(day));
  for (let i = 1; i < indexes.length; i += 1) {
    if (indexes[i] !== indexes[i - 1] + 1) return false;
  }
  return true;
}

function resolvedHours(
  hours: OperatingHours | null | undefined
): OperatingHours {
  return { ...DEFAULT_OPERATING_HOURS, ...(hours ?? {}) };
}

function openRows(hours: OperatingHours | null | undefined) {
  const source = resolvedHours(hours);
  return DAY_ORDER.map((day) => {
    const dayHours = source[day];
    const enabled = !!(dayHours && !dayHours.closed && dayHours.open && dayHours.close);
    return {
      day,
      enabled,
      open: dayHours?.open || '08:00',
      close: dayHours?.close || '20:00',
    };
  }).filter((row) => row.enabled);
}

/** True when every weekday is closed after filling gaps from the platform default. */
export function isAllDaysClosed(
  hours: OperatingHours | null | undefined
): boolean {
  if (!hours) return false;
  const source = resolvedHours(hours);
  return DAY_ORDER.every((day) => source[day]?.closed === true);
}

/** One-line summary for cards, e.g. "Mon–Fri 08:00–20:00". */
export function formatOperatingHoursSummary(
  hours: OperatingHours | null | undefined,
  t: TranslateFn
): string {
  const rows = openRows(hours);
  if (rows.length === 0) return t('common.closed', 'Closed');
  return summarizeOpenRows(rows, t);
}

function summarizeOpenRows(
  rows: Array<{ day: DayName; open: string; close: string }>,
  t: TranslateFn
): string {
  const sameWindow = rows.every(
    (row) => row.open === rows[0].open && row.close === rows[0].close
  );
  const windowLabel = `${rows[0].open}–${rows[0].close}`;
  if (rows.length === 7 && sameWindow) {
    return t(
      'business.locations.operatingHours.everyDay',
      'Every day {{hours}}'
    ).replace('{{hours}}', windowLabel);
  }
  if (sameWindow && isConsecutive(rows.map((row) => row.day))) {
    return `${dayRangeLabel(rows.map((row) => row.day), t)} ${windowLabel}`;
  }
  if (sameWindow) {
    return t(
      'business.locations.operatingHours.openDays',
      '{{count}} days · {{hours}}'
    )
      .replace('{{count}}', String(rows.length))
      .replace('{{hours}}', windowLabel);
  }
  return t('business.locations.operatingHours.custom', 'Custom schedule');
}

/** Copy Monday's open window onto every enabled day. */
export function copyMondayToOpenDays(value: ServiceHoursValue): ServiceHoursValue {
  const monday = value.monday;
  if (!monday?.enabled) return value;
  const next: ServiceHoursValue = { ...value };
  for (const day of Object.keys(next)) {
    const config = next[day];
    if (!config?.enabled) continue;
    next[day] = { ...config, start: monday.start, end: monday.end };
  }
  return next;
}

export function editorHoursAreValid(value: ServiceHoursValue): boolean {
  return Object.values(value).every((config) => {
    if (!config?.enabled) return true;
    return config.start < config.end;
  });
}

export function operatingHoursEqual(
  left: OperatingHours | null | undefined,
  right: OperatingHours | null | undefined
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

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

export interface OperatingHoursEditorRow {
  day: DayName;
  enabled: boolean;
  open: string;
  close: string;
}

export const DAY_ORDER: DayName[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** Mon–Fri 08:00–20:00, Sat/Sun closed — matches backend default. */
export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  monday: { open: '08:00', close: '20:00' },
  tuesday: { open: '08:00', close: '20:00' },
  wednesday: { open: '08:00', close: '20:00' },
  thursday: { open: '08:00', close: '20:00' },
  friday: { open: '08:00', close: '20:00' },
  saturday: { closed: true },
  sunday: { closed: true },
};

const SHORT_DAY: Record<DayName, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

function normalizeTime(value: string | undefined, fallback: string): string {
  if (!value?.trim()) return fallback;
  return value.trim().slice(0, 5);
}

export function operatingHoursToEditorRows(
  hours: OperatingHours | null | undefined
): OperatingHoursEditorRow[] {
  // Fill gaps with platform defaults so partial JSON never invents open weekends
  // or silently closes weekdays. Explicit day entries always win.
  const source: OperatingHours = {
    ...DEFAULT_OPERATING_HOURS,
    ...(hours ?? {}),
  };
  return DAY_ORDER.map((day) => {
    const dayHours = source[day];
    const enabled = !!(dayHours && !dayHours.closed);
    return {
      day,
      enabled,
      open: enabled ? normalizeTime(dayHours?.open, '08:00') : '08:00',
      close: enabled ? normalizeTime(dayHours?.close, '20:00') : '20:00',
    };
  });
}

export function editorRowsToOperatingHours(
  rows: OperatingHoursEditorRow[]
): OperatingHours {
  const hours: OperatingHours = {};
  for (const row of rows) {
    if (!row.enabled) {
      hours[row.day] = { closed: true };
    } else {
      hours[row.day] = {
        open: normalizeTime(row.open, '08:00'),
        close: normalizeTime(row.close, '20:00'),
      };
    }
  }
  return hours;
}

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
  const indexes = days.map((d) => DAY_ORDER.indexOf(d));
  for (let i = 1; i < indexes.length; i += 1) {
    if (indexes[i] !== indexes[i - 1] + 1) return false;
  }
  return true;
}

/** One-line summary for cards, e.g. "Mon–Fri 08:00–20:00". */
export function formatOperatingHoursSummary(
  hours: OperatingHours | null | undefined,
  t: TranslateFn
): string {
  const rows = operatingHoursToEditorRows(hours);
  const openRows = rows.filter((r) => r.enabled);
  if (openRows.length === 0) {
    return t('common.closed', 'Closed');
  }

  const sameWindow = openRows.every(
    (r) => r.open === openRows[0].open && r.close === openRows[0].close
  );
  const windowLabel = `${openRows[0].open}–${openRows[0].close}`;

  if (openRows.length === 7 && sameWindow) {
    return t('business.locations.operatingHours.everyDay', 'Every day {{hours}}').replace(
      '{{hours}}',
      windowLabel
    );
  }

  const openDays = openRows.map((r) => r.day);
  if (sameWindow && isConsecutive(openDays)) {
    return `${dayRangeLabel(openDays, t)} ${windowLabel}`;
  }

  if (sameWindow) {
    return t('business.locations.operatingHours.openDays', '{{count}} days · {{hours}}')
      .replace('{{count}}', String(openRows.length))
      .replace('{{hours}}', windowLabel);
  }

  return t('business.locations.operatingHours.custom', 'Custom schedule');
}

export function dayDisplayLabel(day: DayName, t: TranslateFn): string {
  const defaults: Record<DayName, string> = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  };
  return t(`common.weekdays.${day}`, defaults[day]);
}

export function dayDisplayLabelShort(day: DayName, t: TranslateFn): string {
  return t(`common.weekdays.short.${day}`, SHORT_DAY[day]);
}

/** Copy open/close from `sourceDay` onto every enabled day. */
export function applyHoursToEnabledDays(
  rows: OperatingHoursEditorRow[],
  sourceDay: DayName
): OperatingHoursEditorRow[] {
  const source = rows.find((row) => row.day === sourceDay && row.enabled);
  if (!source) return rows;
  return rows.map((row) =>
    row.enabled ? { ...row, open: source.open, close: source.close } : row
  );
}

/** True when close is strictly after open (HH:MM). */
export function isValidOpenCloseWindow(open: string, close: string): boolean {
  return normalizeTime(open, '') < normalizeTime(close, '');
}

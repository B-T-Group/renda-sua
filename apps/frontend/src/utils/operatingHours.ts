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

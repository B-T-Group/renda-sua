export type WeeklyAvailabilitySlot = {
  weekday: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
};

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function createDefaultWeeklyAvailability(): WeeklyAvailabilitySlot[] {
  return [
    { weekday: 0, is_available: false, start_time: null, end_time: null },
    {
      weekday: 1,
      is_available: true,
      start_time: '08:00:00',
      end_time: '20:00:00',
    },
    {
      weekday: 2,
      is_available: true,
      start_time: '08:00:00',
      end_time: '20:00:00',
    },
    {
      weekday: 3,
      is_available: true,
      start_time: '08:00:00',
      end_time: '20:00:00',
    },
    {
      weekday: 4,
      is_available: true,
      start_time: '08:00:00',
      end_time: '20:00:00',
    },
    {
      weekday: 5,
      is_available: true,
      start_time: '08:00:00',
      end_time: '20:00:00',
    },
    {
      weekday: 6,
      is_available: true,
      start_time: '08:00:00',
      end_time: '20:00:00',
    },
  ];
}

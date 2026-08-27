import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Weekday labels indexed Sunday-first to match
 * food_availability_slots.day_of_week, localised by the active language.
 */
export function useFoodWeekdayNames(): string[] {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, {
      weekday: 'long',
    });
    // 2026-08-23 is a Sunday, giving a stable Sunday-first sequence.
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(Date.UTC(2026, 7, 23 + index, 12)))
    );
  }, [i18n.language]);
}

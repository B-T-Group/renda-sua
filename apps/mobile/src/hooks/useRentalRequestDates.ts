import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRentalCatalogGeoParams } from './useRentalCatalogGeoParams';
import type { RentalListingRow } from '../types/rentals';
import { allDaySelectionsForRange } from '../utils/rentals/rentalSearchPreset';
import {
  formatSearchStayRange,
  marketTimeZone,
  rangeFromSearchParams,
  type RentalDateRange,
} from '../utils/rentals/rentalSearchDates';
import type { SelectionRange } from '../utils/rentals/rentalRequestScheduleUtils';

export { rangeFromSearchParams };

/**
 * Dates a request screen opened with (from search or a saved request). They seed the
 * day-and-hours picker; every later change happens in that picker.
 */
export function useRentalRequestDates(
  listing: RentalListingRow | null,
  startDate?: string,
  endDate?: string
) {
  const { t, i18n } = useTranslation();
  const geo = useRentalCatalogGeoParams();
  const stay = useMemo(() => rangeFromSearchParams(startDate, endDate), [endDate, startDate]);
  const presetSelections = useMemo(() => selectionsForStay(stay, listing), [listing, stay]);
  return {
    stay,
    presetSelections,
    timeZone: marketTimeZone(geo.country_code),
    dateLine: dateLineFor(stay, t, i18n.language),
  };
}

function selectionsForStay(stay: RentalDateRange | null, listing: RentalListingRow | null): SelectionRange[] {
  if (!stay || !listing) return [];
  return allDaySelectionsForRange(
    stay,
    listing.weekly_availability ?? [],
    Number(listing.base_price_per_day) || 0
  );
}

function dateLineFor(
  stay: RentalDateRange | null,
  t: (key: string, defaultValue: string, options?: Record<string, unknown>) => string,
  language: string
): string | undefined {
  if (!stay) return undefined;
  const days = t('rentals.requestForm.dayCount', '{{count}} days', { count: stay.dayCount });
  return t('rentals.searchFirst.sheetDateLine', '{{range}} · {{days}}', {
    range: formatSearchStayRange(stay, language),
    days,
  });
}

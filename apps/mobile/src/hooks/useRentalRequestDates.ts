import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CommonActions, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useRentalCatalogGeoParams } from './useRentalCatalogGeoParams';
import { searchRentals } from '../services/rentalSearchApi';
import type { RentalListingRow } from '../types/rentals';
import {
  allDaySelectionsForRange,
  stayRequestState,
  type StayHit,
} from '../utils/rentals/rentalSearchPreset';
import {
  formatRangeDates,
  formatSingleDate,
  marketTimeZone,
  publishRentalSearchStay,
  type RentalDateRange,
} from '../utils/rentals/rentalSearchDates';
import type { SelectionRange } from '../utils/rentals/rentalRequestScheduleUtils';

export function rangeFromSearchParams(startDate?: string, endDate?: string): RentalDateRange | null {
  if (!startDate || !endDate) return null;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const dayCount = Math.round((end - start) / 86_400_000);
  if (dayCount < 1 || dayCount > 30) return null;
  return { startDate, endDate, dayCount };
}

export function useRentalRequestDates(
  listing: RentalListingRow | null,
  startDate?: string,
  endDate?: string
) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const geo = useRentalCatalogGeoParams();
  const [stay, setStay] = useState<RentalDateRange | null>(() => rangeFromSearchParams(startDate, endDate));
  const [editOpen, setEditOpen] = useState(false);
  const [draftStay, setDraftStay] = useState<RentalDateRange | null>(stay);
  const [stayHit, setStayHit] = useState<StayHit | null | undefined>(undefined);
  const [checkingStay, setCheckingStay] = useState(false);

  const presetSelections = useMemo(
    () => selectionsForStay(stay, listing),
    [listing, stay]
  );
  const stayState = stayRequestState(checkingStay ? undefined : stayHit);
  const openDateEditor = useCallback(() => {
    setDraftStay(stay);
    setEditOpen(true);
  }, [stay]);
  const commitStay = useCallback(
    async (next: RentalDateRange) => {
      setStay(next);
      setStayHit(undefined);
      setCheckingStay(true);
      publishRentalSearchStay(next);
      syncListingRequestDates(navigation, listing?.id, next);
      navigation.setParams({ startDate: next.startDate, endDate: next.endDate });
      const hit = listing ? await fetchStayHit(listing, next, geo) : undefined;
      setStayHit(hit);
      setCheckingStay(false);
    },
    [geo, listing, navigation]
  );

  return {
    stay,
    draftStay,
    setDraftStay,
    editOpen,
    setEditOpen,
    presetSelections,
    checkingStay,
    openDateEditor,
    commitStay,
    timeZone: marketTimeZone(geo.country_code),
    dateLine: dateLineFor(stay, t, i18n.language),
    unavailableLabel: unavailableFor(stayState, t, i18n.language),
    requestBlocked: stayState.status === 'blocked',
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
    range: formatRangeDates(stay, language),
    days,
  });
}

function unavailableFor(
  state: ReturnType<typeof stayRequestState>,
  t: (key: string, defaultValue: string, options?: Record<string, unknown>) => string,
  language: string
): string | undefined {
  if (state.status !== 'blocked') return undefined;
  if (!state.nextAvailableDate) {
    return t('rentals.searchFirst.unavailableForDates', 'Not available for these dates');
  }
  return t('rentals.searchFirst.availableFrom', 'Available from {{date}}', {
    date: formatSingleDate(state.nextAvailableDate, language),
  });
}

async function fetchStayHit(
  listing: RentalListingRow,
  next: RentalDateRange,
  geo: { country_code?: string; state?: string }
): Promise<StayHit | null | undefined> {
  if (!listing.rental_item?.name) return undefined;
  try {
    const page = await searchRentals({
      q: listing.rental_item.name,
      country_code: geo.country_code,
      state: geo.state,
      start_date: next.startDate,
      end_date: next.endDate,
      limit: 20,
    });
    return hitFromPage(page.listings, listing.id);
  } catch {
    return undefined;
  }
}

function hitFromPage(
  listings: Array<{ listing: { id: string }; available: boolean | null; nextAvailableDate: string | null; totalForDates: number | null }>,
  listingId: string
): StayHit | null {
  const found = listings.find((row) => row.listing.id === listingId);
  if (!found) return null;
  return {
    available: found.available,
    nextAvailableDate: found.nextAvailableDate,
    totalForDates: found.totalForDates,
  };
}

function syncListingRequestDates(
  navigation: NavigationProp<ParamListBase>,
  listingId: string | undefined,
  next: RentalDateRange
): void {
  if (!listingId) return;
  const listing = navigation.getState().routes.find((route) => {
    if (route.name !== 'RentalListingDetail') return false;
    const params = route.params as { listingId?: string } | undefined;
    return params?.listingId === listingId;
  });
  if (!listing) return;
  navigation.dispatch({
    ...CommonActions.setParams({ startDate: next.startDate, endDate: next.endDate }),
    source: listing.key,
  });
}

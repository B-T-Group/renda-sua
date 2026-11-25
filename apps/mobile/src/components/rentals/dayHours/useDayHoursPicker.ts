import { useCallback, useMemo, useState } from 'react';
import type { RentalListingRow, RentalTakenWindow } from '../../../types/rentals';
import type { SelectionRange } from '../../../utils/rentals';
import {
  fromSelectionRanges,
  listingNowMs,
  utcMsToKey,
  type DayHoursListing,
  type PickedDay,
} from '../../../utils/rentals/dayHoursPicker';
import { dayLabel, pickerLang, summaryLine } from '../../../utils/rentals/dayHoursCopy';

function num(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Listing fields the picker reads. Missing switches (old API) read as both on. */
export function dayHoursListingModel(
  listing: Pick<
    RentalListingRow,
    | 'weekly_availability'
    | 'units_available'
    | 'min_rental_hours'
    | 'max_rental_hours'
    | 'base_price_per_day'
    | 'base_price_per_hour'
    | 'offers_daily'
    | 'offers_hourly'
  >,
  booked: RentalTakenWindow[]
): DayHoursListing {
  const offersDaily = listing.offers_daily !== false;
  const offersHourly = listing.offers_hourly !== false || !offersDaily;
  return {
    weekly: listing.weekly_availability ?? [],
    booked,
    units: Math.max(1, Number(listing.units_available) || 1),
    offersDaily,
    offersHourly,
    minHours: Math.max(1, Number(listing.min_rental_hours) || 1),
    maxHours: listing.max_rental_hours == null ? null : Number(listing.max_rental_hours),
    dayRate: num(listing.base_price_per_day),
    hourRate: num(listing.base_price_per_hour),
  };
}

/**
 * State for the request screens when rentals_day_hours_picker_enabled is on.
 * `rows` are what the review step submits; `days` reopen the sheet as they were.
 */
export function useDayHoursPicker(input: {
  enabled: boolean;
  listing: RentalListingRow | null;
  booked: RentalTakenWindow[];
  /** Rows the screen opened with (search dates as all-day rows, or a saved request). */
  seed: SelectionRange[];
  language: string;
  openOnStart?: boolean;
}) {
  const { enabled, listing, booked, seed, language } = input;
  const [open, setOpen] = useState(Boolean(input.enabled && input.openOnStart));
  const [picked, setPicked] = useState<{ rows: SelectionRange[]; days: PickedDay[] } | null>(null);
  const model = useMemo(() => (listing ? dayHoursListingModel(listing, booked) : null), [booked, listing]);
  const seedDays = useMemo(() => {
    if (!model) return [];
    const now = listingNowMs(Date.now(), listing?.timezone);
    return fromSelectionRanges(seed, model, now);
  }, [listing?.timezone, model, seed]);
  const lang = pickerLang(language);
  const days = picked?.days ?? seedDays;
  const dateLine = days.length
    ? `${dayLabel(days[0].key, lang)}${days.length > 1 ? ` – ${dayLabel(days[days.length - 1].key, lang)}` : ''} · ${summaryLine(days, lang)}`
    : undefined;
  const onContinue = useCallback((rows: SelectionRange[], next: PickedDay[]) => {
    setPicked({ rows, days: next });
    setOpen(false);
  }, []);
  return {
    enabled: enabled && Boolean(model),
    model,
    open,
    setOpen,
    rows: picked?.rows ?? null,
    days,
    initialDays: days,
    dateLine,
    onContinue,
    selectionKey: picked ? picked.days.map((d) => `${d.key}:${d.mode}:${d.start}-${d.end}`).join('|') : 'seed',
    todayKey: model ? utcMsToKey(listingNowMs(Date.now(), listing?.timezone)) : '',
  };
}

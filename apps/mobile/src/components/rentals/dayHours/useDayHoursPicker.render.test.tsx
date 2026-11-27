import { act, renderHook } from '@testing-library/react-native';
import type { RentalListingRow } from '../../../types/rentals';
import { defaultWeeklyAvailability } from '../../../utils/rentals/defaultWeeklyAvailability';
import { useDayHoursPicker } from './useDayHoursPicker';

const listing = {
  id: 'listing-1',
  weekly_availability: defaultWeeklyAvailability(),
  units_available: 1,
  min_rental_hours: 1,
  max_rental_hours: null,
  base_price_per_day: '15000',
  base_price_per_hour: '3000',
  timezone: 'Africa/Douala',
} as unknown as RentalListingRow;

describe('useDayHoursPicker', () => {
  it('opens on start with no flag to wait for', async () => {
    const view = await renderHook(() =>
      useDayHoursPicker({ listing, booked: [], seed: [], language: 'en', openOnStart: true })
    );
    expect(view.result.current.model).not.toBeNull();
    expect(view.result.current.open).toBe(true);
  });

  it('stays closed after the renter closes it, across re-renders', async () => {
    const view = await renderHook(() =>
      useDayHoursPicker({ listing, booked: [], seed: [], language: 'en', openOnStart: true })
    );
    await act(async () => view.result.current.close());
    expect(view.result.current.open).toBe(false);
    await act(async () => view.rerender({}));
    expect(view.result.current.open).toBe(false);
  });

  it('starts closed on the modify screen (no openOnStart)', async () => {
    const view = await renderHook(() =>
      useDayHoursPicker({ listing, booked: [], seed: [], language: 'en' })
    );
    expect(view.result.current.open).toBe(false);
  });
});

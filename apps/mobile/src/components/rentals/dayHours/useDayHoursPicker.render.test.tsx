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

type Props = { enabled: boolean };

function setup(initial: Props) {
  return renderHook(
    ({ enabled }: Props) =>
      useDayHoursPicker({ enabled, listing, booked: [], seed: [], language: 'en', openOnStart: true }),
    { initialProps: initial }
  );
}

describe('useDayHoursPicker open on start', () => {
  it('opens at mount when the flag is already on', async () => {
    const view = await setup({ enabled: true });
    expect(view.result.current.enabled).toBe(true);
    expect(view.result.current.open).toBe(true);
  });

  it('opens once the flag arrives after mount (client-flags still loading)', async () => {
    const view = await setup({ enabled: false });
    expect(view.result.current.open).toBe(false);
    await act(async () => view.rerender({ enabled: true }));
    expect(view.result.current.enabled).toBe(true);
    expect(view.result.current.open).toBe(true);
  });

  it('does not reopen after the renter closes it', async () => {
    const view = await setup({ enabled: true });
    await act(async () => view.result.current.close());
    expect(view.result.current.open).toBe(false);
    await act(async () => view.rerender({ enabled: true }));
    expect(view.result.current.open).toBe(false);
  });
});

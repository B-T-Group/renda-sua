import { cleanup } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { ThemeProvider } from '@/contexts/ThemeContext';
import i18n from '@/i18n';
import type { BusinessRentalRequestRow } from '@/types/rentals';
import { DashboardRentalRequestCard } from './DashboardRentalRequestCard';

function request(): BusinessRentalRequestRow {
  return {
    id: 'canon',
    created_at: '2026-11-26T12:00:00.000Z',
    status: 'pending',
    rental_selection_windows: [
      {
        billing: 'all_day',
        calendar_date: '2026-11-29',
        start_at: '2026-11-29T05:00:00.000Z',
        end_at: '2026-11-30T04:59:00.000Z',
      },
    ],
    rental_pricing_snapshot: { version: 4, currency: 'CAD', total: 90, securityDeposit: 0 },
    units_requested: 1,
    quoted_total: 90,
    requested_start_at: '2026-11-29T05:00:00.000Z',
    respond_by: '2026-11-27T12:00:00.000Z',
    dates_available: true,
    payment_rail: 'stripe',
    rental_location_listing: {
      id: 'listing-canon',
      base_price_per_hour: 12,
      base_price_per_day: 45,
      security_deposit_amount: 0,
      business_location: { name: 'Pulse Audio', address: { city: 'Toronto' } },
      rental_item: { name: 'Canon EOS R8', currency: 'CAD', rental_category: { name: 'Cameras' }, rental_item_images: [] },
    },
    client: { user: { first_name: 'Marie', last_name: 'Dubois' } },
  } as BusinessRentalRequestRow;
}

describe('dashboard rental request card actions', () => {
  afterEach(() => cleanup());

  it('places Decline before Accept so Accept is last on the right', async () => {
    await i18n.changeLanguage('en');
    const view = await renderWithProviders(
      <ThemeProvider>
        <DashboardRentalRequestCard request={request()} onAccept={() => undefined} onDecline={() => undefined} />
      </ThemeProvider>
    );
    expect(view.getByTestId('rental-request-decline')).toBeTruthy();
    expect(view.getByTestId('rental-request-accept')).toBeTruthy();
    const dump = JSON.stringify(view.toJSON());
    expect(dump.indexOf('rental-request-decline')).toBeGreaterThanOrEqual(0);
    expect(dump.indexOf('rental-request-accept')).toBeGreaterThan(dump.indexOf('rental-request-decline'));
  });
});

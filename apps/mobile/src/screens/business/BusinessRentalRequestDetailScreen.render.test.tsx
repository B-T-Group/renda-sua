const mockNav = { goBack: jest.fn() };
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => mockNav,
    useRoute: () => ({ params: { requestId: 'partybox' } }),
  };
});

const mockRows: { current: unknown[] } = { current: [] };
jest.mock('../../services/rentalsApi', () => ({
  rentalsApi: {
    getBusinessRequests: jest.fn(async () => mockRows.current),
  },
}));

jest.mock('../../components/business/rentals/BusinessRentalRespondDialog', () => ({
  BusinessRentalRespondDialog: () => null,
}));

import { act, cleanup, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { ThemeProvider } from '@/contexts/ThemeContext';
import i18n from '@/i18n';
import type { BusinessRentalRequestRow } from '@/types/rentals';
import BusinessRentalRequestDetailScreen from './BusinessRentalRequestDetailScreen';

function request(over: Partial<BusinessRentalRequestRow> = {}): BusinessRentalRequestRow {
  const start = '2026-11-26T20:00:00.000Z';
  return {
    id: 'partybox',
    created_at: '2026-11-26T12:00:00.000Z',
    status: 'pending',
    rental_selection_windows: [
      { billing: 'all_day', calendar_date: '2026-11-26', start_at: start, end_at: '2026-11-27T04:59:00.000Z' },
    ],
    rental_pricing_snapshot: { version: 4, currency: 'CAD', total: 90, securityDeposit: 0 },
    units_requested: 1,
    quoted_total: 90,
    requested_start_at: start,
    respond_by: '2026-11-26T18:00:00.000Z',
    respond_window: 'start',
    listing_timezone: 'America/Toronto',
    dates_available: true,
    payment_rail: 'stripe',
    rental_location_listing: {
      id: 'listing-party',
      base_price_per_hour: 12,
      base_price_per_day: 45,
      security_deposit_amount: 0,
      business_location: { name: 'Pulse Audio', address: { city: 'Toronto', country: 'CA' } },
      rental_item: {
        name: 'JBL PartyBox 310',
        currency: 'CAD',
        rental_category: { name: 'Speakers' },
        rental_item_images: [],
      },
    },
    client: { user: { first_name: 'MM', last_name: 'Test' } },
    ...over,
  } as BusinessRentalRequestRow;
}

function renderDetail() {
  return renderWithProviders(
    <ThemeProvider>
      <BusinessRentalRequestDetailScreen />
    </ThemeProvider>
  );
}

describe('business rental request detail — expired', () => {
  beforeEach(async () => {
    mockNav.goBack.mockReset();
    mockRows.current = [];
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    await act(async () => undefined);
    cleanup();
  });

  it('keeps Accept and Decline on a pending request', async () => {
    mockRows.current = [request()];
    const view = await renderDetail();
    await waitFor(() => expect(view.getByText('JBL PartyBox 310')).toBeTruthy());
    expect(view.getByText('The renter is charged after you accept')).toBeTruthy();
    expect(view.getByTestId('rental-request-accept')).toBeTruthy();
    expect(view.getByTestId('rental-request-decline')).toBeTruthy();
    expect(view.queryByTestId('rental-request-expired-state')).toBeNull();
  });

  it('hides actions and shows the expired state for a no_response request', async () => {
    mockRows.current = [
      request({ status: 'unavailable', unavailable_reason_code: 'no_response', respond_window: 'start' }),
    ];
    const view = await renderDetail();
    await waitFor(() => expect(view.getByTestId('rental-request-expired-state')).toBeTruthy());
    expect(view.getByText('Request expired')).toBeTruthy();
    expect(view.getByTestId('rental-request-expired-chip')).toBeTruthy();
    expect(view.getByText('Expired')).toBeTruthy();
    expect(view.queryByText('Requested')).toBeNull();
    expect(view.queryByText('Starts today')).toBeNull();
    expect(
      view.getByText("You didn’t reply before the start time. The renter can send a new request.")
    ).toBeTruthy();
    expect(view.getByText('JBL PartyBox 310')).toBeTruthy();
    expect(view.getByText(/Would have received/)).toBeTruthy();
    expect(view.queryByText(/You receive/)).toBeNull();
    expect(view.queryByText('The renter is charged after you accept')).toBeNull();
    expect(view.queryByTestId('rental-request-accept')).toBeNull();
    expect(view.queryByTestId('rental-request-decline')).toBeNull();
    expect(view.queryByText(/Nothing was charged/i)).toBeNull();
  });

  it('shows typographic French SLA copy on an expired 24h request', async () => {
    mockRows.current = [
      request({ status: 'unavailable', unavailable_reason_code: 'no_response', respond_window: 'sla' }),
    ];
    await i18n.changeLanguage('fr');
    const view = await renderDetail();
    await waitFor(() => expect(view.getByText('Demande expirée')).toBeTruthy());
    expect(view.getByText('Expirée')).toBeTruthy();
    expect(view.queryByText('Demandée')).toBeNull();
    expect(view.getByText(/Vous auriez reçu/)).toBeTruthy();
    expect(view.getByText(/Vous n’avez pas répondu sous 24/)).toBeTruthy();
    expect(i18n.t('business.dashboard.rentalRequests.expiredSlaReason')).toContain('24\u00a0h');
    expect(view.queryByTestId('rental-request-accept')).toBeNull();
  });


  it('hides actions on a manual decline without the expired banner', async () => {
    mockRows.current = [request({ status: 'unavailable', unavailable_reason_code: 'item_unavailable' })];
    const view = await renderDetail();
    await waitFor(() => expect(view.getByText('JBL PartyBox 310')).toBeTruthy());
    expect(view.queryByTestId('rental-request-expired-state')).toBeNull();
    expect(view.queryByTestId('rental-request-accept')).toBeNull();
    expect(view.queryByText('The renter is charged after you accept')).toBeNull();
  });
});

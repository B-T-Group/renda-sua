const mockFlags = { rentals_dashboard_requests_enabled: true, rentals_renter_return_report_enabled: false };
jest.mock('../../contexts/ClientFlagsContext', () => ({
  useClientFlags: () => ({ flags: mockFlags, loading: false }),
}));

const mockNav = { navigate: jest.fn() };
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => mockNav };
});

const mockDashboard = {
  requests: [] as unknown[],
  expiryNotices: [] as Array<{ id: string; itemName: string; renterName: string; window: 'sla' | 'start' }>,
};
const mockReturns = { rows: [] as unknown[] };
const mockConfirmReturn = jest.fn(async (_id: string) => ({ success: true }));
const mockDismiss = jest.fn(async (_id: string) => ({ success: true }));
jest.mock('../../services/rentalsApi', () => ({
  rentalsApi: {
    getDashboardRequests: jest.fn(async () => ({
      requests: mockDashboard.requests,
      expiryNotices: mockDashboard.expiryNotices,
    })),
    dismissExpiryNotice: (id: string) => mockDismiss(id),
    getReturnConfirmations: jest.fn(async () => mockReturns.rows),
    confirmReturn: (id: string) => mockConfirmReturn(id),
  },
}));

jest.mock('./rentals/BusinessRentalRespondDialog', () => ({
  BusinessRentalRespondDialog: () => null,
}));

import { Alert } from 'react-native';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { ThemeProvider } from '@/contexts/ThemeContext';
import i18n from '@/i18n';
import { DashboardRentalRequests } from './DashboardRentalRequests';

const startNotice = {
  id: 'partybox',
  itemName: 'JBL PartyBox 310',
  renterName: 'MM Test',
  window: 'start' as const,
};
const slaNotice = {
  id: 'canon',
  itemName: 'Canon EOS R8',
  renterName: 'Marie Dubois',
  window: 'sla' as const,
};

function renderNotice() {
  return renderWithProviders(
    <ThemeProvider>
      <DashboardRentalRequests />
    </ThemeProvider>
  );
}

describe('business expiry notice', () => {
  beforeEach(async () => {
    mockNav.navigate.mockReset();
    mockDismiss.mockClear();
    mockDashboard.requests = [];
    mockDashboard.expiryNotices = [startNotice];
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    await act(async () => undefined);
    cleanup();
  });

  it('renders the stacked start-window card and opens the expired request', async () => {
    const view = await renderNotice();
    await waitFor(() => expect(view.getByTestId('rental-request-expiry-notice')).toBeTruthy());
    expect(view.getByText('Request expired')).toBeTruthy();
    expect(view.getByText('JBL PartyBox 310 · MM Test')).toBeTruthy();
    expect(
      view.getByText("You didn’t reply before the start time. The renter can send a new request.")
    ).toBeTruthy();
    expect(view.queryByText(/Nothing was charged/i)).toBeNull();
    expect(view.queryByText(/Rien n’a été débité/i)).toBeNull();
    fireEvent.press(view.getByTestId('rental-request-expiry-view'));
    expect(mockNav.navigate).toHaveBeenCalledWith('BusinessRentalRequestDetail', { requestId: 'partybox' });
  });

  it('shows the 24h reason and typographic French copy, then dismisses to the next notice', async () => {
    mockDashboard.expiryNotices = [slaNotice, startNotice];
    await i18n.changeLanguage('fr');
    expect(i18n.t('business.dashboard.rentalRequests.expiredTitle')).toBe('Demande expirée');
    const view = await renderNotice();
    await waitFor(() => expect(view.getByTestId('rental-request-expiry-notice')).toBeTruthy());
    expect(view.getByText('Demande expirée')).toBeTruthy();
    expect(view.getByText('Canon EOS R8 · Marie Dubois')).toBeTruthy();
    expect(view.getByText(/Vous n’avez pas répondu sous 24/)).toBeTruthy();
    expect(i18n.t('business.dashboard.rentalRequests.expiredSlaReason')).toContain('24\u00a0h');
    expect(view.getByText(/Le locataire peut envoyer une nouvelle demande/)).toBeTruthy();
    expect(view.getByText('Voir la demande')).toBeTruthy();
    fireEvent.press(view.getByTestId('rental-request-expiry-dismiss'));
    await waitFor(() => expect(view.getByText('JBL PartyBox 310 · MM Test')).toBeTruthy());
    expect(view.getByText(/Vous n’avez pas répondu avant l’heure de début/)).toBeTruthy();
    fireEvent.press(view.getByTestId('rental-request-expiry-dismiss'));
    await waitFor(() => expect(view.queryByTestId('rental-request-expiry-notice')).toBeNull());
    expect(mockDismiss.mock.calls.map(([id]) => id)).toEqual(['canon', 'partybox']);
  });
});

function returnRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bk1',
    status: 'active',
    currency: 'XAF',
    renter_reported_returned_at: '2026-11-12T18:42:00.000Z',
    inspection_policy_version: null,
    client: { user: { first_name: 'Marie', last_name: 'Dubois' } },
    rental_location_listing: {
      business_location: { name: 'Akwa shop', address: { country: 'CM' } },
      rental_item: { name: 'JBL PartyBox 310' },
    },
    ...overrides,
  };
}

async function renderReturns() {
  const view = await renderNotice();
  const section = await waitFor(() => view.getByLabelText(/^Rental actions, \d+$/));
  fireEvent(section, 'layout', { nativeEvent: { layout: { width: 360, height: 200 } } });
  return view;
}

describe('business return confirmation card', () => {
  beforeEach(async () => {
    mockNav.navigate.mockReset();
    mockConfirmReturn.mockClear();
    mockDashboard.requests = [];
    mockDashboard.expiryNotices = [];
    mockReturns.rows = [returnRow()];
    mockFlags.rentals_renter_return_report_enabled = true;
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    mockFlags.rentals_renter_return_report_enabled = false;
    await act(async () => undefined);
    cleanup();
  });

  it('shows the item, renter and report time with specific buttons, and opens the booking', async () => {
    const view = await renderReturns();
    await waitFor(() => expect(view.getByTestId('dashboard-return-card')).toBeTruthy());
    expect(view.getByText('JBL PartyBox 310')).toBeTruthy();
    expect(view.getByText('Renter: Marie Dubois')).toBeTruthy();
    expect(view.getByText('Renter reported the return · 12 Nov · 19:42')).toBeTruthy();
    expect(view.getByText('Confirm return')).toBeTruthy();
    expect(view.getByText('Report a problem')).toBeTruthy();
    fireEvent.press(view.getByTestId('dashboard-return-open'));
    expect(mockNav.navigate).toHaveBeenCalledWith('BusinessRentalBookingDetail', { bookingId: 'bk1' });
  });

  it('reports a problem through the return inspection', async () => {
    const view = await renderReturns();
    await waitFor(() => expect(view.getByTestId('dashboard-return-problem')).toBeTruthy());
    fireEvent.press(view.getByTestId('dashboard-return-problem'));
    expect(mockNav.navigate).toHaveBeenCalledWith('BusinessInspection', { bookingId: 'bk1', stage: 'return' });
  });

  it('confirms a legacy booking after a prompt and removes the card', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => {
      buttons?.find((button) => button.text === 'Confirm return')?.onPress?.();
    });
    const view = await renderReturns();
    await waitFor(() => expect(view.getByTestId('dashboard-return-confirm')).toBeTruthy());
    fireEvent.press(view.getByTestId('dashboard-return-confirm'));
    expect(alert).toHaveBeenCalled();
    await waitFor(() => expect(mockConfirmReturn).toHaveBeenCalledWith('bk1'));
    await waitFor(() => expect(view.queryByTestId('dashboard-return-card')).toBeNull());
    expect(view.getByText('Return confirmed for JBL PartyBox 310')).toBeTruthy();
  });

  it('sends an inspection-enrolled booking to the return inspection instead of confirming', async () => {
    mockReturns.rows = [returnRow({ inspection_policy_version: 2 })];
    const view = await renderReturns();
    await waitFor(() => expect(view.getByTestId('dashboard-return-confirm')).toBeTruthy());
    fireEvent.press(view.getByTestId('dashboard-return-confirm'));
    expect(mockNav.navigate).toHaveBeenCalledWith('BusinessInspection', { bookingId: 'bk1', stage: 'return' });
    expect(mockConfirmReturn).not.toHaveBeenCalled();
  });

  it('renders nothing when the return report flag is off', async () => {
    mockFlags.rentals_renter_return_report_enabled = false;
    const view = await renderNotice();
    await act(async () => undefined);
    expect(view.queryByTestId('dashboard-return-card')).toBeNull();
  });
});

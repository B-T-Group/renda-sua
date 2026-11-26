jest.mock('../../contexts/ClientFlagsContext', () => ({
  useClientFlags: () => ({ flags: { rentals_dashboard_requests_enabled: true }, loading: false }),
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
jest.mock('../../services/rentalsApi', () => ({
  rentalsApi: {
    getDashboardRequests: jest.fn(async () => ({
      requests: mockDashboard.requests,
      expiryNotices: mockDashboard.expiryNotices,
    })),
  },
}));

jest.mock('./rentals/BusinessRentalRespondDialog', () => ({
  BusinessRentalRespondDialog: () => null,
}));

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
  });
});

import { ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { SnackbarProvider } from 'notistack';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import en from '../../../public/locales/en.json';
import fr from '../../../public/locales/fr.json';
import { theme } from '../../theme/theme';
import { BusinessDashboardRentalRequests } from './BusinessDashboardRentalRequests';

const mockDashboard = {
  requests: [] as unknown[],
  expiryNotices: [] as Array<{ id: string; itemName: string; renterName: string; window: 'sla' | 'start' }>,
};
const mockNavigate = jest.fn();

const mockFlags = { rentals_dashboard_requests_enabled: true, rentals_renter_return_report_enabled: false };
jest.mock('../../hooks/useClientFlags', () => ({
  useClientFlags: () => ({ flags: mockFlags, loaded: true }),
}));

const mockReturns = { rows: [] as unknown[] };
const mockFetchReturns = jest.fn(async () => mockReturns.rows);
const mockConfirmReturn = jest.fn(async (_id: string) => ({ success: true }));

const mockFetchDashboard = jest.fn(async () => ({
  requests: mockDashboard.requests,
  expiryNotices: mockDashboard.expiryNotices,
}));

const mockDismiss = jest.fn(async (_id: string) => ({ success: true }));

jest.mock('../../hooks/useRentalApi', () => ({
  useRentalApi: () => ({
    fetchDashboardRentalRequests: mockFetchDashboard,
    respondRequest: jest.fn(),
    dismissExpiryNotice: mockDismiss,
    fetchBusinessReturnConfirmations: mockFetchReturns,
    confirmReturn: mockConfirmReturn,
  }),
}));

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

jest.mock('../rentals/BusinessRentalRespondDialog', () => ({
  BusinessRentalRespondDialog: () => null,
}));

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
  });
}

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

function renderDash() {
  return render(
    <ThemeProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <SnackbarProvider>
          <MemoryRouter>
            <BusinessDashboardRentalRequests />
          </MemoryRouter>
        </SnackbarProvider>
      </I18nextProvider>
    </ThemeProvider>
  );
}

describe('business expiry notice', () => {
  beforeEach(async () => {
    mockNavigate.mockReset();
    mockDismiss.mockClear();
    mockDismiss.mockResolvedValue({ success: true });
    mockDashboard.requests = [];
    mockDashboard.expiryNotices = [startNotice];
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the stacked start-window card and opens the expired request', async () => {
    renderDash();
    await waitFor(() => expect(screen.getByTestId('rental-request-expiry-notice')).toBeInTheDocument());
    expect(screen.getByText('Request expired')).toBeInTheDocument();
    expect(screen.getByText('JBL PartyBox 310 · MM Test')).toBeInTheDocument();
    expect(
      screen.getByText("You didn’t reply before the start time. The renter can send a new request.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Nothing was charged/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('rental-request-expiry-view'));
    expect(mockNavigate).toHaveBeenCalledWith('/business/rentals/requests?request=partybox');
  });

  it('shows typographic French 24h copy and dismisses to the next notice', async () => {
    mockDashboard.expiryNotices = [slaNotice, startNotice];
    await i18n.changeLanguage('fr');
    renderDash();
    await waitFor(() => expect(screen.getByText('Demande expirée')).toBeInTheDocument());
    expect(screen.getByText('Canon EOS R8 · Marie Dubois')).toBeInTheDocument();
    expect(screen.getByText(/Vous n’avez pas répondu sous 24/)).toBeInTheDocument();
    expect(i18n.t('business.dashboard.rentalRequests.expiredSlaReason')).toContain('24\u00a0h');
    expect(screen.getByText('Voir la demande')).toBeInTheDocument();
    expect(screen.queryByText(/Rien n’a été débité/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('rental-request-expiry-dismiss'));
    await waitFor(() => expect(screen.getByText('JBL PartyBox 310 · MM Test')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('rental-request-expiry-dismiss'));
    await waitFor(() => expect(screen.queryByTestId('rental-request-expiry-notice')).not.toBeInTheDocument());
    expect(mockDismiss.mock.calls.map(([id]) => id)).toEqual(['canon', 'partybox']);
  });

  it('tells the server a notice was dismissed so it stays gone after a refresh', async () => {
    renderDash();
    await waitFor(() => expect(screen.getByTestId('rental-request-expiry-notice')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('rental-request-expiry-dismiss'));
    await waitFor(() => expect(screen.queryByTestId('rental-request-expiry-notice')).not.toBeInTheDocument());
    expect(mockDismiss).toHaveBeenCalledWith('partybox');
  });

  it('still hides the notice when the dismiss request fails', async () => {
    mockDismiss.mockRejectedValue(new Error('offline'));
    renderDash();
    await waitFor(() => expect(screen.getByTestId('rental-request-expiry-notice')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('rental-request-expiry-dismiss'));
    await waitFor(() => expect(screen.queryByTestId('rental-request-expiry-notice')).not.toBeInTheDocument());
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

describe('business return confirmation card', () => {
  beforeEach(async () => {
    mockNavigate.mockReset();
    mockConfirmReturn.mockClear();
    mockDashboard.requests = [];
    mockDashboard.expiryNotices = [];
    mockReturns.rows = [returnRow()];
    mockFlags.rentals_renter_return_report_enabled = true;
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    mockFlags.rentals_renter_return_report_enabled = false;
    cleanup();
  });

  it('shows the item, renter and report time with specific buttons, and opens the booking', async () => {
    renderDash();
    await waitFor(() => expect(screen.getByTestId('dashboard-return-card')).toBeInTheDocument());
    expect(screen.getByText('JBL PartyBox 310')).toBeInTheDocument();
    expect(screen.getByText('Renter: Marie Dubois')).toBeInTheDocument();
    expect(screen.getByText('Renter reported the return · 12 Nov · 19:42')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm return' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report a problem' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('dashboard-return-open'));
    expect(mockNavigate).toHaveBeenCalledWith('/rentals/bookings/bk1');
  });

  it('reports a problem through the booking return inspection', async () => {
    renderDash();
    await waitFor(() => expect(screen.getByTestId('dashboard-return-problem')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('dashboard-return-problem'));
    expect(mockNavigate).toHaveBeenCalledWith('/rentals/bookings/bk1#rental-inspection');
  });

  it('confirms a legacy booking after the dialog and removes the card', async () => {
    renderDash();
    await waitFor(() => expect(screen.getByTestId('dashboard-return-confirm')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('dashboard-return-confirm'));
    fireEvent.click(await screen.findByTestId('dashboard-return-dialog-confirm'));
    await waitFor(() => expect(mockConfirmReturn).toHaveBeenCalledWith('bk1'));
    await waitFor(() => expect(screen.queryByTestId('dashboard-return-card')).not.toBeInTheDocument());
    expect(await screen.findByText('Return confirmed for JBL PartyBox 310')).toBeInTheDocument();
  });

  it('sends an inspection-enrolled booking to the return inspection instead of confirming', async () => {
    mockReturns.rows = [returnRow({ inspection_policy_version: 2 })];
    renderDash();
    await waitFor(() => expect(screen.getByTestId('dashboard-return-confirm')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('dashboard-return-confirm'));
    expect(mockNavigate).toHaveBeenCalledWith('/rentals/bookings/bk1#rental-inspection');
    expect(mockConfirmReturn).not.toHaveBeenCalled();
  });

  it('renders nothing when the return report flag is off', async () => {
    mockFlags.rentals_renter_return_report_enabled = false;
    renderDash();
    await waitFor(() => expect(mockFetchDashboard).toHaveBeenCalled());
    expect(screen.queryByTestId('dashboard-return-card')).not.toBeInTheDocument();
  });
});

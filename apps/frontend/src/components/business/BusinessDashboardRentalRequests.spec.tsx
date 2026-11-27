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

jest.mock('../../hooks/useClientFlags', () => ({
  useClientFlags: () => ({ flags: { rentals_dashboard_requests_enabled: true }, loaded: true }),
}));

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

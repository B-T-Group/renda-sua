import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { theme } from '../../theme/theme';
import DeliveryConfirmPage from './DeliveryConfirmPage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, d?: any, o?: any) => {
      const s = typeof d === 'string' ? d : (d?.defaultValue ?? key);
      const vars = typeof d === 'object' ? d : o;
      return vars ? s.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(vars[k])) : s;
    },
  }),
}));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockSnack }) }));
const mockSnack = jest.fn();
const mockClient = { get: jest.fn(), post: jest.fn() };
jest.mock('../../hooks/useApiClient', () => ({ useApiClient: () => mockClient }));
const mockTrack = jest.fn();
const mockTracker = { trackSiteEvent: mockTrack };
jest.mock('../../hooks/useTrackSiteEvent', () => ({ useTrackSiteEvent: () => mockTracker }));
jest.mock('../../contexts/SessionAuthContext', () => ({ useSessionAuth: () => ({ logout: jest.fn() }) }));
const mockProfile: any = { userType: 'client', personas: ['client'], setActivePersona: jest.fn() };
jest.mock('../../contexts/UserProfileContext', () => ({ useUserProfileContext: () => mockProfile }));

const ID = 'o1';
function renderAt(url: string) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/orders/:orderId/confirm" element={<DeliveryConfirmPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile.userType = 'client';
  mockProfile.personas = ['client'];
});

describe('DeliveryConfirmPage', () => {
  it('renders the Complete screen with a server-time countdown and completes', async () => {
    const serverNow = new Date().toISOString();
    mockClient.get.mockResolvedValue({
      data: {
        orderId: ID,
        accessible: true,
        serverNow,
        deliveredAt: serverNow,
        autoCompleteHours: 2,
        autoCompleteDeadlineAt: new Date(Date.parse(serverNow) + 89.5 * 60_000).toISOString(),
        canComplete: true,
        canReport: true,
        confirmVariant: 'awaiting',
      },
    });
    mockClient.post.mockResolvedValue({ data: { success: true } });
    renderAt(`/orders/${ID}/confirm?persona=client&src=wa`);
    expect((await screen.findByTestId('delivery-confirm-countdown')).textContent).toBe(
      'Completes automatically in 1 h 30 min'
    );
    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'delivery_confirm_opened', metadata: expect.objectContaining({ source: 'wa', persona_switched: false }) })
    );
    fireEvent.click(screen.getByTestId('delivery-confirm-complete'));
    await waitFor(() => expect(mockClient.post).toHaveBeenCalledWith(`/orders/${ID}/confirm-receipt`, {}));
    expect(await screen.findByText('Thanks! Your order is complete.')).toBeTruthy();
  });

  it('switches to the client persona before loading any order data', () => {
    mockProfile.userType = 'agent';
    mockProfile.personas = ['agent', 'client'];
    renderAt(`/orders/${ID}/confirm?persona=client`);
    expect(screen.getByTestId('delivery-confirm-skeleton')).toBeTruthy();
    expect(mockProfile.setActivePersona).toHaveBeenCalledWith('client');
    expect(mockClient.get).not.toHaveBeenCalled();
  });

  it('shows the safe screen for an account without a client persona', () => {
    mockProfile.userType = 'agent';
    mockProfile.personas = ['agent'];
    renderAt(`/orders/${ID}/confirm?persona=client`);
    expect(screen.getByTestId('delivery-confirm-unavailable')).toBeTruthy();
    expect(mockClient.get).not.toHaveBeenCalled();
  });

  it('shows the safe screen when the API says the order is someone else\'s', async () => {
    mockClient.get.mockResolvedValue({ data: { orderId: ID, accessible: false, reason: 'other_account' } });
    renderAt(`/orders/${ID}/confirm?persona=client`);
    expect(await screen.findByTestId('delivery-confirm-unavailable')).toBeTruthy();
  });
});

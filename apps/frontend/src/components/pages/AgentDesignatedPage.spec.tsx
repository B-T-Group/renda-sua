import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AgentDesignatedPage from './AgentDesignatedPage';

const mockAccept = jest.fn();
const mockDecline = jest.fn();
const mockConfirm = jest.fn();
const mockRelease = jest.fn();
const mockRefetch = jest.fn();
const mockNavigate = jest.fn();

const mockT = (key: string, opts?: unknown) => {
  if (typeof opts === 'string') return opts;
  const o = (opts ?? {}) as Record<string, unknown>;
  const base = typeof o.defaultValue === 'string' ? o.defaultValue : key;
  return base.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(o[k] ?? ''));
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: { language: 'en' } }),
}));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const mockFuture = new Date(Date.now() + 6 * 3600_000).toISOString();
jest.mock('../../hooks/useDesignatedFirst', () => ({
  useDesignatedFirst: () => ({
    offers: [
      {
        orderId: 'o1',
        phase: 'early',
        expiresAt: mockFuture,
        offeredAt: mockFuture,
        estimatedEarnings: 1500,
        currency: 'XAF',
        details: {
          date: '2026-11-05', windowStart: '08:00:00', windowEnd: '12:00:00', gateAt: mockFuture,
          businessName: 'Blue', pickupArea: 'Bastos', dropoffArea: 'Mvog-Mbi', pickupKm: 2.3, dropoffKm: 5.1,
          distanceOrigin: 'home', commission: 1500, currency: 'XAF', releaseCutoffAt: null,
        },
      },
    ],
    upcoming: [
      {
        orderId: 'u1', orderNumber: 'ORD-1', storeName: 'Blue', date: '2026-11-05', windowStart: '08:00:00',
        windowEnd: '12:00:00', pickupBy: null, gateAt: mockFuture, releaseCutoffAt: mockFuture, freeRelease: true, confirmedAt: null,
      },
    ],
    loading: false,
    refetch: mockRefetch,
    accept: mockAccept,
    decline: mockDecline,
    confirm: mockConfirm,
    release: mockRelease,
  }),
}));

describe('AgentDesignatedPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the early offer with area, distances and earnings, and accepts it', async () => {
    mockAccept.mockResolvedValue({});
    render(<AgentDesignatedPage />);
    expect(screen.getByText(/Pickup: Blue, Bastos 2.3 km/)).toBeTruthy();
    expect(screen.getByText(/Drop-off area: Mvog-Mbi 5.1 km/)).toBeTruthy();
    expect(screen.getByText(/Earnings: 1500 XAF/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith('o1'));
    await waitFor(() => expect(screen.getByText('Accepted. It is yours for this slot.')).toBeTruthy());
  });

  it('confirms "Still on it" and hands back with a reason before the cutoff', async () => {
    mockConfirm.mockResolvedValue({});
    mockRelease.mockResolvedValue({});
    render(<AgentDesignatedPage />);
    expect(screen.getByText(/without penalty until/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Still on it' }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith('u1'));
    fireEvent.click(screen.getByRole('button', { name: "Can't make it" }));
    fireEvent.click(screen.getByRole('button', { name: 'Hand it back' }));
    await waitFor(() => expect(mockRelease).toHaveBeenCalledWith('u1', 'busy'));
  });

  it('shows the server refusal message', async () => {
    mockDecline.mockRejectedValue({ response: { data: { message: 'Offer expired' } } });
    render(<AgentDesignatedPage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Decline' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Decline' })[0]);
    await waitFor(() => expect(mockDecline).toHaveBeenCalledWith('o1', 'busy'));
    await waitFor(() => expect(screen.getByText('Offer expired')).toBeTruthy());
  });
});

import React from 'react';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { trackSiteEvent } from '../../../services/analytics/AppEventsService';
import type { BusinessRentalRequestRow } from '../../../types/rentals';
import { BusinessRentalRequestCard } from './BusinessRentalRequestCard';

jest.mock('../../../services/analytics/AppEventsService', () => ({
  trackSiteEvent: jest.fn(),
}));

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

function request(over: Partial<BusinessRentalRequestRow> = {}): BusinessRentalRequestRow {
  return {
    id: REQUEST_ID,
    created_at: '2026-11-11T18:19:00.000Z',
    status: 'pending',
    units_requested: 1,
    quoted_total: 760,
    rental_pricing_snapshot: {
      total: 760,
      currency: 'XAF',
      securityDeposit: 3040,
      lines: [{ kind: 'all_day', ratePerDay: 380 }],
    },
    rental_selection_windows: [
      { billing: 'all_day', calendar_date: '2026-11-14', start_at: '2026-11-14T00:00:00.000Z', end_at: '2026-11-15T00:00:00.000Z' },
      { billing: 'all_day', calendar_date: '2026-11-15', start_at: '2026-11-15T00:00:00.000Z', end_at: '2026-11-16T00:00:00.000Z' },
    ],
    payment_rail: 'mobile_money',
    dates_available: true,
    client_request_note: 'Need it for a birthday on Saturday. Happy to pick up Friday evening if that helps.',
    rental_location_listing: {
      id: 'listing-1',
      base_price_per_hour: 100,
      base_price_per_day: 380,
      security_deposit_amount: 3040,
      business_location: { name: 'Stripe Rail', address: { city: "L'Assomption" } },
      rental_item: { name: 'JBL PartyBox 310', currency: 'XAF' },
    },
    client: { id: 'client-1', user: { first_name: 'MM', last_name: 'Test' } },
    ...over,
  } as BusinessRentalRequestRow;
}

function renderCard(row = request(), onAccept = jest.fn(), onDecline = jest.fn()) {
  return renderWithProviders(
    <ThemeProvider>
      <BusinessRentalRequestCard request={row} onOpen={jest.fn()} onAccept={onAccept} onDecline={onDecline} />
    </ThemeProvider>
  );
}

describe('BusinessRentalRequestCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the amount and breakdown, and no deposit on MoMo', async () => {
    await renderCard();
    expect(screen.getByText('You receive 760 FCFA')).toBeTruthy();
    expect(screen.getByText('2 days × 380 FCFA / day')).toBeTruthy();
    expect(screen.queryByText(/Deposit:/)).toBeNull();
    expect(screen.queryByText(/Respond by/i)).toBeNull();
    expect(screen.queryByText(/fee/i)).toBeNull();
    expect(screen.getByTestId('request-card-date-icon')).toBeTruthy();
    expect(screen.getByTestId('request-card-wallet-icon')).toBeTruthy();
    expect(screen.getByTestId('request-card-place-icon')).toBeTruthy();
    expect(screen.queryByText('📅')).toBeNull();
    expect(screen.queryByText('💳')).toBeNull();
    expect(screen.queryByText('📍')).toBeNull();
  });

  it('shows a deposit only for a card rail', async () => {
    await renderCard(request({ payment_rail: 'stripe' }));
    expect(screen.getByText('Deposit: 3 040 FCFA')).toBeTruthy();
  });

  it('hides the deposit for a wallet rail', async () => {
    await renderCard(request({ payment_rail: 'wallet' }));
    expect(screen.queryByText(/Deposit:/)).toBeNull();
  });

  it('disables Accept when the server says the dates are booked', async () => {
    const onAccept = jest.fn();
    await renderCard(request({ dates_available: false }), onAccept);
    expect(screen.getByText('Already booked')).toBeTruthy();
    expect(screen.getByText(/Already booked for these dates/)).toBeTruthy();
    const accept = screen.getByLabelText(/unavailable because this item is already booked/);
    await userEvent.press(accept);
    expect(onAccept).not.toHaveBeenCalled();
    expect(trackSiteEvent).not.toHaveBeenCalled();
  });

  it('expands several windows and records accept and decline taps', async () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    await renderCard(
      request({
        quoted_total: 800,
        rental_selection_windows: [
          { billing: 'hourly', start_at: '2026-11-11T09:00:00.000Z', end_at: '2026-11-11T13:00:00.000Z' },
          { billing: 'hourly', start_at: '2026-11-13T14:00:00.000Z', end_at: '2026-11-13T18:00:00.000Z' },
        ],
      }),
      onAccept,
      onDecline
    );
    expect(screen.getByText('2 days · see times')).toBeTruthy();
    expect(screen.queryByText(/09:00/)).toBeNull();
    await userEvent.press(screen.getByLabelText('See times'));
    expect(screen.getByText(/09:00/)).toBeTruthy();
    fireEvent.press(screen.getByText('Accept'));
    fireEvent.press(screen.getByText('Decline'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(trackSiteEvent).toHaveBeenCalledWith({
      eventType: 'rental_request_card_accept_tap',
      metadata: { request_id: REQUEST_ID },
    });
    expect(trackSiteEvent).toHaveBeenCalledWith({
      eventType: 'rental_request_card_decline_tap',
      metadata: { request_id: REQUEST_ID },
    });
  });
});

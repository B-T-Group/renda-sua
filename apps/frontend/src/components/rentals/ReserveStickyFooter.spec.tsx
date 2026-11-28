import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { buildReserveSummary } from '../../utils/rentals/reserveSummary';
import { ReserveStickyFooter } from './ReserveStickyFooter';

const t = (_key: string, fallback: string, vars?: Record<string, unknown>) =>
  fallback.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(vars?.[k] ?? ''));

const feeSummary = () =>
  buildReserveSummary({
    mode: 'fee',
    windows: [{ start_at: '2026-11-28T14:00:00Z', end_at: '2026-11-28T18:00:00Z' }],
    quote: { currency: 'CAD', total: 40, securityDeposit: 20, lines: [] },
    booking: { reservation_fee_amount: 1 },
    listingZone: 'America/Toronto',
    isStripeRail: true,
    language: 'en',
    t,
  });

describe('ReserveStickyFooter', () => {
  it('shows pay today, pay at pickup and one short rule, with the full rules behind Details', () => {
    render(<ReserveStickyFooter summary={feeSummary()} />);
    expect(screen.getByText('Pay today')).toBeTruthy();
    expect(screen.getByText('$1.00')).toBeTruthy();
    expect(screen.getByText('Pay at pickup')).toBeTruthy();
    expect(screen.getByText('$39.00')).toBeTruthy();
    expect(screen.getByText('Free cancellation until Fri 27 Nov · 11:59 PM')).toBeTruthy();
    expect(screen.queryByTestId('reserve-details-sheet')).toBeNull();
    fireEvent.click(screen.getByTestId('reserve-details-open'));
    expect(screen.getByTestId('reserve-details-sheet')).toBeTruthy();
    expect(screen.getByText(/Refunded if you cancel before Sat 28 Nov/)).toBeTruthy();
    expect(screen.getByText(/Kept by the business if you don’t come to pick up/)).toBeTruthy();
    expect(screen.getByText(/hold a \$20.00 deposit/)).toBeTruthy();
  });
});

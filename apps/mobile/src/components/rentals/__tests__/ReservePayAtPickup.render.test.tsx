/** Reserve now, pay at pickup: reserve sheet (fee on/off), booking payment card, card Pay & start. */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { PaperProvider } from 'react-native-paper';
import { paperTheme } from '../../../theme/paperTheme';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import i18n from '../../../i18n';
import type { ClientRentalRequestRow } from '../../../types/rentals';
import { PayAtPickupCard } from '../PayAtPickupCard';
import { RentalBookConfirmSheet } from '../RentalBookConfirmSheet';
import { RentalStartAction, RentalStartCard, type RentalStartCardProps, type StartCardBooking } from '../RentalStartCard';

const NOW = Date.parse('2026-11-28T15:00:00Z');

function offer(currency: string, total: number, booking: NonNullable<ClientRentalRequestRow['rental_booking']>): ClientRentalRequestRow {
  return {
    id: 'req-1',
    status: 'available',
    created_at: '2026-11-26T12:00:00Z',
    rental_selection_windows: [{ start_at: '2026-11-28T14:00:00Z', end_at: '2026-11-28T18:00:00Z' }],
    rental_pricing_snapshot: { currency, total, securityDeposit: currency === 'CAD' ? 180 : 0, lines: [], computedAt: '2026-11-26T12:00:00Z' },
    rental_location_listing: {
      id: 'l1',
      base_price_per_hour: 15,
      base_price_per_day: 0,
      business_location: { name: 'Sono Akwa' },
      rental_item: { name: 'JBL PartyBox 310', currency },
    },
    rental_booking: booking,
  } as unknown as ClientRentalRequestRow;
}

/** ThemeProvider outside PaperProvider, like the app, so Paper portals still see the theme. */
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <PaperProvider theme={paperTheme}>
        <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
      </PaperProvider>
    </ThemeProvider>
  );
}

function renderSheet(row: ClientRentalRequestRow, isStripeRail: boolean) {
  return renderWithProviders(
    <>
      <RentalBookConfirmSheet visible row={row} isStripeRail={isStripeRail} onDismiss={() => undefined} onConfirm={() => undefined} />
    </>
  );
}

describe('Reserve now, pay at pickup', () => {
  afterEach(() => void i18n.changeLanguage('en'));

  it('MoMo without a fee: nothing to pay today, Reserve · pay at pickup', async () => {
    await renderSheet(offer('XAF', 12000, { id: 'b1', status: 'proposed', reservation_fee_amount: 0 }), false);
    expect(screen.getByText('Reserve · pay at pickup')).toBeTruthy();
    expect(screen.getByText(/Nothing to pay today/)).toBeTruthy();
    expect(screen.queryByTestId('book-confirm-fee-rules')).toBeNull();
  });

  it('MoMo with a fee: Pay 150 FCFA & reserve and the refund rules', async () => {
    await renderSheet(offer('XAF', 12000, { id: 'b1', status: 'proposed', reservation_fee_amount: 150 }), false);
    expect(screen.getByText('Pay 150\u00a0FCFA & reserve')).toBeTruthy();
    expect(screen.getByTestId('book-confirm-fee-rules')).toBeTruthy();
    expect(screen.getByText(/Pay at pickup 11.850.FCFA, after you check the item/)).toBeTruthy();
    expect(screen.getByText(/Refunded if you cancel before Sat 28 Nov/)).toBeTruthy();
    expect(screen.getByText('Free cancellation until Fri 27 Nov · 23:59')).toBeTruthy();
    expect(screen.queryByText(/Window 1/i)).toBeNull();
  });

  it('card market on the new path: no up-front hold, deposit at pickup', async () => {
    await renderSheet(offer('CAD', 60, { id: 'b1', status: 'proposed', card_pay_at_pickup: true, reservation_fee_amount: 1 }), true);
    expect(screen.getByText('Pay $1.00 & reserve')).toBeTruthy();
    expect(screen.getByText('Held on your card at pickup')).toBeTruthy();
    expect(screen.getByText(/2:00–6:00 PM/)).toBeTruthy();
    expect(screen.queryByText('Held on card')).toBeNull();
  });

  it('card market, legacy booking: keeps Continue to payment', async () => {
    await renderSheet(offer('CAD', 60, { id: 'b1', status: 'proposed' }), true);
    expect(screen.getByText('Continue to payment')).toBeTruthy();
  });

  it('booking card shows the paid fee and the amount due after the check', async () => {
    await renderWithProviders(
      <ThemeProvider>
        <PayAtPickupCard
          booking={{ status: 'reserved', currency: 'XAF', total_amount: 12000, payment_timing: 'pay_at_pickup', payment_status: 'pending', reservation_fee_amount: 150, reservation_fee_status: 'paid' }}
          format={(v) => `${v} FCFA`}
          itemCheck
          pickupDay="Sat 28 Nov"
        />
      </ThemeProvider>
    );
    expect(screen.getByText('Paid · reservation fee')).toBeTruthy();
    expect(screen.getByText('11850 FCFA')).toBeTruthy();
    expect(screen.getByText('Item check required')).toBeTruthy();
  });

  it('card Pay & start: charges rental − fee and holds the deposit', async () => {
    const booking: StartCardBooking = {
      status: 'reserved',
      start_at: '2026-11-28T14:00:00Z',
      end_at: '2026-11-28T18:00:00Z',
      start_opens_at: '2026-11-28T00:00:00Z',
      currency: 'CAD',
      total_amount: 60,
      payment_status: 'pending',
      payment_timing: 'pay_at_pickup',
      card_pay_at_pickup: true,
      reservation_fee_amount: 1,
      reservation_fee_status: 'paid',
      security_deposit_amount: 180,
    };
    const startProps: RentalStartCardProps = {
      booking,
      timeZone: 'America/Toronto',
      role: 'client',
      place: 'Sono',
      money: '$59.00',
      returnLabel: 'Sat 28 Nov · 6:00 PM',
      open: true,
      onOpen: () => undefined,
      onClose: () => undefined,
      onConfirm: () => undefined,
      now: NOW,
    };
    await renderWithProviders(
      <ThemeProvider>
        <RentalStartCard {...startProps} />
        <RentalStartAction {...startProps} />
      </ThemeProvider>
    );
    expect(screen.getAllByText('Pay & start · $59.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Reservation fee paid')).toBeTruthy();
    expect(screen.getByText('−$1.00')).toBeTruthy();
    expect(screen.getByText('Charged now')).toBeTruthy();
    expect(screen.getAllByText('$59.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pay $59.00 · start rental')).toBeTruthy();
    expect(screen.getByText('$239.00 on your card today · $180.00 of it is a hold')).toBeTruthy();
    expect(screen.getByText('Pick up your item · 2:00 PM')).toBeTruthy();
    expect(screen.queryByText(/held on your card/)).toBeNull();
  });
});

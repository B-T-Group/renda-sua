/** "Start rental?" sheet and start card: held amount includes the security deposit. */
import React from 'react';
import { getDefaultNormalizer, screen } from '@testing-library/react-native';

const raw = { normalizer: getDefaultNormalizer({ collapseWhitespace: false, trim: false }) };
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import i18n from '../../../i18n';
import { RentalStartCard, type StartCardBooking } from '../RentalStartCard';

const NOW = Date.parse('2026-11-26T15:00:00Z');
const base: StartCardBooking = {
  status: 'confirmed',
  start_at: '2026-11-26T09:00:00Z',
  end_at: '2026-11-26T17:00:00Z',
  start_opens_at: '2026-11-26T00:00:00Z',
  currency: 'CAD',
  total_amount: 60,
  payment_status: 'authorized',
  authorized_amount: 220,
  security_deposit_amount: 160,
};

function renderCard(booking: StartCardBooking) {
  return renderWithProviders(
    <ThemeProvider>
      <RentalStartCard
        booking={booking}
        timeZone="America/Toronto"
        role="client"
        place="Stripe Rail - L'Assomption"
        money="$60.00"
        returnLabel="Thu 26 Nov · 17:00"
        open
        onOpen={() => undefined}
        onClose={() => undefined}
        onConfirm={() => undefined}
        now={NOW}
      />
    </ThemeProvider>
  );
}

describe('RentalStartCard held amount', () => {
  afterEach(() => void i18n.changeLanguage('en'));

  it('shows rental + deposit as the hold, with the parts underneath', async () => {
    await renderCard(base);
    expect(screen.getAllByText('$220.00 held on your card').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('$60.00 rental · $160.00 security deposit').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('$60.00 held on your card')).toBeNull();
  });

  it('shows a single line when there is no deposit', async () => {
    await renderCard({ ...base, authorized_amount: 60, security_deposit_amount: 0 });
    expect(screen.getAllByText('$60.00 held on your card').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/security deposit/)).toBeNull();
  });

  it('never says card for a Mobile Money booking that is already paid', async () => {
    await renderCard({
      ...base,
      currency: 'XAF',
      total_amount: 15000,
      authorized_amount: null,
      security_deposit_amount: null,
      payment_status: 'paid',
      accept_start_preview: { payment_rail: 'wallet', amount_due_at_pickup: 0, paid_rail: 'mobile_money' },
    });
    expect(screen.queryByText(/held on your card/)).toBeNull();
    expect(screen.getAllByText(/paid with Mobile Money/).length).toBeGreaterThanOrEqual(1);
  });

  it('says will be paid from your wallet before Start when the wallet covers an FCFA booking', async () => {
    await renderCard({
      ...base,
      status: 'reserved',
      currency: 'XAF',
      total_amount: 15000,
      authorized_amount: null,
      security_deposit_amount: null,
      payment_status: 'pending',
      accept_start_preview: { payment_rail: 'wallet', amount_due_at_pickup: 15000 },
    });
    expect(screen.queryByText(/Mobile Money/)).toBeNull();
    expect(screen.getAllByText(/will be paid from your wallet/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Start rental').length).toBeGreaterThanOrEqual(1);
  });

  it('uses the French copy', async () => {
    await i18n.changeLanguage('fr');
    await renderCard(base);
    expect(screen.getAllByText(/retenus sur votre carte/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/location · .*caution/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Démarrer la location\u00a0?', raw)).toBeTruthy();
    expect(screen.getByText(/démarrage\u00a0\? .*dans les 30\u00a0minutes\.$/, raw)).toBeTruthy();
    expect(screen.getByText(/^Démarrez seulement lorsque vous êtes avec le commerce\. On vous remet/)).toBeTruthy();
  });
});

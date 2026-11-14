import {
  confirmationDepositHeld,
  confirmationTimeZone,
  confirmationZoneKey,
  formatBookedSpan,
  formatConfirmationDue,
  formatConfirmationMoney,
} from './confirmationFormat';

describe('confirmation timezone', () => {
  it('uses the listing country, then currency', () => {
    expect(confirmationTimeZone('TG')).toBe('Africa/Lome');
    expect(confirmationTimeZone('BJ')).toBe('Africa/Porto-Novo');
    expect(confirmationTimeZone('CM')).toBe('Africa/Douala');
    expect(confirmationTimeZone('CA')).toBe('America/Toronto');
    expect(confirmationTimeZone(null, 'XAF')).toBe('Africa/Douala');
    expect(confirmationTimeZone(null, 'XOF')).toBe('Africa/Lome');
    expect(confirmationTimeZone(null, 'CAD')).toBe('America/Toronto');
    expect(confirmationZoneKey('TG')).toBe('rentalInspection.confirm.zoneLome');
  });

  it('keeps the French short-month period and holds a deposit only on Stripe', () => {
    expect(formatConfirmationDue('2026-11-17T15:00:00.000Z', 'America/Toronto', 'fr')).toBe('17 nov. · 10:00');
    expect(formatConfirmationDue('2026-11-18T19:00:00.000Z', 'Africa/Douala', 'fr')).toBe('18 nov. · 20:00');
    expect(confirmationDepositHeld('authorized')).toBe(true);
    expect(confirmationDepositHeld('paid')).toBe(false);
  });

  it('shows a cross-day stay with CAD amounts', () => {
    expect(
      formatBookedSpan(
        '2026-11-17T20:00:00.000Z',
        '2026-11-19T01:00:00.000Z',
        'America/Toronto',
        'fr',
        'heure de Montréal'
      )
    ).toBe('17 nov. 15:00 → 18 nov. 20:00 (heure de Montréal)');
    expect(formatConfirmationMoney(65, 'CAD', 'en')).toBe('$65.00');
    expect(formatConfirmationMoney(65, 'CAD', 'fr')).toBe('65,00\u00a0$');
  });
});

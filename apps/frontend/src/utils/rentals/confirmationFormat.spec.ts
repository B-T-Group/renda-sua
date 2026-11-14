import { readFileSync } from 'fs';
import { join } from 'path';
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

  it('keeps the French short-month period', () => {
    expect(formatConfirmationDue('2026-11-17T15:00:00.000Z', 'America/Toronto', 'fr')).toBe('17 nov. · 10:00');
    expect(formatConfirmationDue('2026-11-18T19:00:00.000Z', 'Africa/Douala', 'fr')).toBe('18 nov. · 20:00');
    expect(formatConfirmationDue('2026-11-18T19:00:00.000Z', 'Africa/Douala', 'en')).toBe('18 Nov · 20:00');
  });

  it('shows a cross-day stay with CAD amounts', () => {
    const span = formatBookedSpan(
      '2026-11-17T20:00:00.000Z',
      '2026-11-19T01:00:00.000Z',
      'America/Toronto',
      'fr',
      'heure de Montréal'
    );
    expect(span).toBe('17 nov. 15:00 → 18 nov. 20:00 (heure de Montréal)');
    expect(formatConfirmationMoney(65, 'CAD', 'en')).toBe('$65.00');
    expect(formatConfirmationMoney(65, 'CAD', 'fr')).toBe('65,00\u00a0$');
    expect(formatConfirmationMoney(45, 'CAD', 'en')).not.toContain('CA$');
  });

  it('calls a deposit held only while a Stripe authorization is open', () => {
    expect(confirmationDepositHeld('authorized')).toBe(true);
    expect(confirmationDepositHeld('paid')).toBe(false);
    expect(confirmationDepositHeld('pending')).toBe(false);
    const recorded = 'retenue uniquement en cas de dommage';
    for (const file of [
      join(__dirname, '../../../public/locales/fr.json'),
      join(__dirname, '../../../../mobile/src/i18n/locales/fr.json'),
    ]) {
      const copy = JSON.parse(readFileSync(file, 'utf8')).rentalInspection.confirm;
      expect(copy.deposit).toBe('Caution bloquée');
      expect(copy.depositRecorded).toContain(recorded);
      expect(copy.depositRecorded).not.toContain('bloquée');
    }
  });
});

import { readFileSync } from 'fs';
import { join } from 'path';
import { confirmationDepositHeld, confirmationTimeZone, confirmationZoneKey, formatConfirmationDue } from './confirmationFormat';

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

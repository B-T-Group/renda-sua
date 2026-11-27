import { readFileSync } from 'fs';
import { join } from 'path';
import {
  confirmationDepositHeld,
  confirmationTimeZone,
  confirmationZoneDefault,
  confirmationZoneKey,
  formatBookedSpan,
  formatConfirmationDue,
  formatConfirmationMoney,
  inspectionExplainerRail,
  rentalCalendarIcs,
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
    expect(confirmationTimeZone('CD')).toBe('Africa/Kinshasa');
    expect(confirmationTimeZone(' cg ')).toBe('Africa/Brazzaville');
    expect(confirmationTimeZone(null, 'USD')).toBe('America/Toronto');
    expect(confirmationZoneKey('TG')).toBe('rentalInspection.confirm.zoneLome');
    expect(confirmationZoneDefault('CD', null, 'fr')).toBe('heure de Kinshasa');
    expect(confirmationZoneDefault('CG', null, 'en')).toBe('Brazzaville time');
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
    expect(span).toBe('17 nov. 20:00 → 19 nov. 01:00 (heure de Montréal)');
    expect(formatConfirmationMoney(65, 'CAD', 'en')).toBe('$65.00');
    expect(formatConfirmationMoney(65, 'CAD', 'fr')).toBe('65,00\u00a0$');
    expect(formatConfirmationMoney(45, 'CAD', 'en')).not.toContain('CA$');
    expect(formatConfirmationMoney(45000, 'XAF', 'en')).toBe('45\u00a0000\u00a0FCFA');
    expect(inspectionExplainerRail('momo', 'CAD')).toBe('card');
    expect(inspectionExplainerRail('momo', 'XAF')).toBe('momo');
    expect(inspectionExplainerRail('card', 'XAF')).toBe('card');
    expect(inspectionExplainerRail('momo', 'usd')).toBe('card');
    expect(inspectionExplainerRail('momo', 'XOF')).toBe('momo');
    expect(inspectionExplainerRail('wallet', 'XAF')).toBe('card');
    expect(formatConfirmationMoney(45000.4, 'XOF', 'en')).toBe('45\u00a0000\u00a0FCFA');
    expect(formatConfirmationMoney(45000.5, 'XOF', 'en')).toBe('45\u00a0001\u00a0FCFA');
    expect(formatConfirmationDue('not-a-date', 'Africa/Douala', 'fr')).toBe('');
    expect(formatConfirmationDue(null, 'Africa/Douala', 'en')).toBe('');
    expect(
      formatBookedSpan('2026-11-17T15:00:00.000Z', '2026-11-17T20:00:00.000Z', 'America/Toronto', 'fr')
    ).toBe('');
    expect(confirmationDepositHeld(null)).toBe(false);
    expect(confirmationDepositHeld('Authorized')).toBe(false);
    const ics = rentalCalendarIcs({
      title: 'Drill\n& saw',
      start: '2026-11-17T15:00:00.000Z',
      end: 'not-a-date',
      location: 'Line\n2',
    });
    expect(ics).toContain('SUMMARY:Drill & saw');
    expect(ics).toContain('LOCATION:Line 2');
    expect(ics).toContain('DTSTART:20261117T150000Z');
    expect(ics).toContain('DTEND:20261117T150000Z');
    expect(ics).not.toContain('\n&');
    expect(rentalCalendarIcs({ title: 'Empty', start: 'not-a-date' })).not.toContain('DTSTART:');
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

import { declineAmount, declineDay, momoRail } from './declinePickup.format';

describe('decline display format', () => {
  it('uses the shared CAD and FCFA formatters', () => {
    expect(declineAmount(65, 'CAD', 'en')).toBe('$65.00');
    expect(declineAmount(65, 'CAD', 'fr')).toBe('65,00\u00a0$');
    expect(declineAmount(45000, 'XAF', 'en')).toBe('45\u00a0000\u00a0FCFA');
    expect(declineAmount(45000, 'XAF', 'fr')).toBe('45\u00a0000\u00a0FCFA');
    expect(declineAmount(65, 'CAD', 'en')).not.toMatch(/CA\$|CAD/);
  });

  it('uses the short listing-zone date', () => {
    expect(declineDay('2026-11-14T16:00:00.000Z', 'America/Toronto', 'en')).toBe('14 Nov');
    expect(declineDay('2026-11-14T16:00:00.000Z', 'America/Toronto', 'fr')).toBe('14 nov.');
    expect(declineDay('2026-11-14T10:00:00.000Z', 'Africa/Douala', 'fr')).toBe('14 nov.');
  });

  it('keeps Mobile Money outcomes on the XAF rail', () => {
    expect(momoRail('XAF', 'momo_paid')).toBe(true);
    expect(momoRail('CAD', 'card')).toBe(false);
  });
});

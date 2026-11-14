import { confirmationTimeZone, confirmationZoneKey } from './confirmationFormat';

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
});

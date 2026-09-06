import { isCmOrGaPhone } from './withdrawPhone';

describe('isCmOrGaPhone', () => {
  it('accepts Cameroon numbers with country code and at least 9 national digits', () => {
    expect(isCmOrGaPhone('+237670000000')).toBe(true);
    expect(isCmOrGaPhone('237 6 70 00 00 00')).toBe(true);
  });

  it('accepts Gabon numbers with country code and at least 8 national digits', () => {
    expect(isCmOrGaPhone('+24106123456')).toBe(true);
    expect(isCmOrGaPhone('241 06 12 34 56')).toBe(true);
  });

  it('rejects short, foreign, and empty numbers', () => {
    expect(isCmOrGaPhone('+23767000000')).toBe(false);
    expect(isCmOrGaPhone('+2410612345')).toBe(false);
    expect(isCmOrGaPhone('+15551234567')).toBe(false);
    expect(isCmOrGaPhone('670000000')).toBe(false);
    expect(isCmOrGaPhone('')).toBe(false);
    expect(isCmOrGaPhone('   ')).toBe(false);
  });
});

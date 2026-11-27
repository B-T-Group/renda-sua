import { rateUnitLabel, rateUnitSuffix, withRateUnit } from './moneyRateUnit';

const NBSP = '\u00A0';

describe('withRateUnit', () => {
  it('puts non-breaking spaces on both sides of the slash', () => {
    expect(withRateUnit('3\u00A0000\u00A0FCFA', 'h')).toBe(`3\u00A0000\u00A0FCFA${NBSP}/${NBSP}h`);
    expect(withRateUnit('15\u00A0000\u00A0FCFA', 'day')).toBe(`15\u00A0000\u00A0FCFA${NBSP}/${NBSP}day`);
    expect(withRateUnit('15\u00A0000\u00A0FCFA', 'jour')).toBe(`15\u00A0000\u00A0FCFA${NBSP}/${NBSP}jour`);
  });

  it('accepts a leading slash in the unit, including regular spaces', () => {
    expect(withRateUnit('15 000 FCFA', '/ day')).toBe(`15 000 FCFA${NBSP}/${NBSP}day`);
    expect(withRateUnit('15 000 FCFA', '/jour')).toBe(`15 000 FCFA${NBSP}/${NBSP}jour`);
    expect(rateUnitLabel('/ hour')).toBe('hour');
  });

  it('does not use a wrapping regular space around the slash', () => {
    const value = withRateUnit('2 500 FCFA', 'h');
    expect(value).toBe(`2 500 FCFA${NBSP}/${NBSP}h`);
    expect(value.includes(' / ')).toBe(false);
    expect(value.includes('/h')).toBe(false);
    expect(rateUnitSuffix('day')).toBe(`${NBSP}/${NBSP}day`);
  });
});

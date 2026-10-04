import { creditCountryLabel } from './creditCountryLabel';

const t = (key: string, fallback: string) => `${key}|${fallback}`;

describe('creditCountryLabel', () => {
  it('translates known markets, including lowercase codes', () => {
    expect(creditCountryLabel('CM', t)).toBe(
      'admin.credits.countries.CM|Cameroon'
    );
    expect(creditCountryLabel('ph', t)).toBe(
      'admin.credits.countries.PH|Philippines'
    );
    expect(creditCountryLabel('tg', t)).toContain('Togo');
  });

  it('shows an unknown market code instead of crashing', () => {
    expect(creditCountryLabel('ZZ', t)).toBe('ZZ');
    expect(creditCountryLabel('xx', t)).toBe('XX');
  });

  it('renders a dash when the market has no country', () => {
    expect(creditCountryLabel(null, t)).toBe('—');
    expect(creditCountryLabel(undefined, t)).toBe('—');
    expect(creditCountryLabel('', t)).toBe('—');
  });
});

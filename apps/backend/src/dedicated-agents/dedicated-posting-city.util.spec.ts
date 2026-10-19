import { matchPostingCity, pickAgentAddress } from './dedicated-posting-city.util';

const douala = { country: 'CM', state: 'Littoral', city: 'Douala' };

describe('matchPostingCity (AC-E7)', () => {
  it.each([
    ['Douala', { country: 'CM', state: 'Littoral', city: 'Douala' }],
    ['"douala " (case / spacing)', { country: 'cm', state: 'littoral', city: 'douala ' }],
    ['Douala City', { country: 'CM', state: 'Littoral', city: 'Douala City' }],
  ])('matches %s on city', (_l, store) => {
    expect(matchPostingCity(douala, store)).toEqual({ match: true, basis: 'city' });
  });

  it('accents are ignored on both state and city', () => {
    expect(
      matchPostingCity({ country: 'CA', state: 'Québec', city: 'Montréal' }, { country: 'CA', state: 'Quebec', city: 'Montreal' })
    ).toEqual({ match: true, basis: 'city' });
  });

  it('a Yaoundé store is not visible to a Douala agent', () => {
    expect(matchPostingCity(douala, { country: 'CM', state: 'Centre', city: 'Yaoundé' })).toEqual({
      match: false,
      miss: 'country_or_state',
    });
    expect(matchPostingCity(douala, { country: 'CM', state: 'Littoral', city: 'Edéa' })).toEqual({
      match: false,
      miss: 'city',
    });
  });

  it('falls back to the state when either city is blank', () => {
    expect(matchPostingCity(douala, { country: 'CM', state: 'Littoral', city: '  ' })).toEqual({
      match: true,
      basis: 'state_fallback',
    });
    expect(matchPostingCity({ ...douala, city: null }, douala)).toEqual({ match: true, basis: 'state_fallback' });
  });

  it('never matches across countries, or without a state', () => {
    expect(matchPostingCity(douala, { country: 'GA', state: 'Littoral', city: 'Douala' })).toEqual({
      match: false,
      miss: 'country_or_state',
    });
    expect(matchPostingCity({ ...douala, state: '' }, { ...douala, state: '' })).toEqual({
      match: false,
      miss: 'country_or_state',
    });
  });
});

describe('pickAgentAddress', () => {
  it('prefers the active primary address, else the oldest', () => {
    const a = { city: 'Douala', is_primary: false };
    const b = { city: 'Yaoundé', is_primary: true };
    expect(pickAgentAddress([{ address: a }, { address: b }])).toBe(b);
    expect(pickAgentAddress([{ address: a }, { address: { city: 'Kribi', is_primary: false } }])).toBe(a);
    expect(pickAgentAddress([])).toBeNull();
    expect(pickAgentAddress(null)).toBeNull();
  });
});

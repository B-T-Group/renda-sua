import { sameCountryAndState } from './same-region.util';

describe('sameCountryAndState', () => {
  it('matches the same country code and state, ignoring case and accents', () => {
    expect(
      sameCountryAndState(
        { country: 'CM', state: 'Littoral' },
        { country: 'cm', state: 'Littoral' }
      )
    ).toBe(true);
    expect(
      sameCountryAndState(
        { country: 'CA', state: 'Québec' },
        { country: 'CA', state: 'Quebec' }
      )
    ).toBe(true);
  });

  it('treats a trailing region or province label as the same state', () => {
    expect(
      sameCountryAndState(
        { country: 'CM', state: 'Littoral' },
        { country: 'CM', state: 'Littoral Region' }
      )
    ).toBe(true);
  });

  it('rejects a different country or a different state', () => {
    expect(
      sameCountryAndState(
        { country: 'CA', state: 'Ontario' },
        { country: 'CM', state: 'Littoral' }
      )
    ).toBe(false);
    expect(
      sameCountryAndState(
        { country: 'CM', state: 'Littoral' },
        { country: 'CM', state: 'Centre' }
      )
    ).toBe(false);
  });

  it('rejects a missing country or state', () => {
    expect(
      sameCountryAndState({ country: 'CM', state: '' }, { country: 'CM', state: 'Littoral' })
    ).toBe(false);
    expect(
      sameCountryAndState({ country: '', state: 'Littoral' }, { country: 'CM', state: 'Littoral' })
    ).toBe(false);
  });
});

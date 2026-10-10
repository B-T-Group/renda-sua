import { sameCityStateAndCountry, sameCountryAndState } from './same-region.util';

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

  it('matches a French region label with the stored state name', () => {
    expect(
      sameCityStateAndCountry(
        { country: 'CM', state: 'Région du Centre', city: 'Yaoundé' },
        { country: 'CM', state: 'Centre', city: 'Yaoundé' }
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

  it('matches the same city after accents and a city label are ignored', () => {
    expect(
      sameCityStateAndCountry(
        { country: 'CM', state: 'Littoral', city: 'Douala' },
        { country: 'CM', state: 'Littoral Region', city: 'Douala City' }
      )
    ).toBe(true);
    expect(
      sameCityStateAndCountry(
        { country: 'CM', state: 'Centre', city: 'Yaoundé' },
        { country: 'cm', state: 'Centre', city: 'Yaounde' }
      )
    ).toBe(true);
  });

  it('rejects a different city or a missing city', () => {
    expect(
      sameCityStateAndCountry(
        { country: 'CM', state: 'Littoral', city: 'Douala' },
        { country: 'CM', state: 'Littoral', city: 'Nkongsamba' }
      )
    ).toBe(false);
    expect(
      sameCityStateAndCountry(
        { country: 'CM', state: 'Littoral', city: 'Douala' },
        { country: 'CM', state: 'Littoral' }
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

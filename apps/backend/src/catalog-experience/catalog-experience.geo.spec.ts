import { catalogLocationWhere, localizedCopy } from './catalog-experience.geo';

describe('catalog location filter', () => {
  it('requires a country when the shopper has not chosen one', () => {
    expect(catalogLocationWhere()).toEqual({
      is_active: { _eq: true },
      business: { is_storefront_visible: { _eq: true } },
      address: { country: { _is_null: false } },
    });
  });

  it('filters the chosen country and state', () => {
    expect(catalogLocationWhere('CM', 'Centre')).toEqual({
      is_active: { _eq: true },
      business: { is_storefront_visible: { _eq: true } },
      address: {
        country: { _eq: 'CM' },
        state: { _eq: 'Centre' },
      },
    });
  });

  it('omits a blank state', () => {
    expect(catalogLocationWhere('GA', '').address).toEqual({
      country: { _eq: 'GA' },
    });
  });
});

describe('localizedCopy', () => {
  it('uses French only for a French shopper', () => {
    expect(localizedCopy('fr', 'Deals', 'Offres')).toBe('Offres');
    expect(localizedCopy('en', 'Deals', 'Offres')).toBe('Deals');
  });
});

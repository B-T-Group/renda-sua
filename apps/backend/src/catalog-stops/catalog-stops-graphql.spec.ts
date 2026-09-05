import {
  GET_ACTIVE_DEALS,
  GET_COMPLEMENT_ITEMS,
  GET_FEATURED_STORES,
  GET_TOP_IN_CATEGORY,
} from './catalog-stops-graphql';

const locationScopedQueries = [
  GET_TOP_IN_CATEGORY,
  GET_ACTIVE_DEALS,
  GET_FEATURED_STORES,
  GET_COMPLEMENT_ITEMS,
];

describe('catalog-stops GraphQL documents', () => {
  it.each(locationScopedQueries)(
    'does not filter business_locations by country_code or storefront_visible',
    (query) => {
      expect(query).not.toMatch(/country_code/);
      expect(query).not.toMatch(/storefront_visible:/);
      expect(query).not.toMatch(/location_name/);
      expect(query).not.toMatch(/business_name/);
    }
  );

  it('featured stores select real location and business fields', () => {
    expect(GET_FEATURED_STORES).toContain('business_locations_bool_exp');
    expect(GET_FEATURED_STORES).toContain('is_storefront_visible');
    expect(GET_FEATURED_STORES).toContain('address { city }');
  });
});

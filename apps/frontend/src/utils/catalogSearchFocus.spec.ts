import { catalogSearchShouldFocus } from './catalogSearchFocus';

describe('catalogSearchShouldFocus', () => {
  it('focuses only when the search tab asks for it', () => {
    expect(catalogSearchShouldFocus('?focus=search')).toBe(true);
    expect(catalogSearchShouldFocus('focus=search')).toBe(true);
    expect(catalogSearchShouldFocus('?search=rice')).toBe(false);
    expect(catalogSearchShouldFocus('')).toBe(false);
  });
});

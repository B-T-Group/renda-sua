import { describe, expect, it } from 'vitest';
import { itemWebUrl, storeWebUrl } from './storeWebUrl';

describe('storeWebUrl', () => {
  it('uses the prod origin for the prod API', () => {
    expect(storeWebUrl('abc', 'https://prod.api.rendasua.com/api')).toBe(
      'https://rendasua.com/store/abc'
    );
  });

  it('uses the dev origin for dev and local APIs', () => {
    expect(storeWebUrl('abc', 'https://dev.api.rendasua.com/api')).toBe(
      'https://dev.rendasua.com/store/abc'
    );
    expect(storeWebUrl('abc', 'http://localhost:3000/api')).toBe(
      'https://dev.rendasua.com/store/abc'
    );
  });
});

describe('itemWebUrl', () => {
  it('builds the public /items/:id/seo page for the API environment', () => {
    expect(itemWebUrl('abc', 'https://prod.api.rendasua.com/api')).toBe(
      'https://rendasua.com/items/abc/seo'
    );
    expect(itemWebUrl('abc', 'https://dev.api.rendasua.com/api')).toBe(
      'https://dev.rendasua.com/items/abc/seo'
    );
  });
});

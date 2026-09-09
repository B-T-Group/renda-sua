import {
  buildOrderMetaCapiContext,
  parseOrderMetaCapiContext,
  pickMetaGeoAddress,
} from './order-meta-capi.util';

describe('order-meta-capi.util', () => {
  it('returns null when no matching fields are present', () => {
    expect(buildOrderMetaCapiContext({})).toBeNull();
  });

  it('keeps unhashed click id, browser id, ip, and user agent', () => {
    expect(
      buildOrderMetaCapiContext({
        fbc: ' fb.1.1.click ',
        fbp: 'fb.1.1.browser',
        clientIpAddress: '203.0.113.10',
        clientUserAgent: 'Mozilla/5.0',
        actionSource: 'website',
      })
    ).toEqual({
      fbc: 'fb.1.1.click',
      fbp: 'fb.1.1.browser',
      clientIpAddress: '203.0.113.10',
      clientUserAgent: 'Mozilla/5.0',
      actionSource: 'website',
    });
  });

  it('parses stored jsonb context', () => {
    const parsed = parseOrderMetaCapiContext({
      fbc: 'fb.1.1.click',
      actionSource: 'app',
    });
    expect(parsed.fbc).toBe('fb.1.1.click');
    expect(parsed.actionSource).toBe('app');
  });

  it('prefers delivery address over location address', () => {
    const geo = pickMetaGeoAddress(
      { city: 'Toronto', state: 'ON', postal_code: 'M5V 1A1', country: 'CA' },
      { city: 'Douala', country: 'CM' }
    );
    expect(geo.city).toBe('Toronto');
    expect(geo.country).toBe('CA');
  });

  it('falls back to the store address when delivery has no city, postal, or country', () => {
    const geo = pickMetaGeoAddress(
      { state: 'ON' },
      { city: 'Douala', postal_code: '00237', country: 'CM' }
    );
    expect(geo.city).toBe('Douala');
    expect(geo.country).toBe('CM');
  });

  it('ignores invalid stored jsonb types and unknown action sources', () => {
    expect(parseOrderMetaCapiContext(null)).toEqual({});
    expect(parseOrderMetaCapiContext(['fb.1.1.click'])).toEqual({});
    const parsed = parseOrderMetaCapiContext({
      fbc: 123,
      fbp: ' fb.1.1.browser ',
      actionSource: 'web',
      eventSourceUrl: ' https://rendasua.com/checkout ',
    });
    expect(parsed.fbc).toBeUndefined();
    expect(parsed.fbp).toBe('fb.1.1.browser');
    expect(parsed.actionSource).toBeUndefined();
    expect(parsed.eventSourceUrl).toBe('https://rendasua.com/checkout');
  });
});

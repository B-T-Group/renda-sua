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
});

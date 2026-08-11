import {
  appRelativeFromLocation,
  isSafeSameOriginPath,
  mapAppPathToWeb,
  toAppSchemeUrl,
} from './appDeepLink';

describe('appDeepLink', () => {
  describe('appRelativeFromLocation', () => {
    it('strips /app prefix for normal order links', () => {
      expect(appRelativeFromLocation('/app/orders/abc', '')).toBe('orders/abc');
      expect(appRelativeFromLocation('/app/orders/abc', '?x=1')).toBe(
        'orders/abc?x=1'
      );
    });

    it('collapses protocol-relative open-redirect payloads', () => {
      expect(appRelativeFromLocation('/app//evil.com', '')).toBe('evil.com');
      expect(appRelativeFromLocation('/app///evil.com', '')).toBe('evil.com');
      expect(appRelativeFromLocation('/app//evil.com', '?token=secret')).toBe(
        'evil.com?token=secret'
      );
    });

    it('rejects schemed path segments', () => {
      expect(appRelativeFromLocation('/app/https://evil.com', '')).toBe('');
      expect(appRelativeFromLocation('/app/javascript:alert(1)', '')).toBe('');
    });
  });

  describe('mapAppPathToWeb', () => {
    it('maps known app routes', () => {
      expect(mapAppPathToWeb('/wallet')).toBe('/accounts');
      expect(mapAppPathToWeb('/chat/order-1')).toBe('/orders/order-1?messages=1');
      expect(mapAppPathToWeb('/orders/order-1')).toBe('/orders/order-1');
    });

    it('never returns protocol-relative or absolute URLs', () => {
      expect(mapAppPathToWeb('//evil.com')).toBe('/');
      expect(mapAppPathToWeb('///evil.com')).toBe('/');
      expect(mapAppPathToWeb('https://evil.com')).toBe('/');
      expect(isSafeSameOriginPath('//evil.com')).toBe(false);
    });

    it('keeps collapsed host-looking paths on-origin', () => {
      // After sanitization, //evil becomes /evil.com (same-origin 404), not //evil.com
      expect(mapAppPathToWeb('/evil.com')).toBe('/evil.com');
      expect(isSafeSameOriginPath('/evil.com')).toBe(true);
    });
  });

  describe('toAppSchemeUrl', () => {
    it('builds custom scheme URLs without protocol-relative hosts', () => {
      expect(toAppSchemeUrl('orders/1')).toBe('rendasua://orders/1');
      expect(toAppSchemeUrl('//evil.com')).toBe('rendasua://evil.com');
      expect(toAppSchemeUrl('https://evil.com')).toBe('rendasua://');
    });
  });
});

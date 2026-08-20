import {
  appRelativeFromLocation,
  isSafeSameOriginPath,
  mapAppPathToWeb,
  toAppSchemeUrl,
} from './appDeepLink';

describe('appDeepLink', () => {
  describe('appRelativeFromLocation', () => {
    it('strips the /app prefix and keeps a same-origin path', () => {
      expect(appRelativeFromLocation('/app/orders/abc')).toBe('orders/abc');
    });

    it('preserves a same-origin query string', () => {
      expect(appRelativeFromLocation('/app/orders/abc', '?messages=1')).toBe(
        'orders/abc?messages=1'
      );
    });

    it('strips leading slashes so protocol-relative /app links stay relative', () => {
      expect(appRelativeFromLocation('/app//evil.example')).toBe('evil.example');
    });

    it('rejects schemed open-redirect payloads', () => {
      expect(appRelativeFromLocation('/app/https://evil.example')).toBe('');
      expect(appRelativeFromLocation('/app/javascript:alert(1)')).toBe('');
    });

    it('rejects backslashes and schemed query strings', () => {
      expect(appRelativeFromLocation('/app/orders\\evil')).toBe('');
      expect(
        appRelativeFromLocation('/app/orders/abc', '?https://evil.example')
      ).toBe('orders/abc');
    });
  });

  describe('isSafeSameOriginPath', () => {
    it('accepts a rooted relative path', () => {
      expect(isSafeSameOriginPath('/orders/abc')).toBe(true);
    });

    it('rejects protocol-relative, absolute, and escaped hosts', () => {
      expect(isSafeSameOriginPath('//evil.example')).toBe(false);
      expect(isSafeSameOriginPath('https://evil.example')).toBe(false);
      expect(isSafeSameOriginPath('/orders\\evil')).toBe(false);
    });
  });

  describe('mapAppPathToWeb', () => {
    it('maps known app routes onto in-web paths', () => {
      expect(mapAppPathToWeb('/wallet')).toBe('/accounts');
      expect(mapAppPathToWeb('/verification')).toBe('/documents');
      expect(mapAppPathToWeb('/chat/ord-1')).toBe('/orders/ord-1?messages=1');
      expect(mapAppPathToWeb('/deliveries/ord-1')).toBe('/orders/ord-1');
      expect(mapAppPathToWeb('/rentals/requests')).toBe(
        '/business/rentals/requests'
      );
      expect(mapAppPathToWeb('/items/item-1')).toBe('/business/items/item-1');
    });

    it('returns / for unsafe paths instead of following the payload', () => {
      expect(mapAppPathToWeb('//evil.example')).toBe('/');
      expect(mapAppPathToWeb('https://evil.example')).toBe('/');
    });
  });

  describe('toAppSchemeUrl', () => {
    it('builds a custom-scheme URL for a safe relative path', () => {
      expect(toAppSchemeUrl('orders/abc')).toBe('rendasua://orders/abc');
    });

    it('falls back to the scheme root for empty or schemed input', () => {
      expect(toAppSchemeUrl('')).toBe('rendasua://');
      expect(toAppSchemeUrl('https://evil.example')).toBe('rendasua://');
      expect(toAppSchemeUrl('javascript:alert(1)')).toBe('rendasua://');
    });
  });
});

import {
  appRelativeFromLocation,
  isSafeSameOriginPath,
  mapAppPathToWeb,
  toAppSchemeUrl,
} from './appDeepLink';

describe('appDeepLink same-origin guards', () => {
  describe('isSafeSameOriginPath', () => {
    it('accepts same-origin relative paths', () => {
      expect(isSafeSameOriginPath('/orders/abc')).toBe(true);
      expect(isSafeSameOriginPath('/wallet?tab=1')).toBe(true);
    });

    it('rejects protocol-relative, absolute, and schemed paths', () => {
      expect(isSafeSameOriginPath('//evil.com')).toBe(false);
      expect(isSafeSameOriginPath('https://evil.com')).toBe(false);
      expect(isSafeSameOriginPath('javascript:alert(1)')).toBe(false);
      expect(isSafeSameOriginPath('/ok\\evil')).toBe(false);
      expect(isSafeSameOriginPath('orders/abc')).toBe(false);
    });
  });

  describe('appRelativeFromLocation', () => {
    it('strips /app and keeps a safe in-app path', () => {
      expect(appRelativeFromLocation('/app/orders/abc', '?x=1')).toBe(
        'orders/abc?x=1'
      );
    });

    it('neutralizes open-redirect payloads after /app', () => {
      // Leading slashes are stripped so //evil.com cannot stay protocol-relative.
      expect(appRelativeFromLocation('/app//evil.com')).toBe('evil.com');
      expect(appRelativeFromLocation('/app/https://evil.com')).toBe('');
      expect(appRelativeFromLocation('/app/javascript:alert(1)')).toBe('');
    });
  });

  describe('mapAppPathToWeb', () => {
    it('maps known app paths and fails closed to /', () => {
      expect(mapAppPathToWeb('/wallet')).toBe('/accounts');
      expect(mapAppPathToWeb('/chat/ord-1')).toBe('/orders/ord-1?messages=1');
      expect(mapAppPathToWeb('/deliveries/ord-1')).toBe('/orders/ord-1');
      expect(mapAppPathToWeb('//evil.com')).toBe('/');
      expect(mapAppPathToWeb('https://evil.com')).toBe('/');
    });

    it('keeps Continue-in-browser on-site after /app//host', () => {
      const relative = appRelativeFromLocation('/app//evil.com');
      const webPath = mapAppPathToWeb(`/${relative}`);
      expect(webPath).toBe('/evil.com');
      expect(isSafeSameOriginPath(webPath)).toBe(true);
    });
  });

  describe('toAppSchemeUrl', () => {
    it('builds a custom scheme only for safe relative paths', () => {
      expect(toAppSchemeUrl('orders/abc')).toBe('rendasua://orders/abc');
      expect(toAppSchemeUrl(appRelativeFromLocation('/app//evil.com'))).toBe(
        'rendasua://evil.com'
      );
      expect(toAppSchemeUrl('https://evil.com')).toBe('rendasua://');
    });
  });
});

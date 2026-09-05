import {
  ANDROID_APP_PACKAGE,
  appRelativeFromLocation,
  isInAppBrowser,
  isSafeSameOriginPath,
  mapAppPathToWeb,
  openAppHref,
  shouldAutoOpenApp,
  toAndroidIntentUrl,
  toAppSchemeUrl,
} from './appDeepLink';

describe('appDeepLink', () => {
  describe('appRelativeFromLocation', () => {
    it('strips /app and keeps the order id', () => {
      expect(
        appRelativeFromLocation(
          '/app/orders/11111111-2222-4333-8555-666666666666'
        )
      ).toBe('orders/11111111-2222-4333-8555-666666666666');
    });

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
      expect(mapAppPathToWeb('/chat/ord-1')).toBe('/orders/ord-1/messages');
      expect(mapAppPathToWeb('/deliveries/ord-1')).toBe('/orders/ord-1');
      expect(mapAppPathToWeb('/rentals/requests')).toBe(
        '/business/rentals/requests'
      );
      expect(mapAppPathToWeb('/items/item-1')).toBe('/business/items/item-1');
    });

    it('maps delivery and admin app paths to web order screens', () => {
      expect(mapAppPathToWeb('/deliveries/abc')).toBe('/orders/abc');
      expect(mapAppPathToWeb('/admin/orders/abc')).toBe('/admin/orders/abc');
    });

    it('maps chat app paths to the order messages page', () => {
      expect(mapAppPathToWeb('/chat/abc')).toBe('/orders/abc/messages');
    });

    it('returns / for unsafe paths instead of following the payload', () => {
      expect(mapAppPathToWeb('//evil.example')).toBe('/');
      expect(mapAppPathToWeb('https://evil.example')).toBe('/');
    });
  });

  describe('toAppSchemeUrl', () => {
    it('builds a custom scheme URL', () => {
      expect(toAppSchemeUrl('orders/abc')).toBe('rendasua://orders/abc');
    });

    it('builds a custom scheme URL for a safe relative path', () => {
      expect(toAppSchemeUrl('orders/abc')).toBe('rendasua://orders/abc');
    });

    it('falls back to the scheme root for empty or schemed input', () => {
      expect(toAppSchemeUrl('')).toBe('rendasua://');
      expect(toAppSchemeUrl('https://evil.example')).toBe('rendasua://');
      expect(toAppSchemeUrl('javascript:alert(1)')).toBe('rendasua://');
    });
  });

  it('builds an Android intent URL for the installed package', () => {
    expect(toAndroidIntentUrl('orders/abc')).toBe(
      `intent://orders/abc#Intent;scheme=rendasua;package=${ANDROID_APP_PACKAGE};end`
    );
  });

  it('detects WhatsApp in-app browsers', () => {
    expect(isInAppBrowser('WhatsApp/2.24.0 Android')).toBe(true);
    expect(
      isInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
      )
    ).toBe(true);
    expect(
      isInAppBrowser(
        'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TP1A; wv) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
      )
    ).toBe(true);
    expect(
      isInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      )
    ).toBe(false);
  });

  it('uses intent URLs on Android and skips auto-open in WhatsApp', () => {
    const androidWa = 'WhatsApp/2.24.0 Android';
    expect(openAppHref('orders/abc', androidWa)).toContain('intent://');
    expect(shouldAutoOpenApp(androidWa)).toBe(false);
    expect(shouldAutoOpenApp('Mozilla/5.0 Safari/605.1.15')).toBe(true);
  });
});

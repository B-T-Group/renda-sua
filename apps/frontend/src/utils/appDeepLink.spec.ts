import {
  ANDROID_APP_PACKAGE,
  appRelativeFromLocation,
  isInAppBrowser,
  mapAppPathToWeb,
  openAppHref,
  shouldAutoOpenApp,
  toAndroidIntentUrl,
  toAppSchemeUrl,
} from './appDeepLink';

describe('appDeepLink', () => {
  it('strips /app and keeps the order id', () => {
    expect(
      appRelativeFromLocation(
        '/app/orders/11111111-2222-4333-8555-666666666666'
      )
    ).toBe('orders/11111111-2222-4333-8555-666666666666');
  });

  it('builds a custom scheme URL', () => {
    expect(toAppSchemeUrl('orders/abc')).toBe('rendasua://orders/abc');
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

  it('maps delivery and admin app paths to web order screens', () => {
    expect(mapAppPathToWeb('/deliveries/abc')).toBe('/orders/abc');
    expect(mapAppPathToWeb('/admin/orders/abc')).toBe('/admin/orders/abc');
  });
});

import {
  assistantScreenName,
  headerAssistantEntry,
  isAssistantOrbRoute,
  orbReplacesWhatsApp,
  shouldShowAssistantLauncher,
} from './assistantLauncherRoutes';

describe('isAssistantOrbRoute (spec §1 allowlist)', () => {
  it.each([
    '/',
    '/items',
    '/foods',
    '/rentals',
    '/stores',
    '/store/abc-123',
    '/likes',
    '/orders',
    '/orders/2b4f0f2c-1111-4222-8333-944445555666',
  ])('shows on %s (desktop and mobile)', (path) => {
    expect(isAssistantOrbRoute(path, false)).toBe(true);
    expect(isAssistantOrbRoute(path, true)).toBe(true);
  });

  it('item detail: desktop only (mobile has the sticky order bar)', () => {
    expect(isAssistantOrbRoute('/items/abc', false)).toBe(true);
    expect(isAssistantOrbRoute('/items/abc', true)).toBe(false);
  });

  it.each([
    '/cart',
    '/checkout',
    '/items/abc/place_order',
    '/items/abc/place_order/anon-address',
    '/orders/awaiting-payment',
    '/orders/confirmation',
    '/orders/batch',
    '/orders/abc/messages',
    '/assistant',
    '/messages',
    '/auth/otp',
    '/signup',
    '/dashboard',
    '/open-orders',
    '/business/items',
    '/support',
    '/rentals/xyz',
  ])('is hidden on %s', (path) => {
    expect(isAssistantOrbRoute(path, false)).toBe(false);
    expect(isAssistantOrbRoute(path, true)).toBe(false);
  });
});

describe('assistantScreenName', () => {
  it('maps routes to names the #458 validator accepts, never raw ids', () => {
    expect(assistantScreenName('/')).toBe('home');
    expect(assistantScreenName('/store/7c9e6679-7425-40de-944b-e07fc1f90ae7')).toBe('store_detail');
    expect(assistantScreenName('/orders/7c9e6679-7425-40de-944b-e07fc1f90ae7')).toBe('order_detail');
    expect(assistantScreenName('/items/42')).toBe('item_detail');
    expect(assistantScreenName('/assistant')).toBe('assistant');
    expect(assistantScreenName('/cart')).toBe('other');
    for (const p of ['/', '/items', '/store/x', '/orders/y', '/foo/bar']) {
      expect(assistantScreenName(p)).toMatch(/^[A-Za-z0-9_.-]{1,40}$/);
    }
  });
});

describe('persona × route × flag', () => {
  const at = (pathname: string, flagOn: boolean, isClientOrGuest: boolean, isMobile = false) => ({
    flagOn,
    isClientOrGuest,
    pathname,
    isMobile,
  });

  it('flag off: no launcher, the WhatsApp bubble is never swapped, header keeps SmartToy', () => {
    for (const path of ['/', '/items', '/cart', '/assistant']) {
      for (const cg of [true, false]) {
        expect(shouldShowAssistantLauncher(at(path, false, cg))).toBe(false);
        expect(orbReplacesWhatsApp(at(path, false, cg))).toBe(false);
        expect(headerAssistantEntry(at(path, false, cg))).toBe('icon');
      }
    }
  });

  it('agent/business: unchanged even with the flag on', () => {
    for (const path of ['/', '/items', '/orders', '/assistant']) {
      expect(shouldShowAssistantLauncher(at(path, true, false))).toBe(false);
      expect(orbReplacesWhatsApp(at(path, true, false))).toBe(false);
      expect(headerAssistantEntry(at(path, true, false))).toBe('icon');
    }
  });

  it('client/guest with the flag on: launcher + D2 on orb routes, one entry point at a time', () => {
    expect(shouldShowAssistantLauncher(at('/', true, true))).toBe(true);
    expect(orbReplacesWhatsApp(at('/', true, true))).toBe(true);
    expect(headerAssistantEntry(at('/', true, true))).toBe('hidden');
    // /assistant: no launcher, no WhatsApp bubble, no header robot.
    expect(shouldShowAssistantLauncher(at('/assistant', true, true))).toBe(false);
    expect(orbReplacesWhatsApp(at('/assistant', true, true))).toBe(true);
    expect(headerAssistantEntry(at('/assistant', true, true))).toBe('hidden');
    // Cart/checkout: the bubble keeps today's behaviour; the header shows the 28 px character.
    expect(shouldShowAssistantLauncher(at('/cart', true, true))).toBe(false);
    expect(orbReplacesWhatsApp(at('/cart', true, true))).toBe(false);
    expect(headerAssistantEntry(at('/cart', true, true))).toBe('character');
    // Mobile item detail: launcher hidden, header character instead.
    expect(shouldShowAssistantLauncher(at('/items/a', true, true, true))).toBe(false);
    expect(headerAssistantEntry(at('/items/a', true, true, true))).toBe('character');
  });
});

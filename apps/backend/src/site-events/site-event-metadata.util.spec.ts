import {
  filterAuthEventMetadata,
  normalizeSiteEventMetadata,
  valueLooksLikePii,
} from './site-event-metadata.util';

describe('site-event-metadata.util', () => {
  it('allowlists auth_ metadata keys only', () => {
    const out = filterAuthEventMetadata({
      entry: 'foods',
      email: 'a@b.com',
      channel: 'email',
      secret: 'x',
    });
    expect(out).toEqual({ entry: 'foods', channel: 'email' });
  });

  it('strips email and phone-like values for all events', () => {
    const out = normalizeSiteEventMetadata('inventory.cta.buy_now_click', {
      contactMethod: 'email',
      note: 'shop@example.com',
      phone: '+237670000000',
    });
    expect(out.contactMethod).toBe('email');
    expect(out.note).toBeUndefined();
    expect(out.phone).toBeUndefined();
  });

  it('strips otp-like values under sensitive keys', () => {
    expect(valueLooksLikePii('otp', '1234')).toBe(true);
    expect(valueLooksLikePii('code', '567890')).toBe(true);
  });

  it('accepts new auth event names in normalization path', () => {
    const out = normalizeSiteEventMetadata('auth_gate_shown', {
      entry: 'save_favorites',
      platform: 'web',
      flag_on: false,
      auth_path: 'auth0_ul',
      loginHint: 'user@example.com',
    });
    expect(out).toMatchObject({
      entry: 'save_favorites',
      platform: 'web',
      flag_on: false,
      auth_path: 'auth0_ul',
    });
    expect(out.loginHint).toBeUndefined();
  });

  it('strips nested emails and bare one-time codes', () => {
    const out = normalizeSiteEventMetadata('page.view', {
      context: 'checkout',
      note: '482910',
      quantity: '12',
      extra: { contact: 'shop@example.com', label: 'checkout' },
    });
    expect(out.context).toBe('checkout');
    expect(out.quantity).toBe('12');
    expect(out.note).toBeUndefined();
    expect(out.extra).toEqual({ label: 'checkout' });
  });
});

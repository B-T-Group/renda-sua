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
    }, 'client');
    expect(out.contactMethod).toBe('email');
    expect(out.note).toBeUndefined();
    expect(out.phone).toBeUndefined();
  });

  it('strips otp-like values under sensitive keys', () => {
    expect(valueLooksLikePii('otp', '1234', false)).toBe(true);
    expect(valueLooksLikePii('code', '567890', false)).toBe(true);
  });

  it('accepts new auth event names in normalization path', () => {
    const out = normalizeSiteEventMetadata('auth_gate_shown', {
      entry: 'save_favorites',
      platform: 'web',
      flag_on: false,
      auth_path: 'auth0_ul',
      loginHint: 'user@example.com',
    }, 'client');
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
    }, 'client');
    expect(out.context).toBe('checkout');
    expect(out.quantity).toBe('12');
    expect(out.note).toBeUndefined();
    expect(out.extra).toEqual({ label: 'checkout' });
  });

  it('allows server event ID keys despite digits', () => {
    const out = normalizeSiteEventMetadata('agent.claim_funds_check', {
      orderId: '550e8400-e29b-41d4-a716-446655440000',
      orderNumber: '12041661',
      agentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      transactionId: 'tx-123456789',
      businessLocationId: 'loc-987654321',
      holdAmount: 8000,
    }, 'server');
    expect(out.orderId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(out.orderNumber).toBe('12041661');
    expect(out.agentId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(out.transactionId).toBe('tx-123456789');
    expect(out.businessLocationId).toBe('loc-987654321');
    expect(out.holdAmount).toBe(8000);
  });
});

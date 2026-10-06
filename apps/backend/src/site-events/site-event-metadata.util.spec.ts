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

  describe('assistant event metadata', () => {
    it('allowlists assistant.* metadata keys only', () => {
      const out = normalizeSiteEventMetadata('assistant.message.sent', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        turn: 3,
        input: 'typed',
        length_bucket: '<20',
        secret: 'should-be-dropped',
        message_text: 'user typed this',
      }, 'client');
      expect(out.thread_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(out.turn).toBe(3);
      expect(out.input).toBe('typed');
      expect(out.length_bucket).toBe('<20');
      expect(out.secret).toBeUndefined();
      expect(out.message_text).toBeUndefined();
    });

    it('preserves UUID-shaped thread_id despite ≥7 digits (phone heuristic)', () => {
      const out = normalizeSiteEventMetadata('assistant.chat.opened', {
        thread_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        entry: 'orb',
        is_signed_in: true,
      }, 'client');
      expect(out.thread_id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(out.entry).toBe('orb');
      expect(out.is_signed_in).toBe(true);
    });

    it('preserves UUID-shaped target_id and order_id', () => {
      const out = normalizeSiteEventMetadata('assistant.deeplink.tap', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'item',
        target_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        order_id: '123e4567-e89b-12d3-a456-426614174000',
        position: 1,
      }, 'client');
      expect(out.thread_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(out.type).toBe('item');
      expect(out.target_id).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479');
      expect(out.order_id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(out.position).toBe(1);
    });

    it('strips real phone numbers from assistant events', () => {
      const out = normalizeSiteEventMetadata('assistant.message.sent', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        turn: 1,
        phone_number: '+237670000000',
        email: 'user@example.com',
      }, 'client');
      expect(out.thread_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(out.turn).toBe(1);
      expect(out.phone_number).toBeUndefined();
      expect(out.email).toBeUndefined();
    });

    it('strips non-UUID values in thread_id/target_id/order_id fields', () => {
      const out = normalizeSiteEventMetadata('assistant.chat.opened', {
        thread_id: 'not-a-uuid-12345678',
        target_id: '1234567890',
        order_id: 'short',
      }, 'client');
      // thread_id looks like phone (≥7 digits)
      expect(out.thread_id).toBeUndefined();
      // target_id looks like phone
      expect(out.target_id).toBeUndefined();
      // order_id is short (no allowlist)
      expect(out.order_id).toBeUndefined();
    });

    it('handles mixed allowlist and UUID fields', () => {
      const out = normalizeSiteEventMetadata('assistant.message.classified', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        turn: 2,
        intent: 'buy',
        confidence: 'high',
        tools_used: ['search_catalog'],
        grounded: true,
        input: 'typed',
        secret_key: 'should-be-dropped',
      }, 'client');
      expect(out.thread_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(out.turn).toBe(2);
      expect(out.intent).toBe('buy');
      expect(out.confidence).toBe('high');
      expect(out.tools_used).toEqual(['search_catalog']);
      expect(out.grounded).toBe(true);
      expect(out.input).toBe('typed');
      expect(out.secret_key).toBeUndefined();
    });
  });
});

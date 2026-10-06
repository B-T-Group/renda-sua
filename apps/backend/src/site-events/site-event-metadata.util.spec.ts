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
    it('validates enums and drops invalid values', () => {
      const out = normalizeSiteEventMetadata('assistant.message.sent', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        turn: 3,
        input: 'typed',
        intent: 'invalid_intent',
        length_bucket: '<20',
      }, 'client');
      expect(out.thread_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(out.turn).toBe(3);
      expect(out.input).toBe('typed');
      expect(out.intent).toBeUndefined(); // invalid enum dropped
      expect(out.length_bucket).toBe('<20');
    });

    it('validates booleans and drops non-boolean values', () => {
      const out = normalizeSiteEventMetadata('assistant.chat.opened', {
        thread_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        is_signed_in: true,
        has_active_order: 'yes', // invalid
        grounded: 1, // invalid
      }, 'client');
      expect(out.thread_id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(out.is_signed_in).toBe(true);
      expect(out.has_active_order).toBeUndefined();
      expect(out.grounded).toBeUndefined();
    });

    it('validates bounded integers and drops invalid numbers', () => {
      const out = normalizeSiteEventMetadata('assistant.deeplink.tap', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        turn: 5,
        position: 1,
        minutes_since_tap: -1, // negative dropped
        bad_turn: 237670000000, // too large for turn, but not in allowlist anyway
      }, 'client');
      expect(out.turn).toBe(5);
      expect(out.position).toBe(1);
      expect(out.minutes_since_tap).toBeUndefined();
      expect(out.bad_turn).toBeUndefined();
    });

    it('drops phone numbers inside tools_used array', () => {
      const out = normalizeSiteEventMetadata('assistant.message.classified', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        tools_used: ['+237 670 00 00 00', 'search_catalog', 'jean@example.com'],
      }, 'client');
      expect(out.tools_used).toEqual(['search_catalog']); // only valid tool name kept
    });

    it('drops free text in reason field', () => {
      const out = normalizeSiteEventMetadata('assistant.feedback.submitted', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        rating: 'down',
        reason: 'Other: the delivery guy was rude, my name is Jean Mbarga',
      }, 'client');
      expect(out.rating).toBe('down');
      expect(out.reason).toBeUndefined(); // free text dropped, only enum values allowed
    });

    it('drops free text in screen field', () => {
      const out = normalizeSiteEventMetadata('assistant.launcher.impression', {
        screen: 'riz parfumé 25 kg pas cher', // spaces not allowed
        variant: 'orb',
      }, 'client');
      expect(out.screen).toBeUndefined();
      expect(out.variant).toBe('orb');
    });

    it('accepts valid screen and chip_id patterns', () => {
      const out = normalizeSiteEventMetadata('assistant.chip.tap', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        screen: 'ClientBrowseHomeScreen',
        chip_id: 'track_order',
      }, 'client');
      expect(out.screen).toBe('ClientBrowseHomeScreen');
      expect(out.chip_id).toBe('track_order');
    });

    it('drops nested objects outright', () => {
      const out = normalizeSiteEventMetadata('assistant.message.sent', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        context: { message: 'I want 25kg rice at Akwa', q: 'riz parfumé' },
        input: 'typed',
      }, 'client');
      expect(out.thread_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(out.context).toBeUndefined(); // nested object dropped
      expect(out.input).toBe('typed');
    });

    it('drops phone number sent as number in turn field', () => {
      const out = normalizeSiteEventMetadata('assistant.message.sent', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        turn: 237670000000, // phone as number, out of bounds
      }, 'client');
      expect(out.turn).toBeUndefined();
    });

    it('preserves UUID-shaped IDs and validates gate fields', () => {
      const out = normalizeSiteEventMetadata('assistant.chat.opened', {
        thread_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        entry: 'orb',
        persona: 'guest',
        market: 'CM',
        locale: 'fr',
        channel: 'app',
      }, 'client');
      expect(out.thread_id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(out.entry).toBe('orb');
      expect(out.persona).toBe('guest');
      expect(out.market).toBe('CM');
      expect(out.locale).toBe('fr');
      expect(out.channel).toBe('app');
    });

    it('validates feedback fields', () => {
      const out = normalizeSiteEventMetadata('assistant.feedback.submitted', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        rating: 'down',
        reason: 'wrong_price',
        shown_price: 18500,
        currency: 'XAF',
        shown_stock_bucket: 'in',
      }, 'client');
      expect(out.shown_price).toBe(18500);
      expect(out.currency).toBe('XAF');
      expect(out.shown_stock_bucket).toBe('in');
    });

    it('caps tools_used array at 10 elements', () => {
      const manyTools = Array(15).fill('search_catalog');
      const out = normalizeSiteEventMetadata('assistant.message.classified', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        tools_used: manyTools,
      }, 'client');
      expect(out.tools_used).toHaveLength(10);
    });

    it('preserves valid tool names and drops invalid ones', () => {
      const out = normalizeSiteEventMetadata('assistant.message.classified', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        tools_used: ['search_catalog', 'invalid_tool', 'get_my_addresses', 'hack'],
      }, 'client');
      expect(out.tools_used).toEqual(['search_catalog', 'get_my_addresses']);
    });

    it('validates server-only assistant events correctly', () => {
      // assistant.message.classified is server-only
      const out = normalizeSiteEventMetadata('assistant.message.classified', {
        thread_id: '550e8400-e29b-41d4-a716-446655440000',
        turn: 2,
        intent: 'buy',
        persona: 'client',
        market: 'CM',
      }, 'server');
      expect(out.thread_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(out.intent).toBe('buy');
      expect(out.persona).toBe('client');
      expect(out.market).toBe('CM');
    });
  });
});

import {
  acceptanceDigestDedupeKey,
  merchantOrderCreatedSmsBody,
  merchantOrderReminderSmsBody,
  merchantOrderWhatsAppBurstSince,
  merchantOrderWhatsAppTemplateKey,
  merchantPushSmsChannels,
  pendingOrdersDigestPushMessage,
  phonesEqual,
  recentOrderWhatsAppMatch,
} from './merchant-order-notify.util';

describe('merchant-order-notify.util', () => {
  it('prefers action template when requested', () => {
    expect(merchantOrderWhatsAppTemplateKey(true)).toBe('order_action_business');
    expect(merchantOrderWhatsAppTemplateKey(false)).toBe(
      'order_created_business'
    );
  });

  it('builds created and reminder SMS copy', () => {
    expect(merchantOrderCreatedSmsBody({ orderNumber: 'ORD-1', locale: 'en', acceptanceTimeoutSeconds: 1800 })).toContain('ORD-1');
    expect(merchantOrderReminderSmsBody({ orderNumber: 'ORD-1', locale: 'fr', remainingSeconds: 300 })).toContain('ORD-1');
  });

  it('builds a 10-minute burst window and a business digest key', () => {
    const now = Date.parse('2026-09-26T12:00:00.000Z');
    expect(merchantOrderWhatsAppBurstSince(now)).toBe('2026-09-26T11:50:00.000Z');
    expect(acceptanceDigestDedupeKey('biz-1', now)).toBe(
      acceptanceDigestDedupeKey('biz-1', now + 60_000)
    );
    expect(acceptanceDigestDedupeKey('biz-1', now)).not.toBe(
      acceptanceDigestDedupeKey('biz-2', now)
    );
  });

  it('matches a recent WhatsApp by user or phone and skips an empty lookup', () => {
    expect(recentOrderWhatsAppMatch({})).toEqual([]);
    expect(recentOrderWhatsAppMatch({ userId: ' user-1 ' })).toEqual([
      { user_id: { _eq: 'user-1' } },
    ]);
    expect(recentOrderWhatsAppMatch({ phone: '+237650000000' })).toEqual([
      { meta: { _contains: { phone: '237650000000' } } },
    ]);
  });

  it('omits WhatsApp and keeps push plus SMS when a burst is suppressed', () => {
    const channels = merchantPushSmsChannels({
      pushEnabled: true,
      phone: '+237650000000',
      push: {
        title: 'New order',
        body: 'Order 1',
        data: { orderId: 'order-1', event: 'order_created' },
      },
      smsBody: 'sms',
    });
    expect(channels).not.toHaveProperty('whatsapp');
    expect(channels.push?.title).toBe('New order');
    expect(channels.sms).toEqual({ to: '+237650000000', body: 'sms' });
  });

  it('describes a multi-order reminder as one waiting count', () => {
    expect(pendingOrdersDigestPushMessage(3, 'en').body).toBe(
      '3 orders are waiting'
    );
    expect(pendingOrdersDigestPushMessage(3, 'fr').body).toContain('3');
  });

  it('dedupes phones ignoring formatting', () => {
    expect(phonesEqual('+237650000000', '237650000000')).toBe(true);
    expect(phonesEqual('+237650000000', '+237650000001')).toBe(false);
    expect(phonesEqual(null, '+237650000000')).toBe(false);
  });
});

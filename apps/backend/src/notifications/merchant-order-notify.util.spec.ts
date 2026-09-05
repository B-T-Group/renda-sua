import {
  merchantOrderCreatedSmsBody,
  merchantOrderReminderSmsBody,
  merchantOrderWhatsAppTemplateKey,
  phonesEqual,
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

  it('dedupes phones ignoring formatting', () => {
    expect(phonesEqual('+237650000000', '237650000000')).toBe(true);
    expect(phonesEqual('+237650000000', '+237650000001')).toBe(false);
    expect(phonesEqual(null, '+237650000000')).toBe(false);
  });
});

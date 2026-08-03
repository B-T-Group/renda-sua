import { buildPendingPaymentCleanupDigestPushMessage } from './wallet-credit-push.messages';

describe('buildPendingPaymentCleanupDigestPushMessage', () => {
  it('builds English client digest', () => {
    const msg = buildPendingPaymentCleanupDigestPushMessage({
      orderNumbers: ['A1', 'A2'],
      preferredLanguage: 'en',
      persona: 'client',
    });
    expect(msg.title).toBe('2 orders cancelled');
    expect(msg.body).toContain('A1, A2');
  });

  it('builds French business digest', () => {
    const msg = buildPendingPaymentCleanupDigestPushMessage({
      orderNumbers: ['B1'],
      preferredLanguage: 'fr',
      persona: 'business',
    });
    expect(msg.title).toBe('Commande annulée');
    expect(msg.body).toContain('B1');
  });
});

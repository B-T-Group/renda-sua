import { buildEatInUnavailablePushMessage } from './wallet-credit-push.messages';

describe('buildEatInUnavailablePushMessage', () => {
  it('tells an unpaid customer to approve or reject the payment request', () => {
    const message = buildEatInUnavailablePushMessage({
      orderNumber: '1001',
      preferredLanguage: 'en',
      awaitingPayment: true,
    });
    expect(message.title).toBe('No table');
    expect(message.body).toContain('1001');
    expect(message.body).toMatch(/approve/i);
    expect(message.body).toMatch(/reject/i);
  });

  it('tells an already-paid customer the order will be take-out', () => {
    const message = buildEatInUnavailablePushMessage({
      orderNumber: '1001',
      preferredLanguage: 'fr',
      awaitingPayment: false,
    });
    expect(message.title).toBe('Pas de table');
    expect(message.body).toMatch(/emporter/i);
  });
});

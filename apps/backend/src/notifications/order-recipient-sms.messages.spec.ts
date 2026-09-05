import {
  smsRecipientDeliveryPin,
  smsRecipientOrderCancelled,
  smsRecipientOrderPlaced,
} from './order-recipient-sms.messages';

describe('order recipient SMS copy', () => {
  const base = {
    orderNumber: 'ORD-99',
    businessName: 'Chez Nkoghe',
    payerName: 'Marie Obame',
    locale: 'en' as const,
  };

  it('falls back to a generic sender when the payer name is blank', () => {
    expect(
      smsRecipientOrderPlaced({ ...base, payerName: '   ', locale: 'en' })
    ).toContain('someone you know placed an order for you at Chez Nkoghe');
    expect(
      smsRecipientOrderPlaced({ ...base, payerName: null, locale: 'fr' })
    ).toContain('un proche a commandé pour vous chez Chez Nkoghe');
  });

  it('tells the recipient the payer was notified on cancel', () => {
    expect(smsRecipientOrderCancelled(base)).toContain(
      'Marie Obame has been notified'
    );
    expect(smsRecipientOrderCancelled({ ...base, locale: 'fr' })).toContain(
      'Marie Obame a été prévenu'
    );
  });

  it('sends the PIN without naming the payer', () => {
    const en = smsRecipientDeliveryPin(base, '4821');
    const fr = smsRecipientDeliveryPin({ ...base, locale: 'fr' }, '4821');

    expect(en).toContain('4821');
    expect(en).toContain('ORD-99');
    expect(en).not.toContain('Marie Obame');
    expect(fr).toContain('4821');
    expect(fr).not.toContain('Marie Obame');
  });
});

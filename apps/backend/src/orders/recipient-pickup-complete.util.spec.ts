import {
  canRecipientCompletePickup,
  isRecipientCompleteButton,
  recipientCompleteLocale,
  recipientCompleteReply,
} from './recipient-pickup-complete.util';

const ready = {
  is_diaspora_order: true,
  fulfillment_method: 'pickup',
  current_status: 'ready_for_pickup',
  payment_status: 'authorized',
};

describe('canRecipientCompletePickup', () => {
  it('allows a paid diaspora store pickup that is ready', () => {
    expect(canRecipientCompletePickup(ready)).toBe(true);
    expect(canRecipientCompletePickup({ ...ready, payment_status: 'paid' })).toBe(
      true
    );
  });

  it('refuses delivery, local, unpaid, and not-ready orders', () => {
    expect(
      canRecipientCompletePickup({ ...ready, fulfillment_method: 'delivery' })
    ).toBe(false);
    expect(canRecipientCompletePickup({ ...ready, is_diaspora_order: false })).toBe(
      false
    );
    expect(canRecipientCompletePickup({ ...ready, payment_status: 'pending' })).toBe(
      false
    );
    expect(
      canRecipientCompletePickup({ ...ready, current_status: 'preparing' })
    ).toBe(false);
    expect(
      canRecipientCompletePickup({ ...ready, is_diaspora_order: null })
    ).toBe(false);
    expect(canRecipientCompletePickup({ ...ready, payment_status: null })).toBe(
      false
    );
  });
});

describe('recipient complete button', () => {
  it('matches the template button and not a typed complete', () => {
    expect(isRecipientCompleteButton('complete_order')).toBe(true);
    expect(isRecipientCompleteButton('Complete order', 'Complete order')).toBe(
      true
    );
    expect(isRecipientCompleteButton(undefined, 'Terminer la commande')).toBe(
      true
    );
    expect(isRecipientCompleteButton('COMPLETE')).toBe(false);
    expect(isRecipientCompleteButton('complete')).toBe(false);
    expect(isRecipientCompleteButton('  terminer_la_commande  ')).toBe(true);
    expect(isRecipientCompleteButton('   ', '   ')).toBe(false);
  });

  it('replies in French for a trimmed Central African country code', () => {
    expect(recipientCompleteLocale(' ga ')).toBe('fr');
    expect(recipientCompleteLocale('cm')).toBe('fr');
    expect(recipientCompleteLocale('CI')).toBe('fr');
    expect(recipientCompleteLocale('SN')).toBe('fr');
    expect(recipientCompleteLocale('US')).toBe('en');
    expect(recipientCompleteLocale('')).toBe('en');
    expect(recipientCompleteLocale(null)).toBe('en');
  });

  it('confirms payment in the fulfillment language', () => {
    expect(recipientCompleteReply('completed', 'en', 'ORD-1')).toContain(
      'store has been paid'
    );
    expect(recipientCompleteReply('already_complete', 'fr', 'ORD-1')).toContain(
      'déjà terminée'
    );
    expect(recipientCompleteReply('not_allowed', 'fr')).toContain(
      'ne peut pas être terminée'
    );
    expect(recipientCompleteReply('failed', 'en', '   ')).not.toContain('null');
    expect(recipientCompleteReply('unmatched', 'en', null)).not.toContain(
      '{{orderNumber}}'
    );
  });
});

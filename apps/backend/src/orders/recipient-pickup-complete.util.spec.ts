import {
  canRecipientCompletePickup,
  isRecipientCompleteButton,
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
  });

  it('confirms payment in the fulfillment language', () => {
    expect(recipientCompleteReply('completed', 'en', 'ORD-1')).toContain(
      'store has been paid'
    );
    expect(recipientCompleteReply('already_complete', 'fr', 'ORD-1')).toContain(
      'déjà terminée'
    );
  });
});

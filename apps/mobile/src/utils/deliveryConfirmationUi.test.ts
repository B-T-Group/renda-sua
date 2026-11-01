import {
  agentWaitingCopy,
  clientCanShowConfirmReceipt,
  clientShowPendingAutoCompleteNotice,
  resolveUsesLegacyPin,
  shouldFetchDeliveryConfirmation,
} from './deliveryConfirmationUi';

describe('clientCanShowConfirmReceipt', () => {
  it('shows confirm for the buyer on a regular delivery', () => {
    expect(
      clientCanShowConfirmReceipt({
        status: 'awaiting_client_confirmation',
        fulfillmentMethod: 'delivery',
        isGift: false,
      })
    ).toBe(true);
  });

  it('allows confirm from out_for_delivery when the agent has not marked delivered', () => {
    expect(
      clientCanShowConfirmReceipt({
        status: 'out_for_delivery',
        fulfillmentMethod: 'delivery',
      })
    ).toBe(true);
  });

  it('hides confirm for gift buyers until GET giftBuyerCanConfirm is true', () => {
    expect(
      clientCanShowConfirmReceipt({
        status: 'awaiting_client_confirmation',
        fulfillmentMethod: 'delivery',
        isGift: true,
        giftBuyerCanConfirm: null,
      })
    ).toBe(false);
    expect(
      clientCanShowConfirmReceipt({
        status: 'awaiting_client_confirmation',
        fulfillmentMethod: 'delivery',
        isGift: true,
        giftBuyerCanConfirm: false,
      })
    ).toBe(false);
    expect(
      clientCanShowConfirmReceipt({
        status: 'pending_auto_complete',
        fulfillmentMethod: 'delivery',
        isGift: true,
        giftBuyerCanConfirm: true,
      })
    ).toBe(true);
  });

  it('keeps mid-flight PIN orders on Send PIN and hides Confirm', () => {
    expect(
      clientCanShowConfirmReceipt({
        status: 'out_for_delivery',
        fulfillmentMethod: 'delivery',
        usesLegacyPin: true,
      })
    ).toBe(false);
    expect(
      clientCanShowConfirmReceipt({
        status: 'out_for_delivery',
        fulfillmentMethod: 'delivery',
        usesLegacyPin: false,
      })
    ).toBe(true);
  });

  it('hides confirm for pickup and shipping', () => {
    expect(
      clientCanShowConfirmReceipt({
        status: 'awaiting_client_confirmation',
        fulfillmentMethod: 'pickup',
      })
    ).toBe(false);
    expect(
      clientCanShowConfirmReceipt({
        status: 'shipped',
        fulfillmentMethod: 'shipping',
      })
    ).toBe(false);
  });
});

describe('resolveUsesLegacyPin', () => {
  it('is true only when GET says usesLegacyPin', () => {
    expect(resolveUsesLegacyPin(undefined)).toBe(false);
    expect(resolveUsesLegacyPin({ usesLegacyPin: false })).toBe(false);
    expect(resolveUsesLegacyPin({ usesLegacyPin: true })).toBe(true);
  });
});

describe('clientShowPendingAutoCompleteNotice', () => {
  it('requires pending_auto_complete and at least one photo', () => {
    expect(
      clientShowPendingAutoCompleteNotice({
        status: 'pending_auto_complete',
        photos: [],
      })
    ).toBe(false);
    expect(
      clientShowPendingAutoCompleteNotice({
        status: 'pending_auto_complete',
        photos: [
          {
            photoUrl: 'https://example.com/p.jpg',
            capturedAt: '2026-10-31T00:00:00Z',
            latitude: 0,
            longitude: 0,
            agentId: 'ag',
          },
        ],
      })
    ).toBe(true);
  });
});

describe('agentWaitingCopy', () => {
  it('uses non-Stripe copy only for that message key', () => {
    expect(agentWaitingCopy('agent.nonstripe').i18nKey).toBe(
      'orders.clientConfirm.agentNonstripe'
    );
    expect(agentWaitingCopy('agent.fallback.cta').i18nKey).toBe(
      'orders.clientConfirm.agentWaiting'
    );
    expect(agentWaitingCopy('agent.waiting').i18nKey).toBe(
      'orders.clientConfirm.agentWaiting'
    );
  });
});

describe('shouldFetchDeliveryConfirmation', () => {
  it('fetches for doorstep confirm statuses only', () => {
    expect(shouldFetchDeliveryConfirmation('out_for_delivery', 'delivery')).toBe(
      true
    );
    expect(shouldFetchDeliveryConfirmation('ready_for_pickup', 'delivery')).toBe(
      false
    );
    expect(
      shouldFetchDeliveryConfirmation('awaiting_client_confirmation', 'pickup')
    ).toBe(false);
  });

  it('still fetches disputed and arrived doorstep orders', () => {
    expect(shouldFetchDeliveryConfirmation('disputed', 'delivery')).toBe(true);
    expect(shouldFetchDeliveryConfirmation('arrived', 'delivery')).toBe(true);
    expect(shouldFetchDeliveryConfirmation('complete', 'delivery')).toBe(false);
    expect(shouldFetchDeliveryConfirmation('disputed', 'shipping')).toBe(false);
  });
});

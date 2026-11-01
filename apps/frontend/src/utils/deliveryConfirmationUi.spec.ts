import {
  agentWaitingCopy,
  clientCanShowConfirmReceipt,
  clientShowPendingAutoCompleteNotice,
  resolveUsesLegacyPin,
  shouldFetchDeliveryConfirmation,
} from './deliveryConfirmationUi';

describe('clientCanShowConfirmReceipt', () => {
  it('gates gift-buyer confirm on GET giftBuyerCanConfirm', () => {
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
        status: 'awaiting_client_confirmation',
        fulfillmentMethod: 'delivery',
        isGift: true,
        giftBuyerCanConfirm: true,
      })
    ).toBe(true);
  });

  it('shows confirm for a non-gift client from out_for_delivery', () => {
    expect(
      clientCanShowConfirmReceipt({
        status: 'out_for_delivery',
        fulfillmentMethod: 'delivery',
        isGift: false,
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
});

describe('resolveUsesLegacyPin', () => {
  it('hides doorstep PIN unless GET usesLegacyPin is true', () => {
    expect(resolveUsesLegacyPin(undefined)).toBe(false);
    expect(resolveUsesLegacyPin({ usesLegacyPin: false })).toBe(false);
    expect(resolveUsesLegacyPin({ usesLegacyPin: true })).toBe(true);
  });
});

describe('client confirm visibility edges', () => {
  it('hides confirm for pickup, shipping, and a gift flag that is not true', () => {
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
    expect(
      clientCanShowConfirmReceipt({
        status: 'awaiting_client_confirmation',
        fulfillmentMethod: 'delivery',
        isGift: true,
        giftBuyerCanConfirm: null,
      })
    ).toBe(false);
  });

  it('shows the auto-complete notice only with a photo on that status', () => {
    expect(clientShowPendingAutoCompleteNotice(null)).toBe(false);
    expect(
      clientShowPendingAutoCompleteNotice({
        status: 'pending_auto_complete',
        photos: [],
      })
    ).toBe(false);
    expect(
      clientShowPendingAutoCompleteNotice({
        status: 'awaiting_client_confirmation',
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

  it('uses non-Stripe waiting copy only for that message key', () => {
    expect(agentWaitingCopy('agent.nonstripe').i18nKey).toBe(
      'orders.clientConfirm.agentNonstripe'
    );
    expect(agentWaitingCopy('agent.fallback.cta').i18nKey).toBe(
      'orders.clientConfirm.agentWaiting'
    );
    expect(agentWaitingCopy(null).fallback).toBe(
      'Waiting for the client to confirm'
    );
  });

  it('fetches confirmation state for disputed and arrived doorstep orders', () => {
    expect(shouldFetchDeliveryConfirmation('disputed', 'delivery')).toBe(true);
    expect(shouldFetchDeliveryConfirmation('arrived', 'delivery')).toBe(true);
    expect(
      shouldFetchDeliveryConfirmation('pending_auto_complete', 'delivery')
    ).toBe(true);
    expect(shouldFetchDeliveryConfirmation('complete', 'delivery')).toBe(false);
    expect(shouldFetchDeliveryConfirmation('disputed', 'shipping')).toBe(false);
    expect(shouldFetchDeliveryConfirmation('disputed', 'pickup')).toBe(false);
  });
});

import {
  clientCanShowConfirmReceipt,
  resolveUsesLegacyPin,
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
});

describe('resolveUsesLegacyPin', () => {
  it('hides doorstep PIN unless GET usesLegacyPin is true', () => {
    expect(resolveUsesLegacyPin(undefined)).toBe(false);
    expect(resolveUsesLegacyPin({ usesLegacyPin: false })).toBe(false);
    expect(resolveUsesLegacyPin({ usesLegacyPin: true })).toBe(true);
  });
});

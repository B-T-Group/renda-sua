import {
  canConfirmFromStatus,
  canOverwriteFromStatus,
  graceElapsed,
  isClientConfirmDeliveryOrder,
  shouldMintDeliveryPin,
  usesLegacyDeliveryPin,
} from './client-confirm-delivery.util';

describe('client-confirm-delivery.util', () => {
  it('treats a delivery hash as mid-flight PIN', () => {
    expect(
      usesLegacyDeliveryPin({
        fulfillment_method: 'delivery',
        delivery_pin_hash: 'abc',
      })
    ).toBe(true);
    expect(
      isClientConfirmDeliveryOrder({
        fulfillment_method: 'delivery',
        delivery_pin_hash: 'abc',
      })
    ).toBe(false);
  });

  it('uses client confirm for new delivery orders without a PIN hash', () => {
    expect(
      isClientConfirmDeliveryOrder({ fulfillment_method: 'delivery' })
    ).toBe(true);
    expect(shouldMintDeliveryPin({ fulfillment_method: 'delivery' })).toBe(
      false
    );
  });

  it('never mints a doorstep PIN (pickup PIN stays on its own path)', () => {
    expect(shouldMintDeliveryPin({ fulfillment_method: 'pickup' })).toBe(false);
    expect(shouldMintDeliveryPin({ fulfillment_method: 'delivery' })).toBe(
      false
    );
    expect(
      usesLegacyDeliveryPin({
        fulfillment_method: 'pickup',
        delivery_pin_hash: 'abc',
      })
    ).toBe(false);
  });

  it('allows confirm from out_for_delivery, awaiting, and pending auto-complete', () => {
    expect(canConfirmFromStatus('out_for_delivery')).toBe(true);
    expect(canConfirmFromStatus('awaiting_client_confirmation')).toBe(true);
    expect(canConfirmFromStatus('pending_auto_complete')).toBe(true);
    expect(canConfirmFromStatus('complete')).toBe(false);
  });

  it('allows overwrite from the same active delivery statuses', () => {
    expect(canOverwriteFromStatus('awaiting_client_confirmation')).toBe(true);
    expect(canOverwriteFromStatus(' awaiting_client_confirmation ')).toBe(true);
    expect(canOverwriteFromStatus('pending_auto_complete')).toBe(true);
    expect(canOverwriteFromStatus('picked_up')).toBe(false);
  });

  it('computes grace from requested_at', () => {
    const requested = new Date('2026-10-31T12:00:00Z');
    expect(
      graceElapsed(requested.toISOString(), 5, new Date('2026-10-31T12:04:00Z'))
    ).toBe(false);
    expect(
      graceElapsed(requested.toISOString(), 5, new Date('2026-10-31T12:05:00Z'))
    ).toBe(true);
  });
});

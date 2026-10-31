import { describe, expect, it } from 'vitest';
import { spacing } from '../../theme/spacing';
import { clientOrderCtaClusterSpacing } from './clientOrderCtaCluster';
import {
  clientCanShowConfirmReceipt,
  resolveUsesLegacyPin,
} from '../../utils/deliveryConfirmationUi';
import { clientShowDeliveryPin } from '../../utils/clientOrderActions';
import type { Order } from '../../types/agent';

function order(partial: Partial<Order>): Order {
  return {
    id: '1',
    order_number: '64645533',
    client_id: 'c',
    business_id: 'b',
    business_location_id: 'l',
    delivery_address_id: 'a',
    tax_amount: 0,
    currency: 'CAD',
    current_status: 'out_for_delivery',
    requires_fast_delivery: false,
    fulfillment_method: 'delivery',
    payment_timing: 'pay_now',
    ...partial,
  } as Order;
}

describe('clientOrderCtaClusterSpacing', () => {
  it('keeps a visible gap between stacked CTAs and inset from the card', () => {
    expect(clientOrderCtaClusterSpacing.gap).toBe(spacing.lg);
    expect(clientOrderCtaClusterSpacing.paddingHorizontal).toBe(spacing.sm);
    expect(clientOrderCtaClusterSpacing.paddingTop).toBe(spacing.md);
    expect(clientOrderCtaClusterSpacing.paddingBottom).toBe(spacing.sm);
    expect(clientOrderCtaClusterSpacing.gap).toBeGreaterThan(spacing.md);
    expect(clientOrderCtaClusterSpacing.paddingHorizontal).toBeGreaterThan(spacing.xxs);
  });
});

describe('active order stacked PIN + confirm visibility', () => {
  it('shows both legacy PIN and confirm on out_for_delivery', () => {
    const active = order({});
    expect(clientShowDeliveryPin(active, resolveUsesLegacyPin({ usesLegacyPin: true }))).toBe(
      true
    );
    expect(
      clientCanShowConfirmReceipt({
        status: active.current_status,
        fulfillmentMethod: active.fulfillment_method,
      })
    ).toBe(true);
  });

  it('hides PIN when GET says the order is not legacy PIN', () => {
    const active = order({});
    expect(clientShowDeliveryPin(active, resolveUsesLegacyPin({ usesLegacyPin: false }))).toBe(
      false
    );
    expect(
      clientCanShowConfirmReceipt({
        status: active.current_status,
        fulfillmentMethod: active.fulfillment_method,
      })
    ).toBe(true);
  });
});

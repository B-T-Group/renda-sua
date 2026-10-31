import { describe, expect, it } from 'vitest';
import { buildDeliveryOrderViewModel } from './buildDeliveryOrderViewModel';
import type { OrderLike, OrderViewModelContext } from './types';

const ctx: OrderViewModelContext = {
  t: (_key, defaultValue, options) => {
    let text = defaultValue ?? '';
    if (!options) return text;
    for (const [key, value] of Object.entries(options)) {
      text = text.replace(`{{${key}}}`, String(value));
    }
    return text;
  },
  now: new Date('2026-01-01T00:00:00.000Z'),
};

function order(overrides: Partial<OrderLike> = {}): OrderLike {
  return {
    id: 'o1',
    order_number: 'RS-1',
    current_status: 'assigned_to_agent',
    currency: 'XAF',
    assigned_agent_id: 'agent-1',
    ...overrides,
  } as OrderLike;
}

describe('buildDeliveryOrderViewModel client-confirm copy', () => {
  it('hides PIN required unless uses_legacy_pin is true', () => {
    expect(
      buildDeliveryOrderViewModel(
        order({ current_status: 'out_for_delivery' }),
        ctx
      ).deliveryRequirements
    ).toEqual([]);
    expect(
      buildDeliveryOrderViewModel(
        order({ current_status: 'out_for_delivery', uses_legacy_pin: true }),
        ctx
      ).deliveryRequirements
    ).toEqual([{ id: 'pin', label: 'PIN required' }]);
  });

  it('uses mark-as-delivered hero for new-flow OFD', () => {
    expect(
      buildDeliveryOrderViewModel(
        order({ current_status: 'out_for_delivery' }),
        ctx
      ).heroTitle
    ).toBe('Mark as delivered');
  });
});

describe('buildDeliveryOrderViewModel distanceLabel', () => {
  it('formats a numeric distance', () => {
    const vm = buildDeliveryOrderViewModel(order({ distance_km: 2.5 }), ctx);
    expect(vm.distanceLabel).toBe('2.5 km');
  });

  it('formats a string numeric distance without throwing', () => {
    const vm = buildDeliveryOrderViewModel(
      order({ distance_km: '3.25' as unknown as number }),
      ctx
    );
    expect(vm.distanceLabel).toBe('3.3 km');
  });

  it('omits null, undefined, and NaN', () => {
    expect(
      buildDeliveryOrderViewModel(order({ distance_km: null }), ctx).distanceLabel
    ).toBeNull();
    expect(buildDeliveryOrderViewModel(order({}), ctx).distanceLabel).toBeNull();
    expect(
      buildDeliveryOrderViewModel(order({ distance_km: Number.NaN }), ctx)
        .distanceLabel
    ).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { resolveAgentOrderPrimaryAction } from './agentOrderPrimaryAction';

const off = { markInTransit: false };
const on = { markInTransit: true };

function order(
  current_status: string,
  extra: Record<string, unknown> = {}
) {
  return {
    current_status,
    fulfillment_method: 'delivery',
    payment_timing: null,
    payment_method: null,
    pay_after_merchant_confirm: false,
    ...extra,
  };
}

describe('resolveAgentOrderPrimaryAction', () => {
  it('confirms pickup from assigned, and does not complete a shipping order inline', () => {
    expect(resolveAgentOrderPrimaryAction(order('assigned_to_agent'), off)).toBe('pickUp');
    expect(
      resolveAgentOrderPrimaryAction(
        order('assigned_to_agent', { fulfillment_method: 'shipping' }),
        off
      )
    ).toBe('openDetail');
  });

  it('skips in-transit while that step is off, and uses it when the flag is on', () => {
    expect(resolveAgentOrderPrimaryAction(order('picked_up'), off)).toBe('outForDelivery');
    expect(resolveAgentOrderPrimaryAction(order('picked_up'), on)).toBe('startTransit');
    expect(resolveAgentOrderPrimaryAction(order('in_transit'), off)).toBe('outForDelivery');
  });

  it('requests pay-at-delivery before complete, and completes pay-after and paid orders', () => {
    expect(
      resolveAgentOrderPrimaryAction(
        order('out_for_delivery', { payment_timing: 'pay_at_delivery' }),
        off
      )
    ).toBe('requestPayment');
    expect(
      resolveAgentOrderPrimaryAction(
        order('out_for_delivery', {
          payment_timing: 'pay_at_delivery',
          pay_after_merchant_confirm: true,
        }),
        off
      )
    ).toBe('completeDelivery');
    expect(resolveAgentOrderPrimaryAction(order('out_for_delivery'), off)).toBe(
      'completeDelivery'
    );
  });

  it('does not complete or pick up a status the home card does not own', () => {
    expect(resolveAgentOrderPrimaryAction(order('awaiting_client_confirmation'), off)).toBe(
      'openDetail'
    );
    expect(resolveAgentOrderPrimaryAction(order('ready_for_pickup'), off)).toBe('openDetail');
    expect(resolveAgentOrderPrimaryAction(order(''), off)).toBe('openDetail');
  });
});

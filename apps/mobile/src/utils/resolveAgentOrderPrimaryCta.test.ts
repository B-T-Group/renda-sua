import { resolveAgentOrderPrimaryCta } from './resolveAgentOrderPrimaryCta';

describe('resolveAgentOrderPrimaryCta', () => {
  it('claims an unassigned ready order and hides the footer when suspended', () => {
    expect(
      resolveAgentOrderPrimaryCta({
        status: 'ready_for_pickup',
        assignedAgentId: null,
      })
    ).toBe('claim');
    expect(
      resolveAgentOrderPrimaryCta({
        status: 'ready_for_pickup',
        assignedAgentId: null,
        agentSuspended: true,
      })
    ).toBeNull();
  });

  it('follows claim → pickup → out for delivery → mark delivered', () => {
    expect(
      resolveAgentOrderPrimaryCta({
        status: 'assigned_to_agent',
        assignedAgentId: 'ag-1',
      })
    ).toBe('pickUp');
    expect(
      resolveAgentOrderPrimaryCta({
        status: 'picked_up',
        assignedAgentId: 'ag-1',
      })
    ).toBe('outForDelivery');
    expect(
      resolveAgentOrderPrimaryCta({
        status: 'in_transit',
        assignedAgentId: 'ag-1',
      })
    ).toBe('outForDelivery');
    expect(
      resolveAgentOrderPrimaryCta({
        status: 'out_for_delivery',
        assignedAgentId: 'ag-1',
      })
    ).toBe('markDelivered');
  });

  it('uses request payment as the only CTA when pay-at-delivery is due', () => {
    expect(
      resolveAgentOrderPrimaryCta({
        status: 'out_for_delivery',
        assignedAgentId: 'ag-1',
        needsPayAtDeliveryActions: true,
      })
    ).toBe('requestPayment');
  });

  it('hides the sticky footer in terminal states', () => {
    expect(resolveAgentOrderPrimaryCta({ status: 'delivered', assignedAgentId: 'ag-1' })).toBeNull();
    expect(resolveAgentOrderPrimaryCta({ status: 'complete', assignedAgentId: 'ag-1' })).toBeNull();
    expect(resolveAgentOrderPrimaryCta({ status: 'cancelled' })).toBeNull();
    expect(resolveAgentOrderPrimaryCta({ status: 'failed', assignedAgentId: 'ag-1' })).toBeNull();
  });
});

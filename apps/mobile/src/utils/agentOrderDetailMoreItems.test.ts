import { agentOrderDetailMoreItems } from './agentOrderDetailMoreItems';

describe('agentOrderDetailMoreItems', () => {
  it('hides every item (and thus ⋯) on an unclaimed ready order', () => {
    expect(
      agentOrderDetailMoreItems({
        status: 'ready_for_pickup',
        assignedAgentId: null,
      })
    ).toEqual([]);
  });

  it('shows running late, release, and report while assigned before pickup', () => {
    expect(
      agentOrderDetailMoreItems({
        status: 'assigned_to_agent',
        assignedAgentId: 'ag-1',
      })
    ).toEqual(['runningLate', 'release', 'reportIssue']);
  });

  it('hides running late after a pickup extension', () => {
    expect(
      agentOrderDetailMoreItems({
        status: 'assigned_to_agent',
        assignedAgentId: 'ag-1',
        pickupExtensionMinutes: 15,
      })
    ).toEqual(['release', 'reportIssue']);
  });

  it('hides running late and release after pickup', () => {
    expect(
      agentOrderDetailMoreItems({
        status: 'picked_up',
        assignedAgentId: 'ag-1',
      })
    ).toEqual(['reportIssue']);
    expect(
      agentOrderDetailMoreItems({
        status: 'in_transit',
        assignedAgentId: 'ag-1',
      })
    ).toEqual(['reportIssue']);
  });

  it('adds fail delivery (and cash exception when needed) out for delivery', () => {
    expect(
      agentOrderDetailMoreItems({
        status: 'out_for_delivery',
        assignedAgentId: 'ag-1',
      })
    ).toEqual(['reportIssue', 'failDelivery']);
    expect(
      agentOrderDetailMoreItems({
        status: 'out_for_delivery',
        assignedAgentId: 'ag-1',
        needsPayAtDeliveryActions: true,
      })
    ).toEqual(['reportIssue', 'failDelivery', 'markPaidCash']);
    expect(
      agentOrderDetailMoreItems({
        status: 'out_for_delivery',
        assignedAgentId: 'ag-1',
        needsPayAtDeliveryActions: true,
        cashExceptionBlocked: true,
      })
    ).toEqual(['reportIssue', 'failDelivery']);
  });

  it('keeps report while waiting for client confirmation', () => {
    expect(
      agentOrderDetailMoreItems({
        status: 'awaiting_client_confirmation',
        assignedAgentId: 'ag-1',
      })
    ).toEqual(['reportIssue']);
    expect(
      agentOrderDetailMoreItems({
        status: 'pending_auto_complete',
        assignedAgentId: 'ag-1',
      })
    ).toEqual(['reportIssue']);
  });

  it('keeps report after delivery and hides release', () => {
    expect(
      agentOrderDetailMoreItems({
        status: 'delivered',
        assignedAgentId: 'ag-1',
      })
    ).toEqual(['reportIssue']);
    expect(
      agentOrderDetailMoreItems({
        status: 'complete',
        assignedAgentId: 'ag-1',
      })
    ).toEqual(['reportIssue']);
  });
});

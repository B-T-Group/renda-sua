import { resolveAgentOrderPrimaryCta } from './resolveAgentOrderPrimaryCta';

describe('resolveAgentOrderPrimaryCta', () => {
  it('uses mark delivered at the door, not PIN, for new-flow orders', () => {
    expect(
      resolveAgentOrderPrimaryCta({
        status: 'out_for_delivery',
        assignedAgentId: 'ag-1',
      })
    ).toBe('markDelivered');
  });

  it('shows request payment when pay-at-delivery is still due', () => {
    expect(
      resolveAgentOrderPrimaryCta({
        status: 'out_for_delivery',
        assignedAgentId: 'ag-1',
        needsPayAtDeliveryActions: true,
      })
    ).toBe('requestPayment');
  });

  it('shows Client could not confirm only when GET canSubmitFallback is true', () => {
    expect(
      resolveAgentOrderPrimaryCta({
        status: 'awaiting_client_confirmation',
        assignedAgentId: 'ag-1',
        canSubmitFallback: true,
      })
    ).toBe('clientCouldNotConfirm');
    expect(
      resolveAgentOrderPrimaryCta({
        status: 'awaiting_client_confirmation',
        assignedAgentId: 'ag-1',
        canSubmitFallback: false,
      })
    ).toBeNull();
  });

  it('hides fallback after photo submit (pending_auto_complete)', () => {
    expect(
      resolveAgentOrderPrimaryCta({
        status: 'pending_auto_complete',
        assignedAgentId: 'ag-1',
        canSubmitFallback: true,
      })
    ).toBeNull();
  });
});

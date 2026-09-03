import { WhatsAppOrderActionService } from './whatsapp-order-action.service';

describe('WhatsAppOrderActionService', () => {
  const hasura = { executeQuery: jest.fn() };
  const orders = { confirmOrder: jest.fn(), cancelOrder: jest.fn() };
  const acceptance = { markBusy: jest.fn() };
  const service = new WhatsAppOrderActionService(
    hasura as any,
    orders as any,
    acceptance as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns unknown when phone is not linked', async () => {
    hasura.executeQuery.mockResolvedValueOnce({ users: [] });
    hasura.executeQuery.mockResolvedValueOnce({ business_locations: [] });
    const result = await service.handleAction({
      fromPhone: '237600000000',
      action: 'CONFIRM',
    });
    expect(result.handled).toBe(false);
    expect(result.message).toMatch(/not linked/i);
  });

  it('confirms ASAP pending order for business owner', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        users: [{ id: 'u1', business: { id: 'b1' }, location_delegations: [] }],
      })
      .mockResolvedValueOnce({
        orders: [
          {
            id: 'o1',
            order_number: 'ORD-1',
            business_id: 'b1',
            business_location_id: 'loc1',
            fulfillment_timing: 'asap',
            fulfillment_method: 'pickup',
            acceptance_state: 'awaiting_acceptance',
            delivery_time_windows: [],
          },
        ],
      });
    orders.confirmOrder.mockResolvedValue({ success: true });
    const result = await service.handleAction({
      fromPhone: '+237600000000',
      action: 'CONFIRM',
    });
    expect(orders.confirmOrder).toHaveBeenCalled();
    expect(result.handled).toBe(true);
    expect(result.message).toMatch(/confirmed/i);
  });

  it('asks to open app for slotted orders', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        users: [{ id: 'u1', business: { id: 'b1' }, location_delegations: [] }],
      })
      .mockResolvedValueOnce({
        orders: [
          {
            id: 'o1',
            order_number: 'ORD-2',
            business_id: 'b1',
            business_location_id: 'loc1',
            fulfillment_timing: 'scheduled',
            fulfillment_method: 'delivery',
            acceptance_state: 'awaiting_acceptance',
            delivery_time_windows: [{ id: 'w1' }],
          },
        ],
      });
    const result = await service.handleAction({
      fromPhone: '237600000000',
      action: 'CONFIRM',
    });
    expect(orders.confirmOrder).not.toHaveBeenCalled();
    expect(result.message).toMatch(/time slot/i);
  });

  it('matches location alert phone ignoring formatting', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({ users: [] })
      .mockResolvedValueOnce({
        business_locations: [
          {
            id: 'loc1',
            business_id: 'b1',
            order_alert_phone: '+237 650 00 00 00',
            business: { user_id: 'owner-1' },
          },
        ],
      })
      .mockResolvedValueOnce({
        orders: [
          {
            id: 'o1',
            order_number: 'ORD-3',
            business_id: 'b1',
            business_location_id: 'loc1',
            fulfillment_timing: 'asap',
            fulfillment_method: 'pickup',
            acceptance_state: 'awaiting_acceptance',
            delivery_time_windows: [],
          },
        ],
      });
    orders.confirmOrder.mockResolvedValue({ success: true });
    const result = await service.handleAction({
      fromPhone: '237650000000',
      action: 'CONFIRM',
    });
    expect(result.handled).toBe(true);
    expect(orders.confirmOrder).toHaveBeenCalled();
  });

  it('marks owner order busy from WhatsApp', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        users: [{ id: 'u1', business: { id: 'b1' }, location_delegations: [] }],
      })
      .mockResolvedValueOnce({
        orders: [
          ownerOrder({ fulfillment_timing: 'asap', fulfillment_method: 'pickup' }),
        ],
      });
    acceptance.markBusy.mockResolvedValue({ success: true });
    const result = await service.handleAction({
      fromPhone: '237600000000',
      action: 'BUSY',
    });
    expect(acceptance.markBusy).toHaveBeenCalledWith('o1', { userId: 'u1' });
    expect(result.message).toMatch(/extra prep time/i);
  });

  it('declines the oldest pending order for the owner', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        users: [{ id: 'u1', business: { id: 'b1' }, location_delegations: [] }],
      })
      .mockResolvedValueOnce({
        orders: [ownerOrder({ fulfillment_timing: 'asap' })],
      });
    orders.cancelOrder.mockResolvedValue({ success: true });
    const result = await service.handleAction({
      fromPhone: '237600000000',
      action: 'DECLINE',
    });
    expect(orders.cancelOrder).toHaveBeenCalledWith(
      { orderId: 'o1', notes: 'Declined from WhatsApp' },
      { userId: 'u1', businessId: 'b1', locationId: 'loc1' }
    );
    expect(result.message).toMatch(/declined/i);
  });

  it('tells the merchant there is nothing waiting', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        users: [{ id: 'u1', business: { id: 'b1' }, location_delegations: [] }],
      })
      .mockResolvedValueOnce({ orders: [] });
    const result = await service.handleAction({
      fromPhone: '237600000000',
      action: 'CONFIRM',
    });
    expect(result.handled).toBe(true);
    expect(result.message).toMatch(/no order waiting/i);
    expect(orders.confirmOrder).not.toHaveBeenCalled();
  });

  it('maps a confirm conflict to already-processed copy', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        users: [{ id: 'u1', business: { id: 'b1' }, location_delegations: [] }],
      })
      .mockResolvedValueOnce({
        orders: [ownerOrder({ fulfillment_timing: 'asap' })],
      });
    orders.confirmOrder.mockRejectedValue({
      status: 409,
      message: 'Order is no longer awaiting merchant acceptance',
    });
    const result = await service.handleAction({
      fromPhone: '237600000000',
      action: 'CONFIRM',
    });
    expect(result.message).toMatch(/no longer awaiting confirmation/i);
  });

  it('does not confirm shipping without a time slot from WhatsApp', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        users: [{ id: 'u1', business: { id: 'b1' }, location_delegations: [] }],
      })
      .mockResolvedValueOnce({
        orders: [
          ownerOrder({
            fulfillment_timing: 'scheduled',
            fulfillment_method: 'shipping',
            delivery_time_windows: [],
          }),
        ],
      });
    const result = await service.handleAction({
      fromPhone: '237600000000',
      action: 'CONFIRM',
    });
    expect(orders.confirmOrder).not.toHaveBeenCalled();
    expect(result.message).toMatch(/time slot/i);
  });

  it('lets a location manager confirm and scopes pending to their store', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        users: [
          {
            id: 'd1',
            business: null,
            location_delegations: [
              {
                business_location_id: 'loc1',
                business_location: { business_id: 'b1' },
                role: {
                  role_permissions: [{ permission: { key: 'delegation.orders.manage' } }],
                },
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        orders: [ownerOrder({ fulfillment_timing: 'asap' })],
      });
    orders.confirmOrder.mockResolvedValue({ success: true });
    const result = await service.handleAction({
      fromPhone: '237600000000',
      action: 'CONFIRM',
    });
    expect(String(hasura.executeQuery.mock.calls[1][0])).toContain('WaPendingLoc');
    expect(hasura.executeQuery.mock.calls[1][1]).toEqual({
      bid: 'b1',
      lid: 'loc1',
    });
    expect(orders.confirmOrder).toHaveBeenCalledWith(
      { orderId: 'o1', notes: 'Confirmed from WhatsApp' },
      { userId: 'd1', businessId: 'b1', locationId: 'loc1' }
    );
    expect(result.handled).toBe(true);
  });

  it('ignores a user with no business and no manage permission', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        users: [
          {
            id: 'd1',
            business: null,
            location_delegations: [
              {
                business_location_id: 'loc1',
                business_location: { business_id: 'b1' },
                role: {
                  role_permissions: [{ permission: { key: 'delegation.orders.read' } }],
                },
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({ business_locations: [] });
    const result = await service.handleAction({
      fromPhone: '237600000000',
      action: 'CONFIRM',
    });
    expect(result.handled).toBe(false);
    expect(result.message).toMatch(/not linked/i);
  });

  it('authorizes Busy from a till alert phone as the owner', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({ users: [] })
      .mockResolvedValueOnce({
        business_locations: [
          {
            id: 'loc1',
            business_id: 'b1',
            order_alert_phone: '237650000000',
            business: { user_id: 'owner-1' },
          },
        ],
      })
      .mockResolvedValueOnce({
        orders: [ownerOrder({ fulfillment_timing: 'asap' })],
      });
    acceptance.markBusy.mockResolvedValue({ success: true });
    await service.handleAction({
      fromPhone: '237650000000',
      action: 'BUSY',
    });
    expect(acceptance.markBusy).toHaveBeenCalledWith('o1', {
      userId: 'owner-1',
      locationAlertAuthorized: true,
      asDelegateLocationId: 'loc1',
    });
  });
});

function ownerOrder(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'o1',
    order_number: 'ORD-1',
    business_id: 'b1',
    business_location_id: 'loc1',
    fulfillment_timing: 'asap',
    fulfillment_method: 'pickup',
    acceptance_state: 'awaiting_acceptance',
    delivery_time_windows: [],
    ...overrides,
  };
}

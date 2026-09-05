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

  it('confirms oldest pending across every location sharing the till phone', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({ users: [] })
      .mockResolvedValueOnce({
        business_locations: [
          {
            id: 'loc-first',
            business_id: 'b1',
            order_alert_phone: '+237650000000',
            business: { user_id: 'owner-1' },
          },
          {
            id: 'loc-second',
            business_id: 'b1',
            order_alert_phone: '237 650 00 00 00',
            business: { user_id: 'owner-1' },
          },
        ],
      })
      .mockResolvedValueOnce({
        orders: [
          {
            id: 'o-second',
            order_number: 'ORD-B',
            business_id: 'b1',
            business_location_id: 'loc-second',
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
    expect(result.message).toMatch(/ORD-B/);
    const pendingCall = hasura.executeQuery.mock.calls[2];
    expect(String(pendingCall[0])).toContain('business_location_id: { _in: $lids }');
    expect(pendingCall[1].lids).toEqual(
      expect.arrayContaining(['loc-first', 'loc-second'])
    );
    expect(orders.confirmOrder).toHaveBeenCalledWith(
      { orderId: 'o-second', notes: 'Confirmed from WhatsApp' },
      expect.objectContaining({
        businessId: 'b1',
        locationId: 'loc-second',
        userId: 'owner-1',
      })
    );
  });

  it('refuses when the till phone matches two different businesses', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({ users: [] })
      .mockResolvedValueOnce({
        business_locations: [
          {
            id: 'loc-a',
            business_id: 'biz-a',
            order_alert_phone: '237650000000',
            business: { user_id: 'owner-a' },
          },
          {
            id: 'loc-b',
            business_id: 'biz-b',
            order_alert_phone: '+237650000000',
            business: { user_id: 'owner-b' },
          },
        ],
      });

    const result = await service.handleAction({
      fromPhone: '237650000000',
      action: 'DECLINE',
    });

    expect(result.handled).toBe(true);
    expect(result.message).toMatch(/more than one business/i);
    expect(orders.cancelOrder).not.toHaveBeenCalled();
    expect(orders.confirmOrder).not.toHaveBeenCalled();
    expect(hasura.executeQuery).toHaveBeenCalledTimes(2);
  });

  it('loads pending orders for every location a delegate can manage', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        users: [
          {
            id: 'delegate-1',
            business: null,
            location_delegations: [
              {
                business_location_id: 'loc-a',
                business_location: { business_id: 'b1' },
                role: {
                  role_permissions: [{ permission: { key: 'delegation.orders.manage' } }],
                },
              },
              {
                business_location_id: 'loc-b',
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
        orders: [
          {
            id: 'o-b',
            order_number: 'ORD-DEL',
            business_id: 'b1',
            business_location_id: 'loc-b',
            fulfillment_timing: 'asap',
            fulfillment_method: 'pickup',
            acceptance_state: 'awaiting_acceptance',
            delivery_time_windows: [],
          },
        ],
      });
    orders.cancelOrder.mockResolvedValue({ success: true });

    const result = await service.handleAction({
      fromPhone: '237600000000',
      action: 'DECLINE',
    });

    expect(result.handled).toBe(true);
    const pendingCall = hasura.executeQuery.mock.calls[1];
    expect(pendingCall[1].lids).toEqual(expect.arrayContaining(['loc-a', 'loc-b']));
    expect(orders.cancelOrder).toHaveBeenCalledWith(
      { orderId: 'o-b', notes: 'Declined from WhatsApp' },
      expect.objectContaining({
        userId: 'delegate-1',
        businessId: 'b1',
        locationId: 'loc-b',
      })
    );
  });

  it('confirms the order bound to the WhatsApp context wamid', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        notification_events: [
          { entity_id: 'o-new' },
        ],
      })
      .mockResolvedValueOnce({
        orders_by_pk: {
          id: 'o-new',
          order_number: 'ORD-NEW',
          current_status: 'pending',
          acceptance_state: 'awaiting_acceptance',
          business_id: 'b1',
          business_location_id: 'loc1',
          fulfillment_timing: 'asap',
          fulfillment_method: 'pickup',
          delivery_time_windows: [],
          business_location: {
            id: 'loc1',
            business_id: 'b1',
            order_alert_phone: null,
            business: { user_id: 'u1' },
          },
        },
      })
      .mockResolvedValueOnce({
        users: [{ id: 'u1', business: { id: 'b1' }, location_delegations: [] }],
      });
    orders.confirmOrder.mockResolvedValue({ success: true });
    const result = await service.handleAction({
      fromPhone: '+237600000000',
      action: 'CONFIRM',
      contextMessageId: 'wamid.out.newer',
    });
    expect(orders.confirmOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'o-new' }),
      expect.objectContaining({ businessId: 'b1', locationId: 'loc1' })
    );
    expect(result.message).toMatch(/ORD-NEW/);
  });

  it('does not fall back to an older order when the bound order is no longer pending', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        notification_events: [{ entity_id: 'o-new' }],
      })
      .mockResolvedValueOnce({
        orders_by_pk: {
          id: 'o-new',
          order_number: 'ORD-NEW',
          current_status: 'confirmed',
          acceptance_state: 'accepted',
          business_id: 'b1',
          business_location_id: 'loc1',
          fulfillment_timing: 'asap',
          fulfillment_method: 'pickup',
          delivery_time_windows: [],
        },
      });
    const result = await service.handleAction({
      fromPhone: '+237600000000',
      action: 'DECLINE',
      contextMessageId: 'wamid.out.newer',
    });
    expect(orders.cancelOrder).not.toHaveBeenCalled();
    expect(result.message).toMatch(/ORD-NEW/);
    expect(result.message).toMatch(/no longer awaiting/i);
  });

  it('confirms the bound order when a multi-location delegate matches that store', async () => {
    const manage = (locationId: string) => ({
      business_location_id: locationId,
      business_location: { business_id: 'b1' },
      role: {
        role_permissions: [{ permission: { key: 'delegation.orders.manage' } }],
      },
    });
    hasura.executeQuery
      .mockResolvedValueOnce({
        notification_events: [{ entity_id: 'o-store-b' }],
      })
      .mockResolvedValueOnce({
        orders_by_pk: {
          id: 'o-store-b',
          order_number: 'ORD-B',
          current_status: 'pending',
          acceptance_state: 'awaiting_acceptance',
          business_id: 'b1',
          business_location_id: 'loc-b',
          fulfillment_timing: 'asap',
          fulfillment_method: 'pickup',
          delivery_time_windows: [],
          business_location: {
            id: 'loc-b',
            business_id: 'b1',
            order_alert_phone: null,
            business: { user_id: 'owner-1' },
          },
        },
      })
      .mockResolvedValueOnce({
        users: [
          {
            id: 'delegate-1',
            business: null,
            location_delegations: [manage('loc-a'), manage('loc-b')],
          },
        ],
      });
    orders.confirmOrder.mockResolvedValue({ success: true });
    const result = await service.handleAction({
      fromPhone: '+237600000000',
      action: 'CONFIRM',
      contextMessageId: 'wamid.out.store-b',
    });
    expect(orders.confirmOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'o-store-b' }),
      expect.objectContaining({
        userId: 'delegate-1',
        businessId: 'b1',
        locationId: 'loc-b',
      })
    );
    expect(result.message).toMatch(/ORD-B/);
  });

  it('confirms as a delegate when the same phone also owns a different business', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        notification_events: [{ entity_id: 'o-other' }],
      })
      .mockResolvedValueOnce({
        orders_by_pk: {
          id: 'o-other',
          order_number: 'ORD-OTHER',
          current_status: 'pending',
          acceptance_state: 'awaiting_acceptance',
          business_id: 'b-other',
          business_location_id: 'loc-other',
          fulfillment_timing: 'asap',
          fulfillment_method: 'pickup',
          delivery_time_windows: [],
          business_location: {
            id: 'loc-other',
            business_id: 'b-other',
            order_alert_phone: null,
            business: { user_id: 'owner-other' },
          },
        },
      })
      .mockResolvedValueOnce({
        users: [
          {
            id: 'u-both',
            business: { id: 'b-own' },
            location_delegations: [
              {
                business_location_id: 'loc-other',
                business_location: { business_id: 'b-other' },
                role: {
                  role_permissions: [
                    { permission: { key: 'delegation.orders.manage' } },
                  ],
                },
              },
            ],
          },
        ],
      });
    orders.confirmOrder.mockResolvedValue({ success: true });
    const result = await service.handleAction({
      fromPhone: '+237600000000',
      action: 'CONFIRM',
      contextMessageId: 'wamid.out.other',
    });
    expect(orders.confirmOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'o-other' }),
      expect.objectContaining({
        userId: 'u-both',
        businessId: 'b-other',
        locationId: 'loc-other',
      })
    );
    expect(result.message).toMatch(/ORD-OTHER/);
  });
});

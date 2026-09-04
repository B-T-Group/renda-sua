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

  it('binds via inbox payload when the outbound wamid is not in events', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({ notification_events: [] })
      .mockResolvedValueOnce({
        whatsapp_messages: [
          {
            raw_payload: {
              orderId: '11111111-1111-4111-8111-111111111111',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        orders_by_pk: boundPendingOrder('o-inbox', 'ORD-INBOX'),
      })
      .mockResolvedValueOnce({
        users: [{ id: 'u1', business: { id: 'b1' }, location_delegations: [] }],
      });
    orders.confirmOrder.mockResolvedValue({ success: true });
    const result = await service.handleAction({
      fromPhone: '+237600000000',
      action: 'CONFIRM',
      contextMessageId: 'wamid.out.inbox',
    });
    expect(orders.confirmOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'o-inbox' }),
      expect.objectContaining({ businessId: 'b1' })
    );
    expect(result.message).toMatch(/ORD-INBOX/);
  });

  it('resolves inbox orderNumber when orderId is not a uuid', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({ notification_events: [] })
      .mockResolvedValueOnce({
        whatsapp_messages: [
          {
            raw_payload: {
              orderId: 'not-a-uuid',
              variables: { orderNumber: 'ORD-NUM' },
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        orders: [{ id: 'o-num' }],
      })
      .mockResolvedValueOnce({
        orders_by_pk: boundPendingOrder('o-num', 'ORD-NUM'),
      })
      .mockResolvedValueOnce({
        users: [{ id: 'u1', business: { id: 'b1' }, location_delegations: [] }],
      });
    orders.confirmOrder.mockResolvedValue({ success: true });
    const result = await service.handleAction({
      fromPhone: '+237600000000',
      action: 'CONFIRM',
      contextMessageId: 'wamid.out.num',
    });
    expect(orders.confirmOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'o-num' }),
      expect.any(Object)
    );
    expect(result.message).toMatch(/ORD-NUM/);
  });

  it('falls through to the oldest pending order when the wamid is unknown', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({ notification_events: [] })
      .mockResolvedValueOnce({ whatsapp_messages: [] })
      .mockResolvedValueOnce({
        users: [{ id: 'u1', business: { id: 'b1' }, location_delegations: [] }],
      })
      .mockResolvedValueOnce({
        orders: [boundPendingOrder('o-old', 'ORD-OLD')],
      });
    orders.confirmOrder.mockResolvedValue({ success: true });
    const result = await service.handleAction({
      fromPhone: '+237600000000',
      action: 'CONFIRM',
      contextMessageId: 'wamid.unknown',
    });
    expect(orders.confirmOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'o-old' }),
      expect.any(Object)
    );
    expect(result.message).toMatch(/ORD-OLD/);
  });

  it('treats whitespace-only context as unbound', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        users: [{ id: 'u1', business: { id: 'b1' }, location_delegations: [] }],
      })
      .mockResolvedValueOnce({
        orders: [boundPendingOrder('o-old', 'ORD-OLD')],
      });
    orders.confirmOrder.mockResolvedValue({ success: true });
    await service.handleAction({
      fromPhone: '+237600000000',
      action: 'CONFIRM',
      contextMessageId: '   ',
    });
    expect(hasura.executeQuery.mock.calls[0][0]).toMatch(/WaActor/);
    expect(orders.confirmOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'o-old' }),
      expect.any(Object)
    );
  });

  it('does not confirm a bound order for a merchant from another store', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        notification_events: [{ entity_id: 'o-new' }],
      })
      .mockResolvedValueOnce({
        orders_by_pk: boundPendingOrder('o-new', 'ORD-NEW'),
      })
      .mockResolvedValueOnce({
        users: [{ id: 'u2', business: { id: 'b2' }, location_delegations: [] }],
      });
    const result = await service.handleAction({
      fromPhone: '+237600000000',
      action: 'CONFIRM',
      contextMessageId: 'wamid.out.newer',
    });
    expect(orders.confirmOrder).not.toHaveBeenCalled();
    expect(result.handled).toBe(false);
    expect(result.message).toMatch(/not linked/i);
  });
});

function boundPendingOrder(id: string, orderNumber: string) {
  return {
    id,
    order_number: orderNumber,
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
  };
}

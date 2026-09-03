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
});

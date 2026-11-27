import { EventEmitter2 } from '@nestjs/event-emitter';
import { ExportOrdersTransitionService } from './export-orders-transition.service';

describe('ExportOrdersTransitionService', () => {
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
  const events = { emit: jest.fn() } as unknown as EventEmitter2;
  let service: ExportOrdersTransitionService;

  const row = {
    id: 'order-1',
    status: 'SUBMITTED',
    client_user_id: 'user-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExportOrdersTransitionService(hasura as any, events);
    hasura.executeMutation.mockResolvedValue({});
  });

  it('returns 404 when the order is missing', async () => {
    hasura.executeQuery.mockResolvedValue({ export_orders_by_pk: null });
    await expect(service.getOrder('missing')).rejects.toMatchObject({
      status: 404,
      message: 'Export order not found',
    });
  });

  it('refuses a jump that the status graph does not allow', async () => {
    hasura.executeQuery.mockResolvedValue({ export_orders_by_pk: row });
    await expect(
      service.transition({
        orderId: 'order-1',
        to: 'SHIPPED',
        eventName: 'shipment.dispatched',
      })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Invalid export order transition SUBMITTED → SHIPPED',
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('writes the next status, an audit row, and the event', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({ export_orders_by_pk: row })
      .mockResolvedValueOnce({
        export_orders_by_pk: { ...row, status: 'IN_REVIEW' },
      });
    const updated = await service.transition({
      orderId: 'order-1',
      to: 'IN_REVIEW',
      eventName: 'order.review_started',
      extraSet: { bc_version: 2 },
    });
    expect(updated.status).toBe('IN_REVIEW');
    expect(hasura.executeMutation.mock.calls[0][1].set).toEqual(
      expect.objectContaining({ status: 'IN_REVIEW', bc_version: 2 })
    );
    expect(hasura.executeMutation.mock.calls[1][1].object).toEqual(
      expect.objectContaining({
        from_status: 'SUBMITTED',
        to_status: 'IN_REVIEW',
        event_name: 'order.review_started',
        actor_user_id: null,
        actor_role: null,
        payload: {},
      })
    );
    expect(events.emit).toHaveBeenCalledWith('order.review_started', {
      orderId: 'order-1',
      from: 'SUBMITTED',
      to: 'IN_REVIEW',
    });
  });
});

import { ExportOrdersFulfillmentService } from './export-orders-fulfillment.service';
import type { ExportOrderRow } from './export-orders.types';

function order(patch: Partial<ExportOrderRow> = {}): ExportOrderRow {
  return {
    id: 'order-1',
    status: 'IN_PRODUCTION',
    business_id: 'biz-1',
    ...patch,
  } as ExportOrderRow;
}

describe('ExportOrdersFulfillmentService', () => {
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
  const hasuraUser = { getUser: jest.fn() };
  const transitions = { getOrder: jest.fn(), transition: jest.fn() };
  let service: ExportOrdersFulfillmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    service = new ExportOrdersFulfillmentService(
      hasura as any,
      hasuraUser as any,
      transitions as any
    );
    hasuraUser.getUser.mockResolvedValue({
      id: 'biz-user',
      business: { id: 'biz-1' },
    });
    transitions.getOrder.mockResolvedValue(order());
    transitions.transition.mockResolvedValue(
      order({ status: 'BALANCE_REQUIRED' })
    );
    hasura.executeMutation.mockResolvedValue({});
    hasura.executeQuery.mockResolvedValue({
      export_supplier_payments_aggregate: { aggregate: { count: 1 } },
    });
  });

  it('refuses a manufacturer confirm from another business or the wrong status', async () => {
    hasuraUser.getUser.mockResolvedValue({
      id: 'other',
      business: { id: 'biz-2' },
    });
    await expect(
      service.manufacturerConfirm('order-1', { notes: 'ready' })
    ).rejects.toMatchObject({ status: 403, message: 'Forbidden' });

    hasuraUser.getUser.mockResolvedValue({
      id: 'biz-user',
      business: { id: 'biz-1' },
    });
    transitions.getOrder.mockResolvedValue(order({ status: 'SUBMITTED' }));
    await expect(
      service.manufacturerConfirm('order-1', { notes: 'ready' })
    ).rejects.toMatchObject({ status: 400, message: 'Invalid status' });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('stores a trimmed manufacturer note without moving the status', async () => {
    transitions.getOrder.mockResolvedValue(order({ status: 'MFR_QUOTE' }));
    await service.manufacturerConfirm('order-1', { notes: '  ready  ' });
    expect(hasura.executeMutation.mock.calls[0][1].object.notes).toBe('ready');
    expect(transitions.transition).not.toHaveBeenCalled();

    await service.manufacturerConfirm('order-1', { notes: '   ' });
    expect(hasura.executeMutation.mock.calls[1][1].object.notes).toBeNull();
  });

  it('lets only the owning business open the balance, and lets an admin do it too', async () => {
    hasuraUser.getUser.mockResolvedValue({ id: 'biz-user', business: null });
    await expect(service.markReady('order-1')).rejects.toMatchObject({
      status: 403,
    });
    hasuraUser.getUser.mockResolvedValue({
      id: 'biz-user',
      business: { id: 'biz-2' },
    });
    await expect(service.markReady('order-1')).rejects.toMatchObject({
      status: 403,
    });
    transitions.getOrder.mockResolvedValue(order({ status: 'MFR_QUOTE' }));
    hasuraUser.getUser.mockResolvedValue({
      id: 'biz-user',
      business: { id: 'biz-1' },
    });
    await expect(service.markReady('order-1')).rejects.toMatchObject({
      status: 400,
      message: 'Must be IN_PRODUCTION',
    });
    expect(transitions.transition).not.toHaveBeenCalled();

    transitions.getOrder.mockResolvedValue(order());
    await service.markReady('order-1');
    expect(transitions.transition.mock.calls.map((call) => call[0].to)).toEqual(
      ['READY', 'BALANCE_REQUIRED']
    );

    transitions.transition.mockClear();
    hasuraUser.getUser.mockResolvedValue({ id: 'admin-1' });
    await service.adminMarkReady('order-1');
    expect(
      transitions.transition.mock.calls.map((call) => call[0].actorRole)
    ).toEqual(['admin', 'system']);
  });

  it('refuses to ship until the client has paid or financed and the supplier balance is paid', async () => {
    transitions.getOrder.mockResolvedValue(order({ status: 'READY' }));
    await expect(
      service.ship('order-1', { trackingNumber: 'TRK' })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Pay or finance balance before shipping',
    });
    expect(hasura.executeQuery).not.toHaveBeenCalled();

    transitions.getOrder.mockResolvedValue(order({ status: 'PAID_IN_FULL' }));
    hasura.executeQuery.mockResolvedValue({
      export_supplier_payments_aggregate: null,
    });
    await expect(service.ship('order-1', {})).rejects.toMatchObject({
      status: 400,
      message: 'Manufacturer balance must be paid before SHIPPED',
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();

    hasura.executeQuery.mockResolvedValue({
      export_supplier_payments_aggregate: { aggregate: { count: 1 } },
    });
    transitions.getOrder.mockResolvedValue(order({ status: 'FINANCED_60' }));
    await service.ship('order-1', { trackingNumber: 'TRK' });
    expect(hasura.executeMutation.mock.calls[0][1].object.tracking_number).toBe(
      'TRK'
    );
    expect(transitions.transition).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'SHIPPED', actorRole: 'admin' })
    );
  });

  it('cancels only a due deposit and keeps going after one failure', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-27T15:00:00.000Z'));
    const now = '2026-11-27T15:00:00.000Z';
    hasura.executeQuery.mockResolvedValue({
      export_orders: [
        {
          id: 'submitted',
          status: 'SUBMITTED',
          deposit_due_at: '2026-11-01T00:00:00.000Z',
        },
        {
          id: 'future',
          status: 'DEPOSIT_REQUIRED',
          deposit_due_at: '2026-11-27T15:00:00.001Z',
        },
        { id: 'open', status: 'DEPOSIT_REQUIRED', deposit_due_at: null },
        { id: 'due', status: 'DEPOSIT_REQUIRED', deposit_due_at: now },
        {
          id: 'again',
          status: 'DEPOSIT_REQUIRED',
          deposit_due_at: '2026-11-27T14:00:00.000Z',
        },
      ],
    });
    transitions.transition
      .mockRejectedValueOnce(new Error('locked'))
      .mockResolvedValueOnce(order({ status: 'CANCELLED' }));

    await service.processExpiries();

    expect(hasura.executeQuery.mock.calls[0][1].statuses).toEqual([
      'SUBMITTED',
      'PROFORMA_ISSUED',
      'DEPOSIT_REQUIRED',
    ]);
    expect(
      transitions.transition.mock.calls.map((call) => call[0].orderId)
    ).toEqual(['due', 'again']);
    expect(transitions.transition.mock.calls[0][0].to).toBe('CANCELLED');
  });
});

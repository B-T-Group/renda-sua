import { OrderSettlementRetryService } from './order-settlement-retry.service';
import {
  SETTLEMENT_RETRY_MAX_ATTEMPTS,
  settlementRetryDelayMinutes,
} from './order-settlement-retry.util';

jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));

describe('settlementRetryDelayMinutes', () => {
  it('backs off exponentially and caps at 6 hours', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(settlementRetryDelayMinutes)).toEqual([
      5, 10, 20, 40, 80, 160, 320,
    ]);
    expect(settlementRetryDelayMinutes(10)).toBe(360);
    expect(SETTLEMENT_RETRY_MAX_ATTEMPTS).toBe(8);
  });
});

describe('OrderSettlementRetryService', () => {
  const NOW = new Date('2026-10-01T12:00:00Z');
  const row = (stage: 'item' | 'delivery', over = {}) => ({
    id: 'hold-1',
    order_id: 'order-1',
    settlement_failed_stage: stage,
    settlement_next_retry_at: '2026-10-01T11:55:00Z',
    ...over,
  });

  function setup(opts: {
    due: any[];
    claimRows?: number;
    orderStatus?: string;
    item?: 'settled' | 'queued_for_retry';
    delivery?: 'settled' | 'queued_for_retry';
  }) {
    const executeQuery = jest.fn(async (q: string) =>
      q.includes('SettlementRetryDue')
        ? { order_holds: opts.due }
        : { orders_by_pk: { current_status: opts.orderStatus ?? 'complete' } }
    );
    const executeMutation = jest.fn(async () => ({
      update_order_holds: { affected_rows: opts.claimRows ?? 1 },
    }));
    const ordersService = {
      processOrderPayment: jest.fn().mockResolvedValue(opts.item ?? 'settled'),
      processOrderDeliveryPayment: jest
        .fn()
        .mockResolvedValue(opts.delivery ?? 'settled'),
      clearSettlementFailure: jest.fn().mockResolvedValue(undefined),
    };
    const service = new OrderSettlementRetryService(
      { executeQuery, executeMutation } as never,
      ordersService as never
    );
    return { service, executeQuery, executeMutation, ordersService };
  }

  it('does nothing when no hold is due', async () => {
    const { service, ordersService } = setup({ due: [] });
    expect(await service.runOnce(NOW)).toEqual({
      claimed: 0,
      settled: 0,
      stillFailing: 0,
      skipped: 0,
    });
    expect(ordersService.processOrderPayment).not.toHaveBeenCalled();
  });

  it('leases the row (moves next_retry_at forward) before retrying', async () => {
    const { service, executeMutation } = setup({ due: [row('item')] });
    await service.runOnce(NOW);
    const vars = (executeMutation.mock.calls[0] as any[])[1];
    expect(vars.expected).toBe('2026-10-01T11:55:00Z');
    expect(vars.lease).toBe('2026-10-01T12:15:00.000Z');
  });

  it('skips a row another instance already claimed', async () => {
    const { service, ordersService } = setup({
      due: [row('item')],
      claimRows: 0,
    });
    const res = await service.runOnce(NOW);
    expect(res.skipped).toBe(1);
    expect(ordersService.processOrderPayment).not.toHaveBeenCalled();
  });

  it('item stage: retries item, then delivery when the order is complete, then clears the marker', async () => {
    const { service, ordersService } = setup({ due: [row('item')] });
    const res = await service.runOnce(NOW);
    expect(ordersService.processOrderPayment).toHaveBeenCalledWith('order-1', {
      isRetry: true,
    });
    expect(ordersService.processOrderDeliveryPayment).toHaveBeenCalledWith(
      'order-1',
      { isRetry: true }
    );
    expect(ordersService.clearSettlementFailure).toHaveBeenCalledWith('hold-1');
    expect(res.settled).toBe(1);
  });

  it('item stage: leaves delivery to the normal flow while the order is still in transit', async () => {
    const { service, ordersService } = setup({
      due: [row('item')],
      orderStatus: 'out_for_delivery',
    });
    await service.runOnce(NOW);
    expect(ordersService.processOrderDeliveryPayment).not.toHaveBeenCalled();
    expect(ordersService.clearSettlementFailure).toHaveBeenCalledWith('hold-1');
  });

  it('delivery stage: retries only delivery', async () => {
    const { service, ordersService } = setup({ due: [row('delivery')] });
    await service.runOnce(NOW);
    expect(ordersService.processOrderPayment).not.toHaveBeenCalled();
    expect(ordersService.processOrderDeliveryPayment).toHaveBeenCalledTimes(1);
    expect(ordersService.clearSettlementFailure).toHaveBeenCalled();
  });

  it('keeps the marker when the retry fails again (the settlement code re-queues with backoff)', async () => {
    const { service, ordersService } = setup({
      due: [row('item')],
      item: 'queued_for_retry',
    });
    const res = await service.runOnce(NOW);
    expect(res.stillFailing).toBe(1);
    expect(ordersService.clearSettlementFailure).not.toHaveBeenCalled();
  });

  it('keeps the marker and alerts when the retry throws unexpectedly', async () => {
    const { service, ordersService } = setup({ due: [row('item')] });
    ordersService.processOrderPayment.mockRejectedValue(new Error('bad'));
    const res = await service.runOnce(NOW);
    expect(res.stillFailing).toBe(1);
    expect(ordersService.clearSettlementFailure).not.toHaveBeenCalled();
  });
});

import {
  UNPAID_SWEEP_GRACE_MINUTES,
  UnpaidPayAfterSweeperService,
} from './unpaid-pay-after-sweeper.service';

describe('UnpaidPayAfterSweeperService', () => {
  const NOW = new Date('2026-10-01T12:00:00Z');
  const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60000).toISOString();

  const cookedRow = (id: string, confirmedMinsAgo: number) => ({
    id,
    is_cooked_food_pickup: false,
    pay_after_merchant_confirm: true,
    order_items: [{ is_cooked_food: true }],
    order_status_history: [{ created_at: minsAgo(confirmedMinsAgo) }],
  });
  const goodsRow = (id: string, confirmedMinsAgo: number) => ({
    id,
    is_cooked_food_pickup: false,
    pay_after_merchant_confirm: true,
    order_items: [{ is_cooked_food: false }],
    order_status_history: [{ created_at: minsAgo(confirmedMinsAgo) }],
  });

  function setup(rows: any[], cancel?: jest.Mock) {
    const executeQuery = jest.fn().mockResolvedValue({ orders: rows });
    const ordersService = {
      cancelUnpaidCookedFoodAfterConfirm:
        cancel ?? jest.fn().mockResolvedValue({ cancelled: true }),
    };
    const config = {
      get: jest.fn().mockReturnValue({
        cookedFoodUnpaidCancelHours: 3,
        payAfterGoodsUnpaidCancelMinutes: 45,
      }),
    };
    const service = new UnpaidPayAfterSweeperService(
      { executeQuery } as never,
      ordersService as never,
      config as never
    );
    return { service, executeQuery, ordersService };
  }

  it('queries confirmed, unpaid pay-after orders using the shorter (goods) cutoff', async () => {
    const { service, executeQuery } = setup([]);
    await service.runOnce(NOW);
    const [query, vars] = executeQuery.mock.calls[0];
    expect(query).toContain('pay_after_merchant_confirm: { _eq: true }');
    expect(query).toContain('current_status: { _eq: confirmed }');
    expect(query).toContain('payment_status: { _nin: ["paid", "authorized"] }');
    expect(vars.cutoff).toBe(minsAgo(45 + UNPAID_SWEEP_GRACE_MINUTES));
  });

  it('cancels goods after 45 min + grace but cooked food only after 3 h + grace', async () => {
    const { service, ordersService } = setup([
      goodsRow('goods-old', 61),
      goodsRow('goods-new', 30),
      cookedRow('cooked-mid', 61),
      cookedRow('cooked-old', 3 * 60 + 16),
    ]);
    const res = await service.runOnce(NOW);
    const ids = ordersService.cancelUnpaidCookedFoodAfterConfirm.mock.calls.map(
      (c: any[]) => c[0]
    );
    expect(ids).toEqual(['goods-old', 'cooked-old']);
    expect(res).toEqual({ found: 2, cancelled: 2, skipped: 0, failed: 0 });
  });

  it('ignores rows without a confirmed history entry', async () => {
    const { service, ordersService } = setup([
      { ...goodsRow('x', 120), order_status_history: [] },
    ]);
    const res = await service.runOnce(NOW);
    expect(res.found).toBe(0);
    expect(ordersService.cancelUnpaidCookedFoodAfterConfirm).not.toHaveBeenCalled();
  });

  it('counts skipped (race with timer / paid) and isolates failures', async () => {
    const cancel = jest
      .fn()
      .mockResolvedValueOnce({ cancelled: false, skipped: true, reason: 'already_paid' })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ cancelled: true });
    const { service } = setup(
      [goodsRow('a', 90), goodsRow('b', 90), goodsRow('c', 90)],
      cancel
    );
    const res = await service.runOnce(NOW);
    expect(res).toEqual({ found: 3, cancelled: 1, skipped: 1, failed: 1 });
  });
});

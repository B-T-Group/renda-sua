import {
  UNPAID_SWEEP_GRACE_MINUTES,
  UnpaidPayAfterSweeperService,
} from './unpaid-pay-after-sweeper.service';

describe('UnpaidPayAfterSweeperService', () => {
  const NOW = new Date('2026-10-01T12:00:00Z');

  function setup(ids: string[], hours = 3, cancel?: jest.Mock) {
    const executeQuery = jest.fn().mockResolvedValue({
      orders: ids.map((id) => ({ id })),
    });
    const ordersService = {
      cancelUnpaidCookedFoodAfterConfirm:
        cancel ?? jest.fn().mockResolvedValue({ cancelled: true }),
    };
    const config = {
      get: jest.fn().mockReturnValue({ cookedFoodUnpaidCancelHours: hours }),
    };
    const service = new UnpaidPayAfterSweeperService(
      { executeQuery } as never,
      ordersService as never,
      config as never
    );
    return { service, executeQuery, ordersService };
  }

  it('queries confirmed, unpaid pay-after orders confirmed before timer + grace', async () => {
    const { service, executeQuery } = setup([]);
    await service.runOnce(NOW);
    const [query, vars] = executeQuery.mock.calls[0];
    expect(query).toContain('pay_after_merchant_confirm: { _eq: true }');
    expect(query).toContain('current_status: { _eq: confirmed }');
    expect(query).toContain('payment_status: { _nin: ["paid", "authorized"] }');
    const expected = new Date(
      NOW.getTime() - (3 * 60 + UNPAID_SWEEP_GRACE_MINUTES) * 60 * 1000
    );
    expect(vars.cutoff).toBe(expected.toISOString());
  });

  it('cancels each overdue order through the guarded cancel path', async () => {
    const { service, ordersService } = setup(['a', 'b']);
    const res = await service.runOnce(NOW);
    expect(ordersService.cancelUnpaidCookedFoodAfterConfirm).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ found: 2, cancelled: 2, skipped: 0, failed: 0 });
  });

  it('counts skipped (race with timer / paid) and isolates failures', async () => {
    const cancel = jest
      .fn()
      .mockResolvedValueOnce({ cancelled: false, skipped: true, reason: 'already_paid' })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ cancelled: true });
    const { service } = setup(['a', 'b', 'c'], 3, cancel);
    const res = await service.runOnce(NOW);
    expect(res).toEqual({ found: 3, cancelled: 1, skipped: 1, failed: 1 });
  });
});

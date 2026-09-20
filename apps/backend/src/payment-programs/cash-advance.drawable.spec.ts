import { CashAdvanceService, drawableRemaining } from './cash-advance.service';

describe('drawableRemaining', () => {
  it('reduces the draw limit by the absolute cash-advance debt', () => {
    expect(drawableRemaining(10000, -2500)).toBe(7500);
    expect(drawableRemaining(10000, 0)).toBe(10000);
    expect(drawableRemaining(1000, -1000)).toBe(0);
  });
});

describe('CashAdvanceService.draw', () => {
  it('passes the facility limit so the ledger can claim capacity atomically', async () => {
    const hasura = {
      executeQuery: jest.fn(async () => ({
        cash_advance_facilities: [
          {
            id: 'f1',
            limit_amount: 10000,
            ends_at: null,
            program: { name: 'Staff' },
            account: { id: 'acc-1', cash_advance_balance: -2000 },
            user: { preferred_language: 'en' },
          },
        ],
      })),
      executeMutation: jest.fn(async () => ({
        insert_cash_advance_draws_one: { id: 'd1' },
      })),
    };
    const accounts = {
      registerTransaction: jest.fn(async () => ({
        success: true,
        transactionId: 'tx-1',
        newBalance: {
          available: 2000,
          withheld: 0,
          total: 2000,
          cashAdvance: -4000,
        },
      })),
    };
    const notifications = { sendPaymentProgramNotice: jest.fn() };
    const service = new CashAdvanceService(
      hasura as never,
      accounts as never,
      notifications as never
    );

    await service.draw('user-1', 2000, 'XAF');

    expect(accounts.registerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acc-1',
        amount: 2000,
        transactionType: 'cash_advance',
        maxCashAdvanceDebt: 10000,
      })
    );
  });
});

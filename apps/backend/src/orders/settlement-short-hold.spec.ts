jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { OrdersService } from './orders.service';

const params = {
  accountId: 'acct-1',
  orderId: 'order-1',
  amount: 5000,
  memo: 'Hold released',
  idempotencyKey: 'settle:item:release:order-1',
};

function harness(input: {
  holds: number[];
  releases?: number[];
  balance?: {
    availableBalance?: number | null;
    withheldBalance?: number | null;
  } | null;
  balanceError?: Error;
}) {
  const service = Object.create(OrdersService.prototype) as OrdersService;
  const registerTransaction = jest.fn().mockResolvedValue({
    success: false,
    error: 'Insufficient funds for this transaction',
  });
  const getAccountBalance = input.balanceError
    ? jest.fn().mockRejectedValue(input.balanceError)
    : jest.fn().mockResolvedValue(input.balance);
  (service as any).accountsService = { registerTransaction, getAccountBalance };
  (service as any).hasuraSystemService = {
    executeQuery: jest.fn(
      async (_query: string, vars?: { transactionType?: string }) => ({
        account_transactions: (
          vars?.transactionType === 'release' ? input.releases ?? [] : input.holds
        ).map((amount) => ({ amount })),
      })
    ),
  };
  (service as any).logger = {
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  };
  return { service, registerTransaction };
}

function releaseAmounts(registerTransaction: jest.Mock): number[] {
  return registerTransaction.mock.calls.map(([row]) => row.amount);
}

describe('releaseClientSettlementHold shared withheld', () => {
  it('fails closed when the balance row is missing', async () => {
    const { service, registerTransaction } = harness({
      holds: [5000],
      balance: null,
    });

    await expect(
      (service as any).releaseClientSettlementHold(params)
    ).resolves.toEqual({
      success: false,
      error: 'Insufficient funds for this transaction',
    });
    expect(releaseAmounts(registerTransaction)).toEqual([5000]);
  });

  it('fails closed when the balance read throws', async () => {
    const { service, registerTransaction } = harness({
      holds: [5000],
      balanceError: new Error('db down'),
    });

    await expect(
      (service as any).releaseClientSettlementHold(params)
    ).resolves.toEqual({
      success: false,
      error: 'Insufficient funds for this transaction',
    });
    expect(releaseAmounts(registerTransaction)).toEqual([5000]);
  });

  it('skips a second release when withheld is zero and available covers', async () => {
    const { service, registerTransaction } = harness({
      holds: [5000],
      balance: { availableBalance: 8000, withheldBalance: 0 },
    });

    await expect(
      (service as any).releaseClientSettlementHold(params)
    ).resolves.toEqual({ success: true });
    expect(releaseAmounts(registerTransaction)).toEqual([5000]);
    expect((service as any).logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('settlement_skip_unheld_release')
    );
  });

  it('skips leftover withheld that belongs to other orders when available matches', async () => {
    const { service, registerTransaction } = harness({
      holds: [5000],
      balance: { availableBalance: 5000, withheldBalance: 4500 },
    });

    await expect(
      (service as any).releaseClientSettlementHold(params)
    ).resolves.toEqual({ success: true });
    expect(releaseAmounts(registerTransaction)).toEqual([5000]);
    expect((service as any).logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('settlement_skip_consumed_hold')
    );
  });

  it('keeps the hold locked when available is one unit short of the debit', async () => {
    const { service, registerTransaction } = harness({
      holds: [5000],
      balance: { availableBalance: 4999, withheldBalance: 4500 },
    });

    await expect(
      (service as any).releaseClientSettlementHold(params)
    ).resolves.toEqual({
      success: false,
      error: 'Insufficient funds for this transaction',
    });
    expect(releaseAmounts(registerTransaction)).toEqual([5000]);
    expect((service as any).logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('settlement_keep_short_hold')
    );
  });
});

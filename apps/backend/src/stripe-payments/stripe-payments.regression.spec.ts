import { HttpException, HttpStatus } from '@nestjs/common';
import { StripePaymentsController } from './stripe-payments.controller';
import { StripePaymentsDatabaseService } from './stripe-payments-database.service';
import { StripePayoutService } from './stripe-payout.service';

describe('Stripe payments critical regressions', () => {
  const payoutParams = {
    amount: 25,
    currency: 'USD',
    accountId: 'account-1',
    userId: 'user-1',
    description: 'Withdrawal',
  };

  function createPayoutService(overrides?: {
    registerTransaction?: jest.Mock;
    createTransfer?: jest.Mock;
  }) {
    const databaseService = {
      createTransaction: jest.fn().mockResolvedValue({ id: 'tx-1' }),
      updateTransaction: jest.fn().mockResolvedValue({ id: 'tx-1' }),
    };
    const accountsService = {
      getAccountBalance: jest.fn().mockResolvedValue({ availableBalance: 100 }),
      registerTransaction:
        overrides?.registerTransaction ||
        jest.fn().mockResolvedValue({ success: true }),
    };
    const stripeService = {
      createTransfer:
        overrides?.createTransfer ||
        jest.fn().mockResolvedValue({ id: 'tr-1' }),
    };
    const connectService = {
      isPayoutReady: jest.fn().mockResolvedValue(true),
      getByUserId: jest.fn().mockResolvedValue({ stripe_account_id: 'acct_1' }),
    };

    const service = new StripePayoutService(
      databaseService as never,
      accountsService as never,
      stripeService as never,
      connectService as never,
    );

    return { service, databaseService, accountsService, stripeService };
  }

  it('rejects withdrawals for accounts the user does not own', async () => {
    const hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({ id: 'user-1' }),
      executeQuery: jest.fn().mockResolvedValue({ accounts: [] }),
    };
    const payoutService = { executePayout: jest.fn() };
    const controller = new StripePaymentsController(
      {} as never,
      {} as never,
      hasuraUserService as never,
      {} as never,
      {} as never,
      payoutService as never,
      {} as never,
    );

    await expect(
      controller.withdraw({
        amount: 10,
        currency: 'USD',
        accountId: 'victim-account',
      }),
    ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    expect(payoutService.executePayout).not.toHaveBeenCalled();
  });

  it('reprocesses duplicate webhook events that were not marked processed', async () => {
    const hasuraService = {
      executeMutation: jest
        .fn()
        .mockResolvedValue({ insert_stripe_events_one: null }),
      executeQuery: jest
        .fn()
        .mockResolvedValue({ stripe_events: [{ processed_at: null }] }),
    };
    const database = new StripePaymentsDatabaseService(hasuraService as never);

    await expect(
      database.recordEvent(
        'evt_1',
        'checkout.session.completed',
        'payments',
        {},
      ),
    ).resolves.toEqual({ shouldProcess: true, duplicate: true });
  });

  it('does not create a Stripe transfer when wallet debit fails', async () => {
    const registerTransaction = jest
      .fn()
      .mockResolvedValue({ success: false, error: 'Insufficient funds' });
    const createTransfer = jest.fn();
    const { service, databaseService } = createPayoutService({
      registerTransaction,
      createTransfer,
    });

    await expect(
      service.executePayout(payoutParams, { throwOnFailure: true }),
    ).rejects.toThrow(HttpException);

    expect(createTransfer).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-1', {
      status: 'failed',
      error_message: 'Insufficient funds',
      error_code: 'WITHDRAWAL_FAILED',
    });
  });

  it('reverses the wallet debit when Stripe transfer creation fails', async () => {
    const registerTransaction = jest
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });
    const { service, accountsService } = createPayoutService({
      registerTransaction,
      createTransfer: jest.fn().mockRejectedValue(new Error('Stripe down')),
    });

    await expect(
      service.executePayout(payoutParams, { throwOnFailure: true }),
    ).rejects.toThrow(HttpException);

    expect(accountsService.registerTransaction).toHaveBeenNthCalledWith(1, {
      accountId: 'account-1',
      amount: 25,
      transactionType: 'withdrawal',
      memo: expect.stringContaining('Stripe payout - SP'),
      referenceId: 'tx-1',
    });
    expect(accountsService.registerTransaction).toHaveBeenNthCalledWith(2, {
      accountId: 'account-1',
      amount: 25,
      transactionType: 'deposit',
      memo: expect.stringContaining('Stripe payout reversal - SP'),
      referenceId: 'tx-1',
    });
  });
});

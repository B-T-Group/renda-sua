import { HttpException, HttpStatus } from '@nestjs/common';
import { StripePaymentsController } from './stripe-payments.controller';

describe('StripePaymentsController', () => {
  let controller: StripePaymentsController;
  let hasuraUserService: {
    getUser: jest.Mock;
    executeQuery: jest.Mock;
  };
  let payoutService: {
    executePayout: jest.Mock;
  };

  const body = {
    amount: 25,
    currency: 'CAD',
    accountId: 'account-1',
  };

  beforeEach(() => {
    hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({ id: 'user-1' }),
      executeQuery: jest.fn(),
    };
    payoutService = {
      executePayout: jest.fn().mockResolvedValue({
        success: true,
        data: { transactionId: 'stripe-tx-1' },
      }),
    };
    controller = new StripePaymentsController(
      {} as any,
      {} as any,
      hasuraUserService as any,
      {} as any,
      {} as any,
      payoutService as any,
      {} as any
    );
  });

  it('withdraws only after confirming the account belongs to the user', async () => {
    hasuraUserService.executeQuery.mockResolvedValue({
      accounts: [{ id: body.accountId, user_id: 'user-1', is_active: true }],
    });

    await expect(controller.withdraw(body)).resolves.toEqual({
      success: true,
      data: { transactionId: 'stripe-tx-1' },
    });

    expect(payoutService.executePayout).toHaveBeenCalledWith(
      {
        amount: body.amount,
        currency: body.currency,
        accountId: body.accountId,
        userId: 'user-1',
        description: 'Wallet withdrawal',
      },
      { throwOnFailure: true }
    );
  });

  it('rejects withdrawals from accounts not owned by the user', async () => {
    hasuraUserService.executeQuery.mockResolvedValue({ accounts: [] });

    await expectHttpStatus(controller.withdraw(body), HttpStatus.NOT_FOUND);
    expect(payoutService.executePayout).not.toHaveBeenCalled();
  });

  it('rejects withdrawals from inactive accounts', async () => {
    hasuraUserService.executeQuery.mockResolvedValue({
      accounts: [{ id: body.accountId, user_id: 'user-1', is_active: false }],
    });

    await expectHttpStatus(controller.withdraw(body), HttpStatus.BAD_REQUEST);
    expect(payoutService.executePayout).not.toHaveBeenCalled();
  });
});

async function expectHttpStatus(
  promise: Promise<unknown>,
  status: HttpStatus
): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected HttpException with status ${status}`);
  } catch (error: any) {
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(status);
  }
}

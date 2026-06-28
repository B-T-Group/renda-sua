import { HttpException, HttpStatus } from '@nestjs/common';
import { GET_ACCOUNT_BY_ID_FOR_USER } from '../hasura/hasura.queries';
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

  beforeEach(() => {
    hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({ id: 'user-123' }),
      executeQuery: jest.fn(),
    };
    payoutService = {
      executePayout: jest.fn(),
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

  describe('withdraw', () => {
    const request = {
      amount: 100,
      currency: 'CAD',
      accountId: 'account-123',
      description: 'Withdraw balance',
    };

    it('rejects withdrawals from accounts not owned by the user', async () => {
      hasuraUserService.executeQuery.mockResolvedValue({ accounts: [] });

      let error: HttpException | undefined;
      try {
        await controller.withdraw(request);
      } catch (caught: any) {
        error = caught;
      }

      expect(error).toBeInstanceOf(HttpException);
      expect(error?.getStatus()).toBe(HttpStatus.NOT_FOUND);

      expect(hasuraUserService.executeQuery).toHaveBeenCalledWith(
        GET_ACCOUNT_BY_ID_FOR_USER,
        { accountId: request.accountId, userId: 'user-123' }
      );
      expect(payoutService.executePayout).not.toHaveBeenCalled();
    });

    it('executes payout after account ownership is verified', async () => {
      hasuraUserService.executeQuery.mockResolvedValue({
        accounts: [{ id: request.accountId }],
      });
      payoutService.executePayout.mockResolvedValue({
        success: true,
        data: { transactionId: 'tx-123' },
      });

      await expect(controller.withdraw(request)).resolves.toEqual({
        success: true,
        data: { transactionId: 'tx-123' },
      });

      expect(payoutService.executePayout).toHaveBeenCalledWith(
        {
          amount: request.amount,
          currency: request.currency,
          accountId: request.accountId,
          userId: 'user-123',
          description: request.description,
        },
        { throwOnFailure: true }
      );
    });
  });
});

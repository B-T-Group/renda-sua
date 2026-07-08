import { HttpException, HttpStatus } from '@nestjs/common';
import { GET_ACCOUNT_BY_ID_FOR_USER } from '../hasura/hasura.queries';

jest.mock('./stripe-connect.service', () => ({
  StripeConnectService: class StripeConnectService {},
}));

import { StripePaymentsController } from './stripe-payments.controller';

describe('StripePaymentsController', () => {
  let controller: StripePaymentsController;
  let hasuraUserService: {
    getUser: jest.Mock;
    executeQuery: jest.Mock;
  };
  let hasuraSystemService: {
    executeQuery: jest.Mock;
  };
  let databaseService: {
    getTransactionById: jest.Mock;
    listTransactions: jest.Mock;
    getEventByEventId: jest.Mock;
    markEventProcessed: jest.Mock;
    recordEvent: jest.Mock;
  };
  let stripeService: { constructEvent: jest.Mock };
  let callbackProcessor: {
    onPaymentIntentSucceeded: jest.Mock;
  };
  let payoutService: {
    executePayout: jest.Mock;
  };
  let connectService: { syncFromStripe: jest.Mock };

  beforeEach(() => {
    hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({ id: 'user-123' }),
      executeQuery: jest.fn(),
    };
    hasuraSystemService = {
      executeQuery: jest.fn(),
    };
    databaseService = {
      getTransactionById: jest.fn(),
      listTransactions: jest.fn(),
      getEventByEventId: jest.fn(),
      markEventProcessed: jest.fn(),
      recordEvent: jest.fn(),
    };
    stripeService = {
      constructEvent: jest.fn(),
    };
    callbackProcessor = {
      onPaymentIntentSucceeded: jest.fn(),
    };
    payoutService = {
      executePayout: jest.fn(),
    };
    connectService = {
      syncFromStripe: jest.fn(),
    };

    controller = new StripePaymentsController(
      stripeService as any,
      databaseService as any,
      hasuraUserService as any,
      hasuraSystemService as any,
      callbackProcessor as any,
      connectService as any,
      payoutService as any,
      {} as any,
      {} as any,
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
      hasuraSystemService.executeQuery.mockResolvedValue({ accounts: [] });

      let error: HttpException | undefined;
      try {
        await controller.withdraw(request);
      } catch (caught: any) {
        error = caught;
      }

      expect(error).toBeInstanceOf(HttpException);
      expect(error?.getStatus()).toBe(HttpStatus.NOT_FOUND);

      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        GET_ACCOUNT_BY_ID_FOR_USER,
        { accountId: request.accountId, userId: 'user-123' }
      );
      expect(payoutService.executePayout).not.toHaveBeenCalled();
    });

    it('executes payout after account ownership is verified', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
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

  describe('getById', () => {
    it('rejects transactions whose account is not owned by the user', async () => {
      databaseService.getTransactionById.mockResolvedValue({
        id: 'transaction-123',
        account_id: 'foreign-account',
      });
      hasuraSystemService.executeQuery.mockResolvedValue({ accounts: [] });

      let error: HttpException | undefined;
      try {
        await controller.getById('transaction-123');
      } catch (caught: any) {
        error = caught;
      }

      expect(error).toBeInstanceOf(HttpException);
      expect(error?.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        GET_ACCOUNT_BY_ID_FOR_USER,
        { accountId: 'foreign-account', userId: 'user-123' }
      );
    });
  });

  describe('list', () => {
    it('requires accountId before listing Stripe transactions', async () => {
      let error: HttpException | undefined;
      try {
        await controller.list(undefined, undefined, undefined, undefined);
      } catch (caught: any) {
        error = caught;
      }

      expect(error).toBeInstanceOf(HttpException);
      expect(error?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(databaseService.listTransactions).not.toHaveBeenCalled();
    });
  });

  describe('webhook', () => {
    const event = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_123' } },
    };
    const request = { body: Buffer.from('{}') } as any;

    beforeEach(() => {
      stripeService.constructEvent.mockReturnValue(event);
    });

    it('replays duplicate events that were recorded but not processed', async () => {
      databaseService.recordEvent.mockResolvedValue(false);
      databaseService.getEventByEventId.mockResolvedValue({
        id: 'row-123',
        processed_at: null,
      });

      await expect(controller.webhook('sig', request)).resolves.toEqual({
        received: true,
      });

      expect(callbackProcessor.onPaymentIntentSucceeded).toHaveBeenCalledWith(
        event.data.object,
        request
      );
      expect(databaseService.markEventProcessed).toHaveBeenCalledWith('evt_123');
    });

    it('skips duplicate events that were already processed', async () => {
      databaseService.recordEvent.mockResolvedValue(false);
      databaseService.getEventByEventId.mockResolvedValue({
        id: 'row-123',
        processed_at: '2026-07-08T11:00:00.000Z',
      });

      await expect(controller.webhook('sig', request)).resolves.toEqual({
        received: true,
        duplicate: true,
      });

      expect(callbackProcessor.onPaymentIntentSucceeded).not.toHaveBeenCalled();
      expect(databaseService.markEventProcessed).not.toHaveBeenCalled();
    });
  });
});

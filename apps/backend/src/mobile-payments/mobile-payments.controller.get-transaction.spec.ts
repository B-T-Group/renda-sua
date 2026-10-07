import { HttpException, HttpStatus } from '@nestjs/common';
import { MobilePaymentsController } from './mobile-payments.controller';
import { MobileTransactionAccessService } from './mobile-transaction-access.service';

describe('MobilePaymentsController transaction access', () => {
  const ctx = {} as never;
  const transaction = {
    id: 'tx-1',
    account_id: 'acct-1',
    amount: 200,
    currency: 'XAF',
    customer_phone: '+237670000000',
    customer_email: 'client@example.com',
    status: 'pending',
    reference: 'ref-1',
  };

  let getTransactionById: jest.Mock;
  let getTransactionByReference: jest.Mock;
  let getTransactions: jest.Mock;
  let getTransactionStats: jest.Mock;
  let updateTransaction: jest.Mock;
  let checkTransactionStatus: jest.Mock;
  let cancelTransaction: jest.Mock;
  let getUser: jest.Mock;
  let executeQuery: jest.Mock;
  let hasPermission: jest.Mock;
  let controller: MobilePaymentsController;

  beforeEach(() => {
    getTransactionById = jest.fn().mockResolvedValue(transaction);
    getTransactionByReference = jest.fn().mockResolvedValue(transaction);
    getTransactions = jest.fn().mockResolvedValue([transaction]);
    getTransactionStats = jest.fn().mockResolvedValue({ count: 1 });
    updateTransaction = jest.fn().mockResolvedValue(transaction);
    checkTransactionStatus = jest.fn().mockResolvedValue({
      status: 'pending',
      message: 'awaiting',
    });
    cancelTransaction = jest.fn().mockResolvedValue(true);
    getUser = jest.fn().mockResolvedValue({ id: 'owner-1' });
    executeQuery = jest.fn().mockResolvedValue({
      accounts_by_pk: { id: 'acct-1', user_id: 'owner-1' },
    });
    hasPermission = jest.fn().mockResolvedValue(false);

    const access = new MobileTransactionAccessService(
      { executeQuery } as never,
      { hasPermission } as never
    );
    controller = new MobilePaymentsController(
      { checkTransactionStatus, cancelTransaction } as never,
      {
        getTransactionById,
        getTransactionByReference,
        getTransactions,
        getTransactionStats,
        updateTransaction,
      } as never,
      {} as never,
      {} as never,
      { getUser } as never,
      {} as never,
      {} as never,
      {} as never,
      access
    );
  });

  const expectNotFound = async (promise: Promise<unknown>) => {
    try {
      await promise;
      throw new Error('expected HttpException');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const http = err as HttpException;
      expect(http.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(http.getResponse()).toEqual({
        success: false,
        message: 'Transaction not found',
      });
    }
  };

  const expectForbidden = async (promise: Promise<unknown>) => {
    try {
      await promise;
      throw new Error('expected HttpException');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const http = err as HttpException;
      expect(http.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  };

  describe('GET transactions/:transactionId', () => {
    it('returns the transaction to the owner of the linked account', async () => {
      await expect(controller.getTransaction('tx-1', ctx)).resolves.toEqual({
        success: true,
        data: transaction,
      });
      expect(getUser).toHaveBeenCalledWith(ctx);
    });

    it('returns 404 to another user (same body as a missing id)', async () => {
      getUser.mockResolvedValue({ id: 'other-user' });
      await expectNotFound(controller.getTransaction('tx-1', ctx));
    });

    it('returns the transaction to a mobile payments admin', async () => {
      getUser.mockResolvedValue({ id: 'admin-1' });
      hasPermission.mockResolvedValue(true);
      await expect(controller.getTransaction('tx-1', ctx)).resolves.toEqual({
        success: true,
        data: transaction,
      });
    });

    it('returns 404 when the transaction does not exist', async () => {
      getTransactionById.mockResolvedValue(null);
      await expectNotFound(controller.getTransaction('missing', ctx));
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it('returns 404 to a non-admin for a transaction without an account', async () => {
      getTransactionById.mockResolvedValue({ ...transaction, account_id: null });
      await expectNotFound(controller.getTransaction('tx-1', ctx));
    });
  });

  describe('GET transactions/reference/:reference', () => {
    it('returns the transaction to the owner', async () => {
      await expect(
        controller.getTransactionByReference('ref-1', ctx)
      ).resolves.toEqual({ success: true, data: transaction });
    });

    it('returns 404 to another user', async () => {
      getUser.mockResolvedValue({ id: 'other-user' });
      await expectNotFound(controller.getTransactionByReference('ref-1', ctx));
    });
  });

  describe('GET transactions/:transactionId/status', () => {
    it('polls the provider for the owner and persists status', async () => {
      await expect(
        controller.checkTransactionStatus('tx-1', ctx)
      ).resolves.toEqual({
        success: true,
        data: { status: 'pending', message: 'awaiting' },
      });
      expect(checkTransactionStatus).toHaveBeenCalledWith('tx-1', undefined);
      expect(updateTransaction).toHaveBeenCalledWith('tx-1', {
        status: 'pending',
        error_message: 'awaiting',
      });
    });

    it('does not poll or persist for another user', async () => {
      getUser.mockResolvedValue({ id: 'other-user' });
      await expectNotFound(controller.checkTransactionStatus('tx-1', ctx));
      expect(checkTransactionStatus).not.toHaveBeenCalled();
      expect(updateTransaction).not.toHaveBeenCalled();
    });
  });

  describe('POST transactions/:transactionId/cancel', () => {
    it('cancels a pending transaction for the owner', async () => {
      await expect(controller.cancelTransaction('tx-1', ctx)).resolves.toEqual({
        success: true,
        message: 'Transaction cancelled successfully',
      });
      expect(cancelTransaction).toHaveBeenCalledWith('tx-1', undefined);
      expect(updateTransaction).toHaveBeenCalledWith('tx-1', {
        status: 'cancelled',
      });
    });

    it('does not cancel another user\'s transaction', async () => {
      getUser.mockResolvedValue({ id: 'other-user' });
      await expectNotFound(controller.cancelTransaction('tx-1', ctx));
      expect(cancelTransaction).not.toHaveBeenCalled();
      expect(updateTransaction).not.toHaveBeenCalled();
    });
  });

  describe('GET transactions', () => {
    it('returns the platform list to a mobile payments admin', async () => {
      getUser.mockResolvedValue({ id: 'admin-1' });
      hasPermission.mockResolvedValue(true);
      await expect(controller.getTransactions(ctx)).resolves.toEqual({
        success: true,
        data: [transaction],
      });
      expect(getTransactions).toHaveBeenCalled();
    });

    it('returns 403 to a non-admin', async () => {
      await expectForbidden(controller.getTransactions(ctx));
      expect(getTransactions).not.toHaveBeenCalled();
    });
  });

  describe('GET statistics', () => {
    it('returns platform stats to a mobile payments admin', async () => {
      getUser.mockResolvedValue({ id: 'admin-1' });
      hasPermission.mockResolvedValue(true);
      await expect(controller.getStatistics(ctx)).resolves.toEqual({
        success: true,
        data: { count: 1 },
      });
    });

    it('returns 403 to a non-admin', async () => {
      await expectForbidden(controller.getStatistics(ctx));
      expect(getTransactionStats).not.toHaveBeenCalled();
    });
  });
});

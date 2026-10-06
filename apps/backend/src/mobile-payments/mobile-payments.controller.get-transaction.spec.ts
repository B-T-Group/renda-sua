import { HttpException, HttpStatus } from '@nestjs/common';
import { MobilePaymentsController } from './mobile-payments.controller';
import { MobileTransactionAccessService } from './mobile-transaction-access.service';

describe('MobilePaymentsController GET transactions/:transactionId ownership', () => {
  const ctx = {} as never;
  const transaction = {
    id: 'tx-1',
    account_id: 'acct-1',
    amount: 200,
    currency: 'XAF',
    customer_phone: '+237670000000',
    customer_email: 'client@example.com',
    status: 'success',
  };

  let getTransactionById: jest.Mock;
  let getUser: jest.Mock;
  let executeQuery: jest.Mock;
  let hasPermission: jest.Mock;
  let controller: MobilePaymentsController;

  beforeEach(() => {
    getTransactionById = jest.fn().mockResolvedValue(transaction);
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
      {} as never,
      { getTransactionById } as never,
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

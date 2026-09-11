import { ForbiddenException, HttpException } from '@nestjs/common';
import { PendingWithdrawalResolveService } from './pending-withdrawal-resolve.service';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';

function baseTx(
  overrides: Partial<MobilePaymentTransaction> = {}
): MobilePaymentTransaction {
  return {
    id: 'tx-1',
    reference: 'P123',
    amount: 1000,
    currency: 'XAF',
    description: 'Withdrawal',
    provider: 'freemopay',
    payment_method: 'mobile_money',
    status: 'pending',
    transaction_type: 'GIVE_CHANGE',
    account_id: 'acct-1',
    customer_phone: '+237690000000',
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('PendingWithdrawalResolveService', () => {
  const databaseService = {
    getTransactionById: jest.fn(),
    updateTransaction: jest.fn(),
  };
  const mobilePaymentsService = {
    resolveAdminIntegrationProvider: jest.fn(),
    checkTransactionStatus: jest.fn(),
    nationalCustomerIdForMypvit: jest.fn().mockReturnValue('690000000'),
  };
  const callbackProcessor = {
    processMypvitCallback: jest.fn(),
    processFreemopayCallback: jest.fn(),
  };
  const accountsService = {
    registerReleaseIfNotExists: jest.fn(),
    registerWithdrawalIfNotExists: jest.fn(),
  };
  const hasuraSystemService = {
    executeQuery: jest.fn(),
  };

  let service: PendingWithdrawalResolveService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PendingWithdrawalResolveService(
      databaseService as never,
      mobilePaymentsService as never,
      callbackProcessor as never,
      accountsService as never,
      hasuraSystemService as never
    );
    hasuraSystemService.executeQuery.mockResolvedValue({
      accounts_by_pk: { id: 'acct-1', user_id: 'user-1' },
    });
    accountsService.registerReleaseIfNotExists.mockResolvedValue({
      success: true,
    });
    accountsService.registerWithdrawalIfNotExists.mockResolvedValue({
      success: true,
    });
    databaseService.updateTransaction.mockResolvedValue(undefined);
    mobilePaymentsService.resolveAdminIntegrationProvider.mockReturnValue(
      'freemopay'
    );
  });

  it('cancels and releases hold when transaction_id is null', async () => {
    databaseService.getTransactionById.mockResolvedValue(
      baseTx({ transaction_id: undefined })
    );

    const result = await service.resolveForUser('tx-1', 'user-1');

    expect(result.outcome).toBe('cancelled');
    expect(result.transaction_id).toBeNull();
    expect(result.status).toEqual({
      transactionId: 'tx-1',
      status: 'cancelled',
      amount: 1000,
      currency: 'XAF',
      reference: 'P123',
      message: 'Cancelled before provider accepted withdrawal',
      provider: 'freemopay',
    });
    expect(accountsService.registerReleaseIfNotExists).toHaveBeenCalledWith({
      accountId: 'acct-1',
      amount: 1000,
      referenceId: 'tx-1',
      memo: expect.stringContaining('GIVE_CHANGE release'),
    });
    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-1', {
      status: 'cancelled',
      error_message: 'Cancelled before provider accepted withdrawal',
      error_code: 'USER_CANCELLED',
    });
    const releaseCallOrder =
      accountsService.registerReleaseIfNotExists.mock.invocationCallOrder[0];
    const statusCallOrder = databaseService.updateTransaction.mock.invocationCallOrder[0];
    expect(releaseCallOrder).toBeLessThan(statusCallOrder);
  });
  it('finalizes paid withdrawal when provider reports success', async () => {
    databaseService.getTransactionById.mockResolvedValue(
      baseTx({ transaction_id: 'prov-1' })
    );
    mobilePaymentsService.checkTransactionStatus.mockResolvedValue({
      transactionId: 'prov-1',
      status: 'success',
      amount: 1000,
      currency: 'XAF',
      reference: 'P123',
    });
    callbackProcessor.processFreemopayCallback.mockResolvedValue({
      received: true,
    });

    const result = await service.resolveForUser('tx-1', 'user-1');

    expect(result.outcome).toBe('paid');
    expect(result.transaction_id).toBe('prov-1');
    expect(result.status.status).toBe('success');
    expect(callbackProcessor.processFreemopayCallback).toHaveBeenCalled();
  });

  it('finalizes failed withdrawal when provider reports failure', async () => {
    databaseService.getTransactionById.mockResolvedValue(
      baseTx({ transaction_id: 'prov-1' })
    );
    mobilePaymentsService.checkTransactionStatus.mockResolvedValue({
      transactionId: 'prov-1',
      status: 'failed',
      amount: 1000,
      currency: 'XAF',
      reference: 'P123',
      message: 'Rejected',
    });
    callbackProcessor.processFreemopayCallback.mockResolvedValue({
      received: true,
    });

    const result = await service.resolveForUser('tx-1', 'user-1');

    expect(result.outcome).toBe('failed');
    expect(result.transaction_id).toBe('prov-1');
    expect(result.status).toMatchObject({
      transactionId: 'prov-1',
      status: 'failed',
      message: 'Rejected',
    });
    expect(callbackProcessor.processFreemopayCallback).toHaveBeenCalled();
  });

  it('rejects user resolve with 409 when provider is still pending', async () => {
    databaseService.getTransactionById.mockResolvedValue(
      baseTx({ transaction_id: 'prov-1' })
    );
    mobilePaymentsService.checkTransactionStatus.mockResolvedValue({
      transactionId: 'prov-1',
      status: 'pending',
      amount: 1000,
      currency: 'XAF',
      reference: 'P123',
    });

    try {
      await service.resolveForUser('tx-1', 'user-1');
      fail('expected HttpException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({ error: 'STILL_PENDING' })
      );
    }
    expect(callbackProcessor.processFreemopayCallback).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('system path returns still_pending when provider is still pending', async () => {
    databaseService.getTransactionById.mockResolvedValue(
      baseTx({ transaction_id: 'prov-1' })
    );
    mobilePaymentsService.checkTransactionStatus.mockResolvedValue({
      transactionId: 'prov-1',
      status: 'pending',
      amount: 1000,
      currency: 'XAF',
      reference: 'P123',
    });

    const result = await service.resolveAsSystem('tx-1');

    expect(result.outcome).toBe('still_pending');
    expect(result.transaction_id).toBe('prov-1');
    expect(result.status.status).toBe('pending');
    expect(callbackProcessor.processFreemopayCallback).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('rejects resolve when account is not owned by user', async () => {
    databaseService.getTransactionById.mockResolvedValue(baseTx());
    hasuraSystemService.executeQuery.mockResolvedValue({
      accounts_by_pk: { id: 'acct-1', user_id: 'other-user' },
    });

    await expect(service.resolveForUser('tx-1', 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('system path skips null-id cancel inside grace window', async () => {
    databaseService.getTransactionById.mockResolvedValue(
      baseTx({
        transaction_id: undefined,
        created_at: new Date().toISOString(),
      })
    );

    const result = await service.resolveAsSystem('tx-1', {
      allowImmediateCancel: false,
      minAgeHours: 24,
    });

    expect(result.outcome).toBe('still_pending');
    expect(result.transaction_id).toBeNull();
    expect(result.status.status).toBe('pending');
    expect(accountsService.registerReleaseIfNotExists).not.toHaveBeenCalled();
  });

  it('rejects non-pending transactions', async () => {
    databaseService.getTransactionById.mockResolvedValue(
      baseTx({ status: 'success' })
    );

    await expect(service.resolveForUser('tx-1', 'user-1')).rejects.toBeInstanceOf(
      HttpException
    );
  });

  it('records WITHDRAWAL_FAILED when MTN debit fails after provider success', async () => {
    databaseService.getTransactionById.mockResolvedValue(
      baseTx({ transaction_id: 'prov-1', provider: 'mtn' })
    );
    mobilePaymentsService.resolveAdminIntegrationProvider.mockReturnValue('mtn');
    mobilePaymentsService.checkTransactionStatus.mockResolvedValue({
      transactionId: 'prov-1',
      status: 'success',
      amount: 1000,
      currency: 'XAF',
      reference: 'P123',
    });
    accountsService.registerReleaseIfNotExists.mockResolvedValue({
      success: false,
      error: 'insufficient withheld',
    });

    const result = await service.resolveForUser('tx-1', 'user-1');

    expect(result.outcome).toBe('paid');
    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-1', {
      status: 'success',
      transaction_id: 'prov-1',
      error_message:
        'Provider payout succeeded but wallet debit failed; manual reconciliation required',
      error_code: 'WITHDRAWAL_FAILED',
    });
    expect(
      accountsService.registerWithdrawalIfNotExists
    ).not.toHaveBeenCalled();
  });
});

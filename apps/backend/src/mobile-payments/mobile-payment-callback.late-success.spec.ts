import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';

jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));

/** #545: provider SUCCESS for an order attempt we superseded must never be dropped. */
describe('MobilePaymentCallbackProcessor late success on superseded order tx', () => {
  const supersededTx: MobilePaymentTransaction = {
    id: 'tx-old',
    reference: 'ORD1-111-aaaa',
    amount: 1500,
    currency: 'XAF',
    description: 'order ORD1 (after confirm)',
    provider: 'freemopay',
    payment_method: 'mobile_money',
    status: 'cancelled',
    error_code: 'SUPERSEDED_BY_RETRY',
    transaction_id: 'fmp-old',
    customer_phone: '+237650000099',
    account_id: 'acct-client',
    transaction_type: 'PAYMENT',
    payment_entity: 'order',
    entity_id: 'ORD1',
    created_at: '2026-10-12T10:00:00.000Z',
    updated_at: '2026-10-12T10:02:00.000Z',
  };

  function build(tx: MobilePaymentTransaction, outcome: 'applied' | 'duplicate' = 'applied') {
    const databaseService = {
      getTransactionByTransactionId: jest.fn().mockResolvedValue(tx),
      getTransactionByReference: jest.fn().mockResolvedValue(tx),
      findMyPVitTransactionByShortReference: jest.fn().mockResolvedValue(null),
      logCallback: jest.fn().mockResolvedValue(undefined),
      updateTransaction: jest.fn().mockResolvedValue(undefined),
      updateTransactionIfStatus: jest.fn().mockResolvedValue(true),
    };
    const accountsService = {
      registerDepositIfNotExists: jest
        .fn()
        .mockResolvedValue({ success: true, alreadyExists: false }),
    };
    const handler = {
      supportsPaymentEntity: (e: string) => e === 'order',
      onPaymentSuccess: jest.fn(),
      onPaymentFailure: jest.fn(),
      finalizeCashReconciliationAfterPayment: jest.fn(),
      onLateSuccessAfterSupersede: jest.fn().mockResolvedValue(outcome),
    };
    const registry = { getHandlers: jest.fn().mockReturnValue([handler]) };
    const mobilePaymentsService = {
      assertProviderConfirmsCallback: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new MobilePaymentCallbackProcessor(
      databaseService as any,
      accountsService as any,
      registry as any,
      mobilePaymentsService as any
    );
    return { processor, databaseService, accountsService, handler, mobilePaymentsService };
  }

  const callback = (status: 'SUCCESS' | 'FAILED') => ({
    reference: 'fmp-old',
    externalId: 'ORD1-111-aaaa',
    status,
  });

  it('verifies with provider, credits wallet, applies to the order, then CAS cancelled -> success', async () => {
    const { processor, databaseService, accountsService, handler, mobilePaymentsService } =
      build(supersededTx, 'applied');
    const order: string[] = [];
    mobilePaymentsService.assertProviderConfirmsCallback.mockImplementation(async () => {
      order.push('verify');
    });
    accountsService.registerDepositIfNotExists.mockImplementation(async () => {
      order.push('credit');
      return { success: true };
    });
    handler.onLateSuccessAfterSupersede.mockImplementation(async () => {
      order.push('handler');
      return 'applied';
    });
    databaseService.updateTransactionIfStatus.mockImplementation(async () => {
      order.push('cas');
      return true;
    });

    await processor.processFreemopayCallback(callback('SUCCESS') as any);

    expect(order).toEqual(['verify', 'credit', 'handler', 'cas']);
    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acct-client', amount: 1500, referenceId: 'tx-old' })
    );
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      'tx-old',
      'cancelled',
      expect.objectContaining({ status: 'success', error_code: 'LATE_SUCCESS_APPLIED' })
    );
    // Not the normal pending path.
    expect(handler.onPaymentSuccess).not.toHaveBeenCalled();
  });

  it('marks a duplicate as DUPLICATE_PAYMENT_CREDITED (money stays in wallet)', async () => {
    const { processor, databaseService } = build(supersededTx, 'duplicate');
    await processor.processFreemopayCallback(callback('SUCCESS') as any);
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      'tx-old',
      'cancelled',
      expect.objectContaining({ status: 'success', error_code: 'DUPLICATE_PAYMENT_CREDITED' })
    );
  });

  it('leaves the row cancelled when the provider does not confirm (forged callback)', async () => {
    const { processor, databaseService, accountsService, mobilePaymentsService } =
      build(supersededTx);
    mobilePaymentsService.assertProviderConfirmsCallback.mockRejectedValue(
      new Error('provider status is pending')
    );
    await expect(
      processor.processFreemopayCallback(callback('SUCCESS') as any)
    ).rejects.toThrow(/pending/);
    expect(accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(databaseService.updateTransactionIfStatus).not.toHaveBeenCalled();
  });

  it('does not flip status when the order handler fails (provider retry re-runs it)', async () => {
    const { processor, databaseService, handler } = build(supersededTx);
    handler.onLateSuccessAfterSupersede.mockRejectedValue(new Error('hasura down'));
    await expect(
      processor.processFreemopayCallback(callback('SUCCESS') as any)
    ).rejects.toThrow('hasura down');
    expect(databaseService.updateTransactionIfStatus).not.toHaveBeenCalled();
  });

  it('skips provider confirmation for DEV mock transactions', async () => {
    const mockTx = { ...supersededTx, transaction_id: 'mock-123' };
    const { processor, mobilePaymentsService, handler } = build(mockTx);
    await processor.processFreemopayCallback({ ...callback('SUCCESS'), reference: 'mock-123' } as any);
    expect(mobilePaymentsService.assertProviderConfirmsCallback).not.toHaveBeenCalled();
    expect(handler.onLateSuccessAfterSupersede).toHaveBeenCalled();
  });

  it('ignores a FAILED callback on a superseded tx', async () => {
    const { processor, handler, accountsService } = build(supersededTx);
    const res = await processor.processFreemopayCallback(callback('FAILED') as any);
    expect(res.skipped).toBe(true);
    expect(handler.onLateSuccessAfterSupersede).not.toHaveBeenCalled();
    expect(accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
  });

  it('recovers SUCCESS after a retry poll marked the attempt failed', async () => {
    const failedPoll = {
      ...supersededTx,
      status: 'failed' as const,
      error_code: 'PROVIDER_TERMINAL_ON_RETRY',
    };
    const { processor, databaseService, accountsService, handler } = build(failedPoll, 'applied');
    await processor.processFreemopayCallback(callback('SUCCESS') as any);
    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({ referenceId: 'tx-old', amount: 1500 })
    );
    expect(handler.onLateSuccessAfterSupersede).toHaveBeenCalledWith(failedPoll);
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      'tx-old',
      'failed',
      expect.objectContaining({ status: 'success', error_code: 'LATE_SUCCESS_APPLIED' })
    );
  });

  it('ignores cancelled order txs that were not superseded by us', async () => {
    const plainCancelled = { ...supersededTx, error_code: undefined };
    const { processor, handler } = build(plainCancelled);
    const res = await processor.processFreemopayCallback(callback('SUCCESS') as any);
    expect(res.skipped).toBe(true);
    expect(handler.onLateSuccessAfterSupersede).not.toHaveBeenCalled();
  });

  it('handles the MyPVit path too, including SUPERSEDED_BY_LATE_SUCCESS rows', async () => {
    const tx = { ...supersededTx, provider: 'mypvit', error_code: 'SUPERSEDED_BY_LATE_SUCCESS' };
    const { processor, handler, databaseService } = build(tx, 'duplicate');
    await processor.processMypvitCallback({
      transactionId: 'pv-1',
      merchantReferenceId: tx.reference,
      status: 'SUCCESS',
      amount: 1500,
      customerID: '650000099',
      fees: 0,
      chargeOwner: 'MERCHANT',
      transactionOperation: 'PAYMENT',
      operator: 'MTN',
      code: 200,
    } as any);
    expect(handler.onLateSuccessAfterSupersede).toHaveBeenCalledWith(tx);
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      tx.id,
      'cancelled',
      expect.objectContaining({ transaction_id: 'pv-1' })
    );
  });
});

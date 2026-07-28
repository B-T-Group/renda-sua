import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';
import type { MyPVitCallbackDto } from './mobile-payment-callback.dto';

describe('MobilePaymentCallbackProcessor provider confirmation', () => {
  const pendingTokenTx: MobilePaymentTransaction = {
    id: 'tx-uuid-1',
    reference: 'TOK12345678abcd',
    amount: 20000,
    currency: 'XAF',
    description: 'AI token pack pack_5000',
    provider: 'mypvit',
    payment_method: 'mobile_money',
    status: 'pending',
    transaction_id: 'provider-tx-1',
    customer_phone: '+24106123456',
    account_id: undefined,
    transaction_type: 'PAYMENT',
    payment_entity: 'token',
    entity_id: 'business-uuid-1',
    created_at: '2026-07-27T00:00:00.000Z',
    updated_at: '2026-07-27T00:00:00.000Z',
  };

  const successCallback: MyPVitCallbackDto = {
    transactionId: 'attacker-forged-id',
    merchantReferenceId: 'TOK12345678abcd',
    status: 'SUCCESS',
    amount: 20000,
    customerID: '06123456',
    fees: 0,
    chargeOwner: 'MERCHANT',
    transactionOperation: 'PAYMENT',
    operator: 'AIRTEL',
    code: 200,
  };

  function buildProcessor(overrides?: {
    liveStatus?: 'pending' | 'success' | 'failed' | 'cancelled' | 'ambiguous';
    assertImpl?: jest.Mock;
  }) {
    const databaseService = {
      getTransactionByReference: jest.fn().mockResolvedValue(pendingTokenTx),
      logCallback: jest.fn().mockResolvedValue(undefined),
      updateTransaction: jest.fn().mockResolvedValue(undefined),
    };
    const accountsService = {
      registerTransaction: jest.fn(),
    };
    const paymentCallbackRegistry = {
      getHandlers: jest.fn().mockReturnValue([
        {
          supportsPaymentEntity: (e: string) => e === 'token',
          onPaymentSuccess: jest.fn(),
          onPaymentFailure: jest.fn(),
          finalizeCashReconciliationAfterPayment: jest.fn(),
        },
      ]),
    };
    const assertProviderConfirmsCallback =
      overrides?.assertImpl ??
      jest.fn().mockImplementation(async () => {
        if (overrides?.liveStatus && overrides.liveStatus !== 'success') {
          throw new Error(
            `Rejecting SUCCESS callback for ${pendingTokenTx.id}: provider status is ${overrides.liveStatus}`
          );
        }
      });
    const mobilePaymentsService = {
      assertProviderConfirmsCallback,
      checkTransactionStatus: jest.fn(),
      resolveAdminIntegrationProvider: jest.fn().mockReturnValue('mypvit'),
    };

    const processor = new MobilePaymentCallbackProcessor(
      databaseService as any,
      accountsService as any,
      paymentCallbackRegistry as any,
      mobilePaymentsService as any
    );

    return {
      processor,
      databaseService,
      paymentCallbackRegistry,
      assertProviderConfirmsCallback,
    };
  }

  it('rejects forged SUCCESS callbacks when provider does not confirm success', async () => {
    const { processor, databaseService, paymentCallbackRegistry, assertProviderConfirmsCallback } =
      buildProcessor({ liveStatus: 'pending' });

    await expect(
      processor.processMypvitCallback(successCallback)
    ).rejects.toThrow(/provider status is pending/i);

    expect(assertProviderConfirmsCallback).toHaveBeenCalledWith(
      pendingTokenTx,
      'SUCCESS'
    );
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
    expect(
      paymentCallbackRegistry.getHandlers()[0].onPaymentSuccess
    ).not.toHaveBeenCalled();
  });

  it('finalizes token payment only after provider confirms success', async () => {
    const onPaymentSuccess = jest.fn().mockResolvedValue(undefined);
    const { processor, databaseService, paymentCallbackRegistry } = buildProcessor({
      liveStatus: 'success',
    });
    paymentCallbackRegistry.getHandlers.mockReturnValue([
      {
        supportsPaymentEntity: (e: string) => e === 'token',
        onPaymentSuccess,
        onPaymentFailure: jest.fn(),
        finalizeCashReconciliationAfterPayment: jest.fn(),
      },
    ]);

    const result = await processor.processMypvitCallback(successCallback);

    expect(result.transactionId).toBe('attacker-forged-id');
    expect(onPaymentSuccess).toHaveBeenCalledWith(pendingTokenTx);
    expect(databaseService.updateTransaction).toHaveBeenCalledWith(
      pendingTokenTx.id,
      expect.objectContaining({ status: 'success' })
    );
  });
});

describe('MobilePaymentCallbackProcessor', () => {
  const databaseService = {
    getTransactionByReference: jest.fn(),
    getTransactionByTransactionId: jest.fn(),
    logCallback: jest.fn(),
    updateTransaction: jest.fn(),
  };
  const accountsService = {
    hasTransactionForReference: jest.fn(),
    registerTransaction: jest.fn(),
    registerWithdrawalIfNotExists: jest.fn(),
    registerReleaseIfNotExists: jest.fn(),
  };
  const paymentCallbackRegistry = {
    getHandlers: jest.fn().mockReturnValue([]),
  };

  let processor: MobilePaymentCallbackProcessor;

  const baseTx: MobilePaymentTransaction = {
    id: '11111111-1111-1111-1111-111111111111',
    reference: 'RCHG1234abcd',
    amount: 5000,
    currency: 'XAF',
    status: 'pending',
    account_id: '22222222-2222-2222-2222-222222222222',
    transaction_type: 'PAYMENT',
    payment_entity: 'account',
    entity_id: '22222222-2222-2222-2222-222222222222',
    provider: 'mypvit',
  } as MobilePaymentTransaction;

  const successCallback = {
    transactionId: 'provider-tx-1',
    merchantReferenceId: 'RCHG1234abcd',
    status: 'SUCCESS' as const,
    amount: 5000,
    customerID: '+24160000000',
    fees: 0,
    chargeOwner: 'MERCHANT',
    transactionOperation: 'PAYMENT',
    operator: 'airtel',
    code: 200,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const mobilePaymentsService = {
      assertProviderConfirmsCallback: jest.fn().mockResolvedValue(undefined),
    };
    processor = new MobilePaymentCallbackProcessor(
      databaseService as never,
      accountsService as never,
      paymentCallbackRegistry as never,
      mobilePaymentsService as never
    );
    accountsService.hasTransactionForReference.mockResolvedValue(false);
    accountsService.registerTransaction.mockResolvedValue({
      success: true,
      transactionId: 'deposit-1',
    });
    databaseService.updateTransaction.mockResolvedValue(undefined);
    databaseService.logCallback.mockResolvedValue(undefined);
  });

  it('credits wallet before marking mobile payment success', async () => {
    databaseService.getTransactionByReference.mockResolvedValue({ ...baseTx });
    const callOrder: string[] = [];
    accountsService.registerTransaction.mockImplementation(async () => {
      callOrder.push('credit');
      return { success: true, transactionId: 'deposit-1' };
    });
    databaseService.updateTransaction.mockImplementation(async () => {
      callOrder.push('status');
    });

    await processor.processMypvitCallback(successCallback);

    expect(callOrder).toEqual(['credit', 'status']);
    expect(databaseService.updateTransaction).toHaveBeenCalledWith(baseTx.id, {
      status: 'success',
      transaction_id: 'provider-tx-1',
    });
  });

  it('leaves pending and does not mark success when wallet credit fails', async () => {
    databaseService.getTransactionByReference.mockResolvedValue({ ...baseTx });
    accountsService.registerTransaction.mockResolvedValue({
      success: false,
      error: 'Account not found',
    });

    await expect(processor.processMypvitCallback(successCallback)).rejects.toThrow(
      /Wallet credit failed/
    );

    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('retries wallet credit for already-success callbacks without double deposit', async () => {
    databaseService.getTransactionByReference.mockResolvedValue({
      ...baseTx,
      status: 'success',
    });
    accountsService.hasTransactionForReference.mockResolvedValue(true);

    const result = await processor.processMypvitCallback(successCallback);

    expect(result.skipped).toBe(true);
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(accountsService.hasTransactionForReference).toHaveBeenCalledWith({
      accountId: baseTx.account_id,
      transactionType: 'deposit',
      referenceId: baseTx.id,
    });
  });

  it('credits missing deposit when provider retries an already-success tx', async () => {
    databaseService.getTransactionByReference.mockResolvedValue({
      ...baseTx,
      status: 'success',
    });
    accountsService.hasTransactionForReference.mockResolvedValue(false);

    await processor.processMypvitCallback(successCallback);

    expect(accountsService.registerTransaction).toHaveBeenCalledWith({
      accountId: baseTx.account_id,
      amount: baseTx.amount,
      transactionType: 'deposit',
      memo: `Mobile payment deposit - ${baseTx.reference}`,
      referenceId: baseTx.id,
    });
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });
});

describe('MobilePaymentCallbackProcessor GIVE_CHANGE', () => {
  const databaseService = {
    getTransactionByReference: jest.fn(),
    logCallback: jest.fn(),
    updateTransaction: jest.fn(),
  };
  const accountsService = {
    hasTransactionForReference: jest.fn(),
    registerTransaction: jest.fn(),
    registerWithdrawalIfNotExists: jest.fn(),
    registerReleaseIfNotExists: jest.fn(),
  };
  const paymentCallbackRegistry = {
    getHandlers: jest.fn().mockReturnValue([]),
  };
  const mobilePaymentsService = {
    assertProviderConfirmsCallback: jest.fn().mockResolvedValue(undefined),
  };

  let processor: MobilePaymentCallbackProcessor;

  const giveChangeTx: MobilePaymentTransaction = {
    id: '33333333-3333-3333-3333-333333333333',
    reference: 'P12345678abcd',
    amount: 5000,
    currency: 'XAF',
    status: 'pending',
    account_id: '22222222-2222-2222-2222-222222222222',
    transaction_type: 'GIVE_CHANGE',
    transaction_id: 'provider-withdraw-1',
    provider: 'freemopay',
    payment_method: 'mobile_money',
    created_at: '2026-07-27T00:00:00.000Z',
    updated_at: '2026-07-27T00:00:00.000Z',
  } as MobilePaymentTransaction;

  const successCallback = {
    transactionId: 'provider-withdraw-1',
    merchantReferenceId: 'P12345678abcd',
    status: 'SUCCESS' as const,
    amount: 5000,
    customerID: '+237600000000',
    fees: 0,
    chargeOwner: 'MERCHANT',
    transactionOperation: 'PAYMENT',
    operator: 'MTN',
    code: 200,
  };

  const failedCallback = {
    ...successCallback,
    status: 'FAILED' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new MobilePaymentCallbackProcessor(
      databaseService as never,
      accountsService as never,
      paymentCallbackRegistry as never,
      mobilePaymentsService as never
    );
    databaseService.getTransactionByReference.mockResolvedValue(giveChangeTx);
    databaseService.logCallback.mockResolvedValue(undefined);
    databaseService.updateTransaction.mockResolvedValue(undefined);
    accountsService.registerWithdrawalIfNotExists.mockResolvedValue({
      success: true,
      transactionId: 'withdrawal-1',
    });
    accountsService.registerReleaseIfNotExists.mockResolvedValue({
      success: true,
      transactionId: 'release-1',
    });
    accountsService.registerTransaction.mockResolvedValue({
      success: true,
      transactionId: 'reversal-1',
    });
    accountsService.hasTransactionForReference.mockResolvedValue(false);
  });

  it('debits wallet on SUCCESS callback before marking GIVE_CHANGE success', async () => {
    const callOrder: string[] = [];
    accountsService.registerReleaseIfNotExists.mockImplementation(async () => {
      callOrder.push('release');
      return { success: true, transactionId: 'release-1' };
    });
    accountsService.registerWithdrawalIfNotExists.mockImplementation(async () => {
      callOrder.push('debit');
      return { success: true, transactionId: 'withdrawal-1' };
    });
    databaseService.updateTransaction.mockImplementation(async () => {
      callOrder.push('status');
    });

    await processor.processMypvitCallback(successCallback);

    expect(callOrder).toEqual(['release', 'debit', 'status']);
    expect(accountsService.registerReleaseIfNotExists).toHaveBeenCalledWith({
      accountId: giveChangeTx.account_id,
      amount: giveChangeTx.amount,
      referenceId: giveChangeTx.id,
      memo: `GIVE_CHANGE release - ${giveChangeTx.reference}`,
    });
    expect(accountsService.registerWithdrawalIfNotExists).toHaveBeenCalledWith({
      accountId: giveChangeTx.account_id,
      amount: giveChangeTx.amount,
      referenceId: giveChangeTx.id,
      memo: `Mobile payment give change - ${giveChangeTx.reference}`,
    });
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
  });

  it('marks provider success when ledger debit fails after payout', async () => {
    accountsService.registerReleaseIfNotExists.mockResolvedValue({
      success: true,
      transactionId: 'release-1',
    });
    accountsService.registerWithdrawalIfNotExists.mockResolvedValue({
      success: false,
      error: 'Insufficient funds for this transaction',
    });

    await processor.processMypvitCallback(successCallback);

    expect(databaseService.updateTransaction).toHaveBeenCalledWith(
      giveChangeTx.id,
      expect.objectContaining({
        status: 'success',
        error_code: 'WITHDRAWAL_FAILED',
      })
    );
  });

  it('does not debit wallet on FAILED callback when no legacy withdrawal exists', async () => {
    accountsService.hasTransactionForReference.mockResolvedValue(false);

    await processor.processMypvitCallback(failedCallback);

    expect(accountsService.registerReleaseIfNotExists).toHaveBeenCalled();
    expect(accountsService.registerWithdrawalIfNotExists).not.toHaveBeenCalled();
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).toHaveBeenCalledWith(
      giveChangeTx.id,
      expect.objectContaining({ status: 'failed' })
    );
  });

  it('reverses legacy wallet debit on FAILED callback', async () => {
    accountsService.hasTransactionForReference
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await processor.processMypvitCallback(failedCallback);

    expect(accountsService.registerTransaction).toHaveBeenCalledWith({
      accountId: giveChangeTx.account_id,
      amount: giveChangeTx.amount,
      transactionType: 'deposit',
      memo: `GIVE_CHANGE reversal - ${giveChangeTx.reference}`,
      referenceId: giveChangeTx.id,
    });
  });
});

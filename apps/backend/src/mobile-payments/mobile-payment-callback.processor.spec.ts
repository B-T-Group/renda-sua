import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';
import type { MyPVitCallbackDto } from './mobile-payment-callback.dto';

jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));

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
    updateTransactionIfStatus: jest.fn().mockResolvedValue(true),
  };
  const accountsService = {
    hasTransactionForReference: jest.fn(),
    registerTransaction: jest.fn(),
    registerDepositIfNotExists: jest.fn(),
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
    accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: true,
      alreadyExists: false,
      transactionId: 'deposit-1',
    });
    databaseService.updateTransaction.mockResolvedValue(undefined);
    databaseService.logCallback.mockResolvedValue(undefined);
  });

  it('credits wallet before marking mobile payment success', async () => {
    databaseService.getTransactionByReference.mockResolvedValue({ ...baseTx });
    const callOrder: string[] = [];
    databaseService.updateTransactionIfStatus.mockImplementation(async (_id, _expected, data) => {
      if (data.status) callOrder.push(data.status);
      return true;
    });
    accountsService.registerDepositIfNotExists.mockImplementation(async () => {
      callOrder.push('credit');
      return { success: true, alreadyExists: false, transactionId: 'deposit-1' };
    });

    await processor.processMypvitCallback(successCallback);

    expect(callOrder).toEqual(['processing', 'credit', 'success']);
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(baseTx.id, 'processing', {
      status: 'success',
      transaction_id: 'provider-tx-1',
    });
  });

  it('skips cash-advance repayment when crediting an order payment', async () => {
    databaseService.getTransactionByReference.mockResolvedValue({
      ...baseTx,
      payment_entity: 'order',
    });

    await processor.processMypvitCallback(successCallback);

    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith({
      accountId: baseTx.account_id,
      amount: baseTx.amount,
      memo: `Mobile payment deposit - ${baseTx.reference}`,
      referenceId: baseTx.id,
      idempotencyKey: `momo-deposit:${baseTx.id}`,
      skipCashAdvanceRepayment: true,
    });
  });

  it('fails closed when a claim-order finalize throws', async () => {
    const onPaymentSuccess = jest.fn().mockRejectedValue(new Error('claim assign failed'));
    paymentCallbackRegistry.getHandlers.mockReturnValue([
      {
        supportsPaymentEntity: (entity: string) => entity === 'claim_order',
        onPaymentSuccess,
      },
    ]);
    databaseService.getTransactionByReference.mockResolvedValue({
      ...baseTx,
      payment_entity: 'claim_order',
      entity_id: 'ORD-9',
    });

    try {
      await expect(processor.processMypvitCallback(successCallback)).rejects.toThrow(
        'claim assign failed'
      );
      expect(accountsService.registerDepositIfNotExists).toHaveBeenCalled();
      expect(databaseService.updateTransaction).not.toHaveBeenCalled();
    } finally {
      paymentCallbackRegistry.getHandlers.mockReturnValue([]);
    }
  });

  it('skips cash-advance repayment when crediting a claim-order top-up', async () => {
    databaseService.getTransactionByReference.mockResolvedValue({
      ...baseTx,
      payment_entity: 'claim_order',
    });

    await processor.processMypvitCallback(successCallback);

    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith({
      accountId: baseTx.account_id,
      amount: baseTx.amount,
      memo: `Mobile payment deposit - ${baseTx.reference}`,
      referenceId: baseTx.id,
      idempotencyKey: `momo-deposit:${baseTx.id}`,
      skipCashAdvanceRepayment: true,
    });
  });

  it('leaves pending and does not mark success when wallet credit fails', async () => {
    databaseService.getTransactionByReference.mockResolvedValue({ ...baseTx });
    accountsService.registerDepositIfNotExists.mockResolvedValue({
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
    accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: true,
      alreadyExists: true,
    });

    const result = await processor.processMypvitCallback(successCallback);

    expect(result.skipped).toBe(true);
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith({
      accountId: baseTx.account_id,
      amount: baseTx.amount,
      memo: `Mobile payment deposit - ${baseTx.reference}`,
      referenceId: baseTx.id,
      idempotencyKey: `momo-deposit:${baseTx.id}`,
    });
  });

  it('credits missing deposit when provider retries an already-success tx', async () => {
    databaseService.getTransactionByReference.mockResolvedValue({
      ...baseTx,
      status: 'success',
    });
    accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: true,
      alreadyExists: false,
      transactionId: 'deposit-1',
    });

    await processor.processMypvitCallback(successCallback);

    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith({
      accountId: baseTx.account_id,
      amount: baseTx.amount,
      memo: `Mobile payment deposit - ${baseTx.reference}`,
      referenceId: baseTx.id,
      idempotencyKey: `momo-deposit:${baseTx.id}`,
    });
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('does not re-grant AI tokens when MyPVit retries an already-success pack', async () => {
    const onPaymentSuccess = jest.fn();
    paymentCallbackRegistry.getHandlers.mockReturnValue([
      {
        supportsPaymentEntity: (entity: string) => entity === 'token',
        onPaymentSuccess,
        onPaymentFailure: jest.fn(),
        finalizeCashReconciliationAfterPayment: jest.fn(),
      },
    ]);
    databaseService.getTransactionByReference.mockResolvedValue({
      ...baseTx,
      payment_entity: 'token',
      account_id: undefined,
      status: 'success',
    });

    const result = await processor.processMypvitCallback({
      ...successCallback,
      merchantReferenceId: baseTx.reference,
    });

    expect(result.skipped).toBe(true);
    expect(onPaymentSuccess).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('does not re-invoke handler for reel_ai_token on already-success MoMo retry', async () => {
    const onPaymentSuccess = jest.fn();
    paymentCallbackRegistry.getHandlers.mockReturnValue([
      {
        supportsPaymentEntity: (entity: string) => entity === 'reel_ai_token',
        onPaymentSuccess,
        onPaymentFailure: jest.fn(),
        finalizeCashReconciliationAfterPayment: jest.fn(),
      },
    ]);
    databaseService.getTransactionByReference.mockResolvedValue({
      ...baseTx,
      payment_entity: 'reel_ai_token',
      account_id: undefined,
      status: 'success',
    });

    const result = await processor.processMypvitCallback({
      ...successCallback,
      merchantReferenceId: baseTx.reference,
    });

    expect(result.skipped).toBe(true);
    expect(onPaymentSuccess).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });
});

describe('MobilePaymentCallbackProcessor GIVE_CHANGE', () => {
  const databaseService = {
    getTransactionByReference: jest.fn(),
    logCallback: jest.fn(),
    updateTransaction: jest.fn(),
    updateTransactionIfStatus: jest.fn().mockResolvedValue(true),
  };
  const accountsService = {
    hasTransactionForReference: jest.fn(),
    registerTransaction: jest.fn(),
    registerDepositIfNotExists: jest.fn(),
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
    accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: true,
      alreadyExists: false,
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
    expect(accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
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
    expect(accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      giveChangeTx.id,
      'pending',
      expect.objectContaining({ status: 'failed' })
    );
  });

  it('reverses legacy wallet debit on FAILED callback', async () => {
    accountsService.hasTransactionForReference.mockResolvedValueOnce(true);

    await processor.processMypvitCallback(failedCallback);

    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith({
      accountId: giveChangeTx.account_id,
      amount: giveChangeTx.amount,
      memo: `GIVE_CHANGE reversal - ${giveChangeTx.reference}`,
      referenceId: giveChangeTx.id,
      idempotencyKey: `momo-reversal:${giveChangeTx.id}`,
    });
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
  });

  it('does not release hold or reverse wallet when FAILED CAS loses to SUCCESS race', async () => {
    // Simulate a race: SUCCESS callback already moved the row to success
    databaseService.updateTransactionIfStatus.mockResolvedValueOnce(false);
    accountsService.hasTransactionForReference.mockResolvedValueOnce(true);

    await processor.processMypvitCallback(failedCallback);

    // CAS should have been attempted
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      giveChangeTx.id,
      'pending',
      expect.objectContaining({ status: 'failed' })
    );

    // But release and reverse should NOT happen since CAS lost
    expect(accountsService.registerReleaseIfNotExists).not.toHaveBeenCalled();
    expect(accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(accountsService.registerWithdrawalIfNotExists).not.toHaveBeenCalled();
  });
});

describe('MobilePaymentCallbackProcessor order_deposit', () => {
  const databaseService = {
    getTransactionByReference: jest.fn(),
    logCallback: jest.fn(),
    updateTransaction: jest.fn(),
    updateTransactionIfStatus: jest.fn().mockResolvedValue(true),
  };
  const accountsService = {
    hasTransactionForReference: jest.fn(),
    registerTransaction: jest.fn(),
    registerDepositIfNotExists: jest.fn(),
  };
  const mockOrderDepositHandler = {
    supportsPaymentEntity: (e: string) => e === 'order_deposit',
    onPaymentSuccess: jest.fn(),
    onPaymentFailure: jest.fn(),
    finalizeCashReconciliationAfterPayment: jest.fn(),
  };
  const paymentCallbackRegistry = {
    getHandlers: jest.fn().mockReturnValue([mockOrderDepositHandler]),
  };
  const mobilePaymentsService = {
    assertProviderConfirmsCallback: jest.fn().mockResolvedValue(undefined),
  };

  let processor: MobilePaymentCallbackProcessor;

  const orderDepositTx: MobilePaymentTransaction = {
    id: '44444444-4444-4444-4444-444444444444',
    reference: 'DEP12345678abcd',
    amount: 10000,
    currency: 'XAF',
    status: 'pending',
    account_id: '55555555-5555-5555-5555-555555555555',
    transaction_type: 'PAYMENT',
    payment_entity: 'order_deposit',
    entity_id: 'ORD123456',
    provider: 'mypvit',
    payment_method: 'mobile_money',
    created_at: '2026-09-09T00:00:00.000Z',
    updated_at: '2026-09-09T00:00:00.000Z',
  } as MobilePaymentTransaction;

  const successCallback = {
    transactionId: 'provider-deposit-1',
    merchantReferenceId: 'DEP12345678abcd',
    status: 'SUCCESS' as const,
    amount: 10000,
    customerID: '+237600000000',
    fees: 0,
    chargeOwner: 'MERCHANT',
    transactionOperation: 'PAYMENT',
    operator: 'MTN',
    code: 200,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new MobilePaymentCallbackProcessor(
      databaseService as never,
      accountsService as never,
      paymentCallbackRegistry as never,
      mobilePaymentsService as never
    );
    databaseService.getTransactionByReference.mockResolvedValue(orderDepositTx);
    databaseService.logCallback.mockResolvedValue(undefined);
    databaseService.updateTransaction.mockResolvedValue(undefined);
    mockOrderDepositHandler.onPaymentSuccess.mockResolvedValue(undefined);
  });

  it('skips processor wallet credit for order_deposit, delegates to handler only', async () => {
    await processor.processMypvitCallback(successCallback);

    // Should NOT credit via registerTransaction with referenceId=tx.id
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(accountsService.hasTransactionForReference).not.toHaveBeenCalled();
    expect(accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    
    // Should still call handler which does the single credit
    expect(mockOrderDepositHandler.onPaymentSuccess).toHaveBeenCalledWith(
      orderDepositTx
    );
    
    // Should mark transaction success using two CAS operations
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      orderDepositTx.id,
      'pending',
      { status: 'processing' }
    );
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      orderDepositTx.id,
      'processing',
      {
        status: 'success',
        transaction_id: 'provider-deposit-1',
      }
    );
  });

  it('fails closed when order_deposit handler throws during finalize', async () => {
    const finalizeError = new Error('Order deposit finalization failed');
    mockOrderDepositHandler.onPaymentSuccess.mockRejectedValue(finalizeError);

    await expect(processor.processMypvitCallback(successCallback)).rejects.toThrow(
      'Order deposit finalization failed'
    );

    // Should NOT mark transaction as success when handler fails (claim should be released)
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      orderDepositTx.id,
      'processing',
      { status: 'pending' }
    );
  });

  it('does not credit processor wallet in retry for already-success order_deposit', async () => {
    databaseService.getTransactionByReference.mockResolvedValue({
      ...orderDepositTx,
      status: 'success',
    });

    const result = await processor.processMypvitCallback(successCallback);

    expect(result.skipped).toBe(true);
    // Should NOT credit via processor
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(accountsService.hasTransactionForReference).not.toHaveBeenCalled();
    // Should still retry handler side effects
    expect(mockOrderDepositHandler.onPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success' })
    );
  });
});

describe('MobilePaymentCallbackProcessor Freemopay lookup', () => {
  const depositTx: MobilePaymentTransaction = {
    id: '11111111-1111-4111-8111-111111111111',
    reference: 'ORD-DEP-123',
    amount: 150,
    currency: 'XAF',
    description: 'Deposit',
    provider: 'freemopay',
    payment_method: 'mobile_money',
    status: 'pending',
    transaction_id: '942b4b0d-3cf1-484e-8509-eca52cb15678',
    account_id: 'acct-1',
    transaction_type: 'PAYMENT',
    payment_entity: 'order_deposit',
    entity_id: 'ORD-1',
    created_at: '2026-09-09T00:00:00.000Z',
    updated_at: '2026-09-09T00:00:00.000Z',
  };

  const databaseService = {
    getTransactionByTransactionId: jest.fn(),
    getTransactionByReference: jest.fn(),
    getTransactionById: jest.fn(),
    logCallback: jest.fn(),
    updateTransaction: jest.fn(),
    updateTransactionIfStatus: jest.fn().mockResolvedValue(true),
  };
  const accountsService = {
    hasTransactionForReference: jest.fn(),
    registerTransaction: jest.fn(),
  };
  const onPaymentSuccess = jest.fn();
  const paymentCallbackRegistry = {
    getHandlers: jest.fn().mockReturnValue([
      {
        supportsPaymentEntity: (e: string) => e === 'order_deposit',
        onPaymentSuccess,
        onPaymentFailure: jest.fn(),
        finalizeCashReconciliationAfterPayment: jest.fn(),
      },
    ]),
  };
  const mobilePaymentsService = {
    assertProviderConfirmsCallback: jest.fn().mockResolvedValue(undefined),
  };

  let processor: MobilePaymentCallbackProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new MobilePaymentCallbackProcessor(
      databaseService as never,
      accountsService as never,
      paymentCallbackRegistry as never,
      mobilePaymentsService as never
    );
    databaseService.logCallback.mockResolvedValue(undefined);
    databaseService.updateTransaction.mockResolvedValue(undefined);
    accountsService.hasTransactionForReference.mockResolvedValue(false);
    accountsService.registerTransaction.mockResolvedValue({ success: true });
  });

  it('finds the row by Freemopay provider reference', async () => {
    databaseService.getTransactionByTransactionId.mockResolvedValue(depositTx);

    const result = await processor.processFreemopayCallback({
      reference: depositTx.transaction_id as string,
      status: 'SUCCESS',
    });

    expect(result.received).toBe(true);
    expect(onPaymentSuccess).toHaveBeenCalled();
    expect(databaseService.getTransactionById).not.toHaveBeenCalled();
  });

  it('falls back to merchantRef when provider id is missing', async () => {
    databaseService.getTransactionByTransactionId.mockResolvedValue(null);
    databaseService.getTransactionByReference.mockImplementation(
      async (ref: string) => (ref === depositTx.reference ? depositTx : null)
    );

    await processor.processFreemopayCallback({
      reference: '942b4b0d-3cf1-484e-8509-eca52cb15678',
      merchantRef: depositTx.reference,
      status: 'SUCCESS',
    });

    expect(onPaymentSuccess).toHaveBeenCalled();
  });

  it('falls back to our row uuid', async () => {
    databaseService.getTransactionByTransactionId.mockResolvedValue(null);
    databaseService.getTransactionByReference.mockResolvedValue(null);
    databaseService.getTransactionById.mockResolvedValue(depositTx);

    await processor.processFreemopayCallback({
      reference: depositTx.id,
      status: 'SUCCESS',
    });

    expect(databaseService.getTransactionById).toHaveBeenCalledWith(depositTx.id);
    expect(onPaymentSuccess).toHaveBeenCalled();
  });

  it('confirms a live provider id before a public SUCCESS callback can pay', async () => {
    databaseService.getTransactionByTransactionId.mockResolvedValue(depositTx);
    mobilePaymentsService.assertProviderConfirmsCallback.mockRejectedValueOnce(
      new Error('provider status is pending')
    );

    await expect(
      processor.processFreemopayCallback({
        reference: 'mock-forged-by-caller',
        status: 'SUCCESS',
      })
    ).rejects.toThrow(/provider status is pending/i);

    expect(
      mobilePaymentsService.assertProviderConfirmsCallback
    ).toHaveBeenCalledWith(depositTx, 'SUCCESS');
    expect(onPaymentSuccess).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('skips live confirmation only when the stored id starts with mock-', async () => {
    const mocked = { ...depositTx, transaction_id: 'mock-942b4b0d' };
    databaseService.getTransactionByTransactionId.mockResolvedValue(mocked);

    await processor.processFreemopayCallback({
      reference: 'callback-ref',
      status: 'SUCCESS',
    });

    expect(
      mobilePaymentsService.assertProviderConfirmsCallback
    ).not.toHaveBeenCalled();
    expect(onPaymentSuccess).toHaveBeenCalledWith(mocked);
  });

  it.each(['Mock-1', 'mock', 'not-mock-1', ' mock-1', '', undefined])(
    'still confirms a live id that only looks mocked (%j)',
    async (transactionId) => {
      databaseService.getTransactionByTransactionId.mockResolvedValue({
        ...depositTx,
        transaction_id: transactionId,
      });

      await processor.processFreemopayCallback({
        reference: depositTx.reference,
        status: 'SUCCESS',
      });

      expect(
        mobilePaymentsService.assertProviderConfirmsCallback
      ).toHaveBeenCalledWith(
        expect.objectContaining({ transaction_id: transactionId }),
        'SUCCESS'
      );
    }
  );

  it('confirms a live FAILED callback and skips confirmation for a mock failure', async () => {
    databaseService.getTransactionByTransactionId.mockResolvedValue(depositTx);
    mobilePaymentsService.assertProviderConfirmsCallback.mockRejectedValueOnce(
      new Error('provider status is success')
    );

    await expect(
      processor.processFreemopayCallback({
        reference: depositTx.transaction_id as string,
        status: 'FAILED',
      })
    ).rejects.toThrow(/provider status is success/i);
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();

    databaseService.getTransactionByTransactionId.mockResolvedValue({
      ...depositTx,
      transaction_id: 'mock-failed',
    });
    await processor.processFreemopayCallback({
      reference: 'mock-failed',
      status: 'FAILED',
      reason: 'Customer cancelled',
    });
    expect(
      mobilePaymentsService.assertProviderConfirmsCallback
    ).toHaveBeenCalledTimes(1);
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      depositTx.id,
      'pending',
      expect.objectContaining({
        status: 'failed',
        error_message: 'Customer cancelled',
      })
    );
  });
});

describe('MobilePaymentCallbackProcessor order payment handler failure (UAT S-8)', () => {
  const databaseService = {
    getTransactionByReference: jest.fn(),
    logCallback: jest.fn(),
    updateTransaction: jest.fn(),
    updateTransactionIfStatus: jest.fn(),
    getTransactionById: jest.fn(),
  };
  const accountsService = {
    registerDepositIfNotExists: jest.fn(),
    hasTransactionForReference: jest.fn(),
    registerTransaction: jest.fn(),
  };
  const orderHandler = {
    supportsPaymentEntity: (e: string) => e === 'order',
    onPaymentSuccess: jest.fn(),
    onPaymentFailure: jest.fn(),
    finalizeCashReconciliationAfterPayment: jest.fn(),
  };
  const registry = { getHandlers: jest.fn().mockReturnValue([orderHandler]) };
  const mobilePaymentsService = {
    assertProviderConfirmsCallback: jest.fn().mockResolvedValue(undefined),
  };
  const orderTx: MobilePaymentTransaction = {
    id: '66666666-6666-4666-8666-666666666666',
    reference: 'ORD-1-123-abc',
    amount: 5000,
    currency: 'XAF',
    status: 'pending',
    account_id: '77777777-7777-4777-8777-777777777777',
    transaction_type: 'PAYMENT',
    payment_entity: 'order',
    entity_id: 'ORD-1',
    provider: 'mypvit',
    payment_method: 'mobile_money',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  } as MobilePaymentTransaction;
  const callback = {
    transactionId: 'provider-1',
    merchantReferenceId: 'ORD-1-123-abc',
    status: 'SUCCESS' as const,
    amount: 5000,
    customerID: '+237600000000',
    fees: 0,
    chargeOwner: 'MERCHANT',
    transactionOperation: 'PAYMENT',
    operator: 'MTN',
    code: 200,
  };
  let processor: MobilePaymentCallbackProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    registry.getHandlers.mockReturnValue([orderHandler]);
    processor = new MobilePaymentCallbackProcessor(
      databaseService as never,
      accountsService as never,
      registry as never,
      mobilePaymentsService as never
    );
    databaseService.getTransactionByReference.mockResolvedValue(orderTx);
    databaseService.logCallback.mockResolvedValue(undefined);
    databaseService.updateTransaction.mockResolvedValue(undefined);
    databaseService.updateTransactionIfStatus.mockResolvedValue(true);
    accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: true,
    });
    orderHandler.onPaymentSuccess.mockResolvedValue(undefined);
  });

  it('does not leave the tx success when the order finalize fails; alerts and releases the claim to pending for replay', async () => {
    orderHandler.onPaymentSuccess.mockRejectedValue(new Error('hold failed'));

    await expect(processor.processMypvitCallback(callback)).rejects.toThrow(
      'hold failed'
    );

    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
    // First CAS: pending -> processing
    expect(databaseService.updateTransactionIfStatus).toHaveBeenNthCalledWith(
      1,
      orderTx.id,
      'pending',
      { status: 'processing' }
    );
    // Second CAS: processing -> success (after wallet credit)
    expect(databaseService.updateTransactionIfStatus).toHaveBeenNthCalledWith(
      2,
      orderTx.id,
      'processing',
      { status: 'success', transaction_id: 'provider-1' }
    );
    // Third CAS: release claim back to pending when handler fails
    expect(databaseService.updateTransactionIfStatus).toHaveBeenNthCalledWith(
      3,
      orderTx.id,
      'processing',
      { status: 'pending' }
    );
    expect(reportMoneyAnomaly).toHaveBeenCalledWith(
      expect.anything(),
      'payment_finalize_failed',
      expect.stringContaining('entity=order'),
      expect.objectContaining({ transactionId: orderTx.id })
    );
  });

  it('releases success → pending when handler throws after the success mark (second CAS wins)', async () => {
    // Simulate success mark CAS winning but processing → pending losing (row already success)
    databaseService.updateTransactionIfStatus
      .mockResolvedValueOnce(true)  // pending -> processing
      .mockResolvedValueOnce(true)  // processing -> success
      .mockResolvedValueOnce(false) // processing -> pending loses
      .mockResolvedValueOnce(true); // success -> pending wins
    orderHandler.onPaymentSuccess.mockRejectedValue(new Error('handler failed after success'));

    await expect(processor.processMypvitCallback(callback)).rejects.toThrow(
      'handler failed after success'
    );

    expect(databaseService.updateTransactionIfStatus).toHaveBeenNthCalledWith(
      4,
      orderTx.id,
      'success',
      { status: 'pending' }
    );
    expect(reportMoneyAnomaly).toHaveBeenCalled();
  });

  it('marks success normally when the order finalize succeeds (no alert)', async () => {
    await processor.processMypvitCallback(callback);
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      orderTx.id,
      'pending',
      { status: 'processing' }
    );
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      orderTx.id,
      'processing',
      { status: 'success', transaction_id: 'provider-1' }
    );
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledTimes(2);
    expect(reportMoneyAnomaly).not.toHaveBeenCalled();
  });

  it('replay of an already-success tx alerts but does not 5xx the provider', async () => {
    databaseService.getTransactionByReference.mockResolvedValue({
      ...orderTx,
      status: 'success',
    });
    orderHandler.onPaymentSuccess.mockRejectedValue(new Error('still failing'));

    const result = await processor.processMypvitCallback(callback);

    expect(result.skipped).toBe(true);
    expect(reportMoneyAnomaly).toHaveBeenCalledWith(
      expect.anything(),
      'payment_finalize_failed',
      expect.stringContaining('(replay)'),
      expect.anything()
    );
  });

  it('resumes finalize when SUCCESS arrives on a stuck processing row (crash recovery)', async () => {
    databaseService.getTransactionByReference.mockResolvedValue({
      ...orderTx,
      status: 'processing',
    });
    // Resume path: credit (idempotent) → success → handler
    databaseService.updateTransactionIfStatus.mockResolvedValue(true);

    await processor.processMypvitCallback(callback);

    // Should credit wallet (idempotent)
    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalled();
    // Should mark processing → success
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      orderTx.id,
      'processing',
      { status: 'success', transaction_id: 'provider-1' }
    );
    // Should run handler
    expect(orderHandler.onPaymentSuccess).toHaveBeenCalled();
  });

  it('does not report money anomaly when CAS loses to a concurrent processing claim', async () => {
    databaseService.updateTransactionIfStatus.mockResolvedValueOnce(false); // pending -> processing loses
    databaseService.getTransactionById.mockResolvedValue({
      ...orderTx,
      status: 'processing',
    });

    await processor.processMypvitCallback(callback);

    expect(reportMoneyAnomaly).not.toHaveBeenCalled();
  });
});

describe('MobilePaymentCallbackProcessor non-order payment stuck processing recovery', () => {
  const databaseService = {
    getTransactionByReference: jest.fn(),
    logCallback: jest.fn(),
    updateTransaction: jest.fn(),
    updateTransactionIfStatus: jest.fn(),
    getTransactionById: jest.fn(),
  };
  const accountsService = {
    registerDepositIfNotExists: jest.fn(),
  };
  const registry = { getHandlers: jest.fn().mockReturnValue([]) };
  const mobilePaymentsService = {
    assertProviderConfirmsCallback: jest.fn().mockResolvedValue(undefined),
  };
  const accountTx: MobilePaymentTransaction = {
    id: '88888888-8888-4888-8888-888888888888',
    reference: 'RCHG-123-abc',
    amount: 5000,
    currency: 'XAF',
    status: 'processing',
    account_id: '99999999-9999-4999-8999-999999999999',
    transaction_type: 'PAYMENT',
    payment_entity: 'account',
    entity_id: '99999999-9999-4999-8999-999999999999',
    provider: 'freemopay',
    payment_method: 'mobile_money',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  } as MobilePaymentTransaction;
  const callback = {
    reference: 'freemopay-ref-1',
    status: 'SUCCESS' as const,
  };
  let processor: MobilePaymentCallbackProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new MobilePaymentCallbackProcessor(
      databaseService as never,
      accountsService as never,
      registry as never,
      mobilePaymentsService as never
    );
    databaseService.getTransactionByTransactionId = jest.fn().mockResolvedValue(accountTx);
    databaseService.logCallback.mockResolvedValue(undefined);
    databaseService.updateTransactionIfStatus.mockResolvedValue(true);
    accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: true,
    });
  });

  it('resumes finalize for non-order payment stuck in processing (Freemopay)', async () => {
    await processor.processFreemopayCallback(callback);

    // Should credit wallet (idempotent)
    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalled();
    // Should mark processing → success
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      accountTx.id,
      'processing',
      expect.objectContaining({ status: 'success' })
    );
  });

  it('resumes finalize for non-order payment stuck in processing (MyPVit)', async () => {
    databaseService.getTransactionByReference = jest.fn().mockResolvedValue(accountTx);
    const mypvitCallback = {
      transactionId: 'provider-1',
      merchantReferenceId: 'RCHG-123-abc',
      status: 'SUCCESS' as const,
      amount: 5000,
      customerID: '+237600000000',
      fees: 0,
      chargeOwner: 'MERCHANT',
      transactionOperation: 'PAYMENT',
      operator: 'MTN',
      code: 200,
    };

    await processor.processMypvitCallback(mypvitCallback);

    // Should credit wallet (idempotent)
    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalled();
    // Should mark processing → success
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      accountTx.id,
      'processing',
      expect.objectContaining({ status: 'success' })
    );
  });

  it('resume path leaves row in processing when handler throws after success mark', async () => {
    const orderHandlerMock = {
      supportsEntity: jest.fn().mockReturnValue(true),
      onPaymentSuccess: jest.fn().mockRejectedValue(new Error('Handler error')),
    };
    const registryWithHandler = {
      getHandlers: jest.fn().mockReturnValue([orderHandlerMock]),
    };
    const processorWithHandler = new MobilePaymentCallbackProcessor(
      databaseService as never,
      accountsService as never,
      registryWithHandler as never,
      mobilePaymentsService as never
    );
    const orderTx = { ...accountTx, payment_entity: 'order', entity_id: 'ORD-123' };
    databaseService.getTransactionByTransactionId.mockResolvedValue(orderTx);
    databaseService.updateTransactionIfStatus
      .mockResolvedValueOnce(true);  // processing → success succeeds

    await expect(processorWithHandler.processFreemopayCallback(callback)).rejects.toThrow('Handler error');

    // Should NOT roll back to pending after wallet was credited; row stays processing for recovery
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledTimes(1); // only processing → success
  });

  it('leaves row in processing when wallet credit fails', async () => {
    accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: false,
      error: 'Credit failed',
    });
    const orderTx = { ...accountTx, payment_entity: 'order', entity_id: 'ORD-123' };
    databaseService.getTransactionByReference.mockResolvedValue(orderTx);
    databaseService.updateTransactionIfStatus.mockResolvedValueOnce(true); // pending → processing claim

    await expect(processor.processMypvitCallback({
      transactionId: 'provider-tx-1',
      merchantReferenceId: accountTx.reference,
      status: 'SUCCESS',
      amount: accountTx.amount,
      customerID: '06123456',
      fees: 0,
      chargeOwner: 'MERCHANT',
      transactionOperation: 'PAYMENT',
      operator: 'MTN',
      code: 200,
    })).rejects.toThrow('Wallet credit failed');

    // Should release processing → pending when credit fails
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      orderTx.id,
      'processing',
      { status: 'pending' }
    );
  });

  it('leaves row in processing when handler throws after wallet credit', async () => {
    const orderHandlerMock = {
      supportsPaymentEntity: (e: string) => e === 'order',
      onPaymentSuccess: jest.fn().mockRejectedValue(new Error('Handler error')),
    };
    const registryWithHandler = {
      getHandlers: jest.fn().mockReturnValue([orderHandlerMock]),
    };
    const processorWithHandler = new MobilePaymentCallbackProcessor(
      databaseService as never,
      accountsService as never,
      registryWithHandler as never,
      mobilePaymentsService as never
    );
    const orderTx = { ...accountTx, payment_entity: 'order', entity_id: 'ORD-123' };
    databaseService.getTransactionByReference.mockResolvedValue(orderTx);
    databaseService.logCallback = jest.fn().mockResolvedValue(undefined);
    databaseService.updateTransactionIfStatus
      .mockResolvedValueOnce(true)  // pending → processing claim
      .mockResolvedValueOnce(true); // processing → success mark

    await expect(processorWithHandler.processMypvitCallback({
      transactionId: 'provider-tx-1',
      merchantReferenceId: orderTx.reference,
      status: 'SUCCESS',
      amount: orderTx.amount,
      customerID: '06123456',
      fees: 0,
      chargeOwner: 'MERCHANT',
      transactionOperation: 'PAYMENT',
      operator: 'MTN',
      code: 200,
    })).rejects.toThrow('Handler error');

    // Should NOT roll back after credit succeeded; row stays in processing for recovery
    // Only the claim and success mark CAS should have been called, no rollback
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledTimes(2);
  });
});

describe('MobilePaymentCallbackProcessor GIVE_CHANGE CAS and idempotency', () => {
  let databaseService: any;
  let accountsService: any;
  let mobilePaymentsService: any;
  let processor: MobilePaymentCallbackProcessor;

  beforeEach(() => {
    databaseService = {
      getTransactionByReference: jest.fn(),
      getTransactionById: jest.fn(),
      updateTransactionIfStatus: jest.fn(),
      logCallback: jest.fn().mockResolvedValue(undefined),
    };
    accountsService = {
      registerReleaseIfNotExists: jest.fn().mockResolvedValue({ success: true }),
      registerWithdrawalIfNotExists: jest.fn().mockResolvedValue({
        success: true,
        alreadyExists: false,
      }),
    };
    mobilePaymentsService = {
      assertProviderConfirmsCallback: jest.fn(),
      checkTransactionStatus: jest.fn(),
    };
    const registry = { getHandlers: jest.fn().mockReturnValue([]) };
    processor = new MobilePaymentCallbackProcessor(
      databaseService,
      accountsService,
      registry,
      mobilePaymentsService
    );
  });

  const giveChangeTx: MobilePaymentTransaction = {
    id: 'gc-uuid-1',
    reference: 'GC12345678',
    amount: 5000,
    currency: 'XAF',
    description: 'Withdrawal',
    provider: 'mypvit',
    payment_method: 'mobile_money',
    status: 'pending',
    transaction_id: 'provider-gc-1',
    customer_phone: '+24106123456',
    account_id: 'account-uuid-1',
    transaction_type: 'GIVE_CHANGE',
    created_at: '2026-10-15T10:00:00.000Z',
    updated_at: '2026-10-15T10:00:00.000Z',
  };

  it('GIVE_CHANGE SUCCESS uses CAS (pending → processing → success)', async () => {
    databaseService.getTransactionByReference.mockResolvedValue(giveChangeTx);
    databaseService.updateTransactionIfStatus
      .mockResolvedValueOnce(true)  // pending → processing claim
      .mockResolvedValueOnce(true); // processing → success

    await processor.processMypvitCallback({
      transactionId: 'provider-gc-1',
      merchantReferenceId: giveChangeTx.reference,
      status: 'SUCCESS',
      amount: giveChangeTx.amount,
      customerID: '06123456',
      fees: 0,
      chargeOwner: 'MERCHANT',
      transactionOperation: 'PAYOUT',
      operator: 'AIRTEL',
      code: 200,
    });

    // Should claim with CAS
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      giveChangeTx.id,
      'pending',
      { status: 'processing' }
    );
    // Should debit wallet with idempotency key
    expect(accountsService.registerWithdrawalIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `momo-giveout:${giveChangeTx.id}`,
      })
    );
    // Should mark success with CAS
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      giveChangeTx.id,
      'processing',
      expect.objectContaining({ status: 'success' })
    );
  });

  it('GIVE_CHANGE SUCCESS skips when row is already failed (never overwrites FAILED)', async () => {
    const failedGcTx = { ...giveChangeTx, status: 'failed' as const };
    databaseService.getTransactionByReference.mockResolvedValue(giveChangeTx);
    databaseService.updateTransactionIfStatus.mockResolvedValueOnce(false); // CAS fails
    databaseService.getTransactionById.mockResolvedValue(failedGcTx);

    await processor.processMypvitCallback({
      transactionId: 'provider-gc-1',
      merchantReferenceId: giveChangeTx.reference,
      status: 'SUCCESS',
      amount: giveChangeTx.amount,
      customerID: '06123456',
      fees: 0,
      chargeOwner: 'MERCHANT',
      transactionOperation: 'PAYOUT',
      operator: 'AIRTEL',
      code: 200,
    });

    // Should not debit wallet or change status when row is failed
    expect(accountsService.registerWithdrawalIfNotExists).not.toHaveBeenCalled();
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledTimes(1); // only the claim attempt
  });

  it('GIVE_CHANGE SUCCESS skips when CAS loses to concurrent processing', async () => {
    const processingGcTx = { ...giveChangeTx, status: 'processing' as const };
    databaseService.getTransactionByReference.mockResolvedValue(giveChangeTx);
    databaseService.updateTransactionIfStatus.mockResolvedValueOnce(false); // CAS fails
    databaseService.getTransactionById.mockResolvedValue(processingGcTx);

    await processor.processMypvitCallback({
      transactionId: 'provider-gc-1',
      merchantReferenceId: giveChangeTx.reference,
      status: 'SUCCESS',
      amount: giveChangeTx.amount,
      customerID: '06123456',
      fees: 0,
      chargeOwner: 'MERCHANT',
      transactionOperation: 'PAYOUT',
      operator: 'AIRTEL',
      code: 200,
    });

    // Should not proceed when another writer holds the processing claim
    expect(accountsService.registerWithdrawalIfNotExists).not.toHaveBeenCalled();
  });
});

describe('MobilePaymentCallbackProcessor stale processing recovery', () => {
  let databaseService: any;
  let accountsService: any;
  let mobilePaymentsService: any;
  let processor: MobilePaymentCallbackProcessor;

  beforeEach(() => {
    databaseService = {
      getTransactionById: jest.fn(),
      hasWalletDepositForTransaction: jest.fn(),
      updateTransactionIfStatus: jest.fn(),
    };
    accountsService = {};
    mobilePaymentsService = {
      checkTransactionStatus: jest.fn(),
    };
    const registry = {
      getHandlers: jest.fn().mockReturnValue([
        {
          supportsPaymentEntity: jest.fn().mockReturnValue(true),
          onPaymentSuccess: jest.fn(),
        },
      ]),
    };
    processor = new MobilePaymentCallbackProcessor(
      databaseService,
      accountsService,
      registry,
      mobilePaymentsService
    );
  });

  const processingTx: MobilePaymentTransaction = {
    id: 'proc-uuid-1',
    reference: 'PROC12345678',
    amount: 10000,
    currency: 'XAF',
    description: 'Order payment',
    provider: 'mypvit',
    payment_method: 'mobile_money',
    status: 'processing',
    transaction_id: 'provider-proc-1',
    customer_phone: '+24106123456',
    account_id: 'account-uuid-1',
    transaction_type: 'PAYMENT',
    payment_entity: 'order',
    entity_id: 'ORD-123',
    created_at: '2026-10-15T09:00:00.000Z',
    updated_at: '2026-10-15T09:01:00.000Z',
  };

  it('recovers stale processing row when wallet deposit exists', async () => {
    databaseService.hasWalletDepositForTransaction.mockResolvedValue(true);
    databaseService.updateTransactionIfStatus.mockResolvedValue(true);

    await processor.recoverStaleProcessingTransaction(processingTx);

    // Should check for wallet deposit
    expect(databaseService.hasWalletDepositForTransaction).toHaveBeenCalledWith(processingTx.id);
    // Should mark success
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      processingTx.id,
      'processing',
      { status: 'success' }
    );
  });

  it('queries provider and resumes when wallet deposit does not exist and provider confirms SUCCESS', async () => {
    databaseService.hasWalletDepositForTransaction.mockResolvedValue(false);
    mobilePaymentsService.checkTransactionStatus.mockResolvedValue({
      status: 'success',
      transactionId: 'provider-proc-1',
    });
    databaseService.updateTransactionIfStatus.mockResolvedValue(true);

    await processor.recoverStaleProcessingTransaction(processingTx);

    // Should query provider
    expect(mobilePaymentsService.checkTransactionStatus).toHaveBeenCalledWith(
      processingTx.id,
      processingTx.provider
    );
  });

  it('marks failed when provider confirms FAILED', async () => {
    databaseService.hasWalletDepositForTransaction.mockResolvedValue(false);
    mobilePaymentsService.checkTransactionStatus.mockResolvedValue({
      status: 'failed',
      message: 'Payment failed',
    });
    databaseService.updateTransactionIfStatus.mockResolvedValue(true);

    await processor.recoverStaleProcessingTransaction(processingTx);

    // Should mark failed
    expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      processingTx.id,
      'processing',
      expect.objectContaining({
        status: 'failed',
        error_message: 'Payment failed',
      })
    );
  });

  it('leaves as processing when provider status is still pending', async () => {
    databaseService.hasWalletDepositForTransaction.mockResolvedValue(false);
    mobilePaymentsService.checkTransactionStatus.mockResolvedValue({
      status: 'pending',
    });

    await processor.recoverStaleProcessingTransaction(processingTx);

    // Should not update status (leave as processing for next recovery attempt)
    expect(databaseService.updateTransactionIfStatus).not.toHaveBeenCalled();
  });
});

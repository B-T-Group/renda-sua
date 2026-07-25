import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';

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
    processor = new MobilePaymentCallbackProcessor(
      databaseService as never,
      accountsService as never,
      paymentCallbackRegistry as never
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

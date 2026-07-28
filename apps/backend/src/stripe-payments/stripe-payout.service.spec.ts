import { HttpException, HttpStatus } from '@nestjs/common';
import { StripePayoutService } from './stripe-payout.service';

describe('StripePayoutService', () => {
  const databaseService = {
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
  };
  const accountsService = {
    accountBelongsToUser: jest.fn(),
    getAccountBalance: jest.fn(),
    registerWithdrawalIfNotExists: jest.fn(),
  };
  const stripeService = {
    createTransfer: jest.fn(),
    createTransferReversal: jest.fn(),
  };
  const connectService = {
    getByUserId: jest.fn(),
    isPayoutReady: jest.fn(),
  };

  const payoutParams = {
    amount: 25,
    currency: 'USD',
    accountId: 'wallet-other-user',
    userId: 'authenticated-user',
    description: 'Wallet withdrawal',
  };

  let service: StripePayoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StripePayoutService(
      databaseService as never,
      accountsService as never,
      stripeService as never,
      connectService as never
    );
  });

  it('rejects payouts from accounts not owned by the user', async () => {
    accountsService.accountBelongsToUser.mockResolvedValue(false);

    try {
      await service.executePayout(payoutParams, { throwOnFailure: true });
      fail('Expected payout to be rejected');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(error.getResponse()).toEqual({
        success: false,
        error: 'ACCOUNT_NOT_OWNED',
      });
    }

    expect(accountsService.getAccountBalance).not.toHaveBeenCalled();
    expect(databaseService.createTransaction).not.toHaveBeenCalled();
    expect(connectService.getByUserId).not.toHaveBeenCalled();
    expect(stripeService.createTransfer).not.toHaveBeenCalled();
    expect(accountsService.registerWithdrawalIfNotExists).not.toHaveBeenCalled();
  });

  it('does not debit wallet when Stripe transfer fails', async () => {
    accountsService.accountBelongsToUser.mockResolvedValue(true);
    accountsService.getAccountBalance.mockResolvedValue({ availableBalance: 100 });
    connectService.isPayoutReady.mockResolvedValue(true);
    connectService.getByUserId.mockResolvedValue({
      stripe_account_id: 'acct_connect',
    });
    databaseService.createTransaction.mockResolvedValue({ id: 'stripe-tx-1' });
    stripeService.createTransfer.mockRejectedValue(new Error('Insufficient funds'));

    const result = await service.executePayout(payoutParams, {
      throwOnFailure: false,
    });

    expect(result.success).toBe(false);
    expect(accountsService.registerWithdrawalIfNotExists).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).toHaveBeenCalledWith(
      'stripe-tx-1',
      expect.objectContaining({ error_code: 'TRANSFER_FAILED' })
    );
  });

  it('reverses transfer and marks failed when ledger debit fails after transfer', async () => {
    accountsService.accountBelongsToUser.mockResolvedValue(true);
    accountsService.getAccountBalance.mockResolvedValue({ availableBalance: 100 });
    connectService.isPayoutReady.mockResolvedValue(true);
    connectService.getByUserId.mockResolvedValue({
      stripe_account_id: 'acct_connect',
    });
    databaseService.createTransaction.mockResolvedValue({ id: 'stripe-tx-1' });
    stripeService.createTransfer.mockResolvedValue({ id: 'tr_123' });
    accountsService.registerWithdrawalIfNotExists.mockResolvedValue({
      success: false,
      error: 'Insufficient funds for this transaction',
    });
    stripeService.createTransferReversal.mockResolvedValue({ id: 'trr_123' });

    const callOrder: string[] = [];
    stripeService.createTransfer.mockImplementation(async () => {
      callOrder.push('transfer');
      return { id: 'tr_123' };
    });
    accountsService.registerWithdrawalIfNotExists.mockImplementation(async () => {
      callOrder.push('withdrawal');
      return { success: false, error: 'Insufficient funds for this transaction' };
    });
    stripeService.createTransferReversal.mockImplementation(async () => {
      callOrder.push('reversal');
      return { id: 'trr_123' };
    });
    databaseService.updateTransaction.mockImplementation(async () => {
      callOrder.push('update');
    });

    const result = await service.executePayout(payoutParams, {
      throwOnFailure: false,
    });

    expect(result.success).toBe(false);
    expect(callOrder).toEqual(['transfer', 'withdrawal', 'reversal', 'update']);
    expect(stripeService.createTransferReversal).toHaveBeenCalledWith(
      'tr_123',
      'reversal_payout_stripe-tx-1'
    );
    expect(databaseService.updateTransaction).toHaveBeenCalledWith(
      'stripe-tx-1',
      expect.objectContaining({
        status: 'failed',
        error_code: 'WITHDRAWAL_FAILED',
        stripe_payment_intent_id: 'tr_123',
      })
    );
  });

  it('marks success only after transfer and wallet debit succeed', async () => {
    accountsService.accountBelongsToUser.mockResolvedValue(true);
    accountsService.getAccountBalance.mockResolvedValue({ availableBalance: 100 });
    connectService.isPayoutReady.mockResolvedValue(true);
    connectService.getByUserId.mockResolvedValue({
      stripe_account_id: 'acct_connect',
    });
    databaseService.createTransaction.mockResolvedValue({ id: 'stripe-tx-1' });
    stripeService.createTransfer.mockResolvedValue({ id: 'tr_123' });
    accountsService.registerWithdrawalIfNotExists.mockResolvedValue({
      success: true,
      transactionId: 'ledger-1',
    });

    const callOrder: string[] = [];
    stripeService.createTransfer.mockImplementation(async () => {
      callOrder.push('transfer');
      return { id: 'tr_123' };
    });
    accountsService.registerWithdrawalIfNotExists.mockImplementation(async () => {
      callOrder.push('withdrawal');
      return { success: true, transactionId: 'ledger-1' };
    });
    databaseService.updateTransaction.mockImplementation(async () => {
      callOrder.push('success');
    });

    const result = await service.executePayout(payoutParams, {
      throwOnFailure: false,
    });

    expect(result.success).toBe(true);
    expect(callOrder).toEqual(['transfer', 'withdrawal', 'success']);
    expect(databaseService.updateTransaction).toHaveBeenCalledWith(
      'stripe-tx-1',
      expect.objectContaining({ status: 'success', stripe_payment_intent_id: 'tr_123' })
    );
  });

  it('records reversal failure when ledger debit and Stripe reversal both fail', async () => {
    accountsService.accountBelongsToUser.mockResolvedValue(true);
    accountsService.getAccountBalance.mockResolvedValue({ availableBalance: 100 });
    connectService.isPayoutReady.mockResolvedValue(true);
    connectService.getByUserId.mockResolvedValue({
      stripe_account_id: 'acct_connect',
    });
    databaseService.createTransaction.mockResolvedValue({ id: 'stripe-tx-1' });
    stripeService.createTransfer.mockResolvedValue({ id: 'tr_123' });
    accountsService.registerWithdrawalIfNotExists.mockResolvedValue({
      success: false,
      error: 'Insufficient funds for this transaction',
    });
    stripeService.createTransferReversal.mockRejectedValue(
      new Error('Reversal rejected')
    );

    const result = await service.executePayout(payoutParams, {
      throwOnFailure: false,
    });

    expect(result.success).toBe(false);
    expect(databaseService.updateTransaction).toHaveBeenCalledWith(
      'stripe-tx-1',
      expect.objectContaining({
        status: 'failed',
        error_code: 'WITHDRAWAL_AND_REVERSAL_FAILED',
      })
    );
  });

  it('returns payout success when ledger steps succeed but status update fails', async () => {
    accountsService.accountBelongsToUser.mockResolvedValue(true);
    accountsService.getAccountBalance.mockResolvedValue({ availableBalance: 100 });
    connectService.isPayoutReady.mockResolvedValue(true);
    connectService.getByUserId.mockResolvedValue({
      stripe_account_id: 'acct_connect',
    });
    databaseService.createTransaction.mockResolvedValue({ id: 'stripe-tx-1' });
    stripeService.createTransfer.mockResolvedValue({ id: 'tr_123' });
    accountsService.registerWithdrawalIfNotExists.mockResolvedValue({
      success: true,
      transactionId: 'ledger-1',
    });
    databaseService.updateTransaction.mockRejectedValue(new Error('DB unavailable'));

    const result = await service.executePayout(payoutParams, {
      throwOnFailure: false,
    });

    expect(result.success).toBe(true);
    expect(result.data?.transferId).toBe('tr_123');
  });
});

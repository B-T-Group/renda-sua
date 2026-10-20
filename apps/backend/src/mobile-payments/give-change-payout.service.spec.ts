import { GiveChangePayoutService } from './give-change-payout.service';

describe('GiveChangePayoutService', () => {
  const databaseService = {
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
  };
  const mobilePaymentsService = {
    initiatePayment: jest.fn(),
  };
  const accountsService = {
    getAccountBalance: jest.fn(),
    registerTransaction: jest.fn(),
    registerHoldIfNotExists: jest.fn(),
    registerReleaseIfNotExists: jest.fn(),
  };

  let service: GiveChangePayoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GiveChangePayoutService(
      databaseService as never,
      mobilePaymentsService as never,
      accountsService as never
    );
    accountsService.getAccountBalance.mockResolvedValue({
      availableBalance: 10000,
      currency: 'XAF',
    });
    databaseService.createTransaction.mockResolvedValue({
      id: 'mobile-tx-1',
      reference: 'P12345678abcd',
    });
    mobilePaymentsService.initiatePayment.mockResolvedValue({
      success: true,
      transactionId: 'provider-ref-1',
      message: 'CREATED',
      provider: 'freemopay',
    });
    databaseService.updateTransaction.mockResolvedValue(undefined);
    accountsService.registerHoldIfNotExists.mockResolvedValue({
      success: true,
      transactionId: 'hold-1',
    });
    accountsService.registerReleaseIfNotExists.mockResolvedValue({
      success: true,
      transactionId: 'release-1',
    });
  });

  it('reserves funds with a hold and does not debit wallet on provider accept', async () => {
    const result = await service.executeGiveChangePayout(
      {
        amount: 5000,
        currency: 'XAF',
        description: 'Auto payout',
        customerPhone: '+237600000000',
        accountId: 'acct-1',
        provider: 'freemopay',
      },
      { throwOnWithdrawalFailure: false }
    );

    expect(result.success).toBe(true);
    expect(result.data?.transactionId).toBe('mobile-tx-1');
    expect(accountsService.registerHoldIfNotExists).toHaveBeenCalledWith({
      accountId: 'acct-1',
      amount: 5000,
      referenceId: 'mobile-tx-1',
      memo: expect.stringContaining('GIVE_CHANGE hold'),
      idempotencyKey: expect.stringContaining('give-change-hold:'),
    });
    expect(databaseService.updateTransaction).toHaveBeenCalledWith('mobile-tx-1', {
      transaction_id: 'provider-ref-1',
      status: 'pending',
    });
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
  });

  describe('F-L5 & F-L6: Idempotency key on give-change hold', () => {
    it('should include idempotency key in hold to prevent duplicates', async () => {
      const params = {
        amount: 5000,
        currency: 'XOF',
        description: 'Test withdrawal',
        customerPhone: '+22890123456',
        provider: 'fedapay' as const,
        accountId: 'acct-1',
        transactionType: 'GIVE_CHANGE' as const,
        accountOwnerId: 'user-1',
      };

      databaseService.createTransaction.mockResolvedValue({
        id: 'tx-123',
        reference: 'REF-456',
        status: 'pending',
      } as any);
      accountsService.registerHoldIfNotExists.mockResolvedValue({
        success: true,
        transactionId: 'hold-tx-1',
      });
      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'provider-789',
      });

      await service.executeGiveChangePayout(params, { throwOnWithdrawalFailure: false });

      // Verify idempotency key is passed with proper format
      expect(accountsService.registerHoldIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: expect.stringMatching(/^give-change-hold:P[0-9a-z]+$/),
        })
      );
    });

    it('should handle idempotent hold success (alreadyExists: true)', async () => {
      const params = {
        amount: 5000,
        currency: 'XOF',
        description: 'Retry withdrawal',
        customerPhone: '+22890123456',
        provider: 'fedapay' as const,
        accountId: 'acct-1',
        transactionType: 'GIVE_CHANGE' as const,
        accountOwnerId: 'user-1',
      };

      databaseService.createTransaction.mockResolvedValue({
        id: 'tx-retry',
        reference: 'REF-RETRY',
        status: 'pending',
      } as any);
      // Second call with same key returns alreadyExists: true
      accountsService.registerHoldIfNotExists.mockResolvedValue({
        success: true,
        alreadyExists: true,
        transactionId: 'hold-existing',
      });
      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'provider-retry',
      });

      const result = await service.executeGiveChangePayout(params, { throwOnWithdrawalFailure: false });

      // Should proceed normally even when hold already exists
      expect(result.success).toBe(true);
      expect(mobilePaymentsService.initiatePayment).toHaveBeenCalled();
    });
  });

  describe('N3: keep provider id on failed withdrawal rows', () => {
    const params = {
      amount: 5000,
      currency: 'XOF',
      description: 'Auto payout',
      customerPhone: '+22890000001',
      accountId: 'acct-1',
      provider: 'fedapay',
    } as any;

    it('writes the FedaPay payout id with status failed and still releases the hold', async () => {
      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: false,
        transactionId: 'fedapay-payout-9',
        errorCode: 'PAYOUT_FAILED',
        message: 'Payout failed',
        provider: 'fedapay',
      });

      const result = await service.executeGiveChangePayout(params, {
        throwOnWithdrawalFailure: false,
      });

      expect(result.success).toBe(false);
      expect(databaseService.updateTransaction).toHaveBeenCalledWith('mobile-tx-1', {
        status: 'failed',
        error_message: 'Payout failed',
        error_code: 'PAYOUT_FAILED',
        transaction_id: 'fedapay-payout-9',
      });
      expect(accountsService.registerReleaseIfNotExists).toHaveBeenCalledTimes(1);
    });

    it('keeps the hold when FedaPay reports an ambiguous payout', async () => {
      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'fedapay-payout-amb',
        provider: 'fedapay',
        status: 'pending',
        reason: 'provider_ambiguous',
        message: 'Payout send timed out',
      });

      const result = await service.executeGiveChangePayout(params, {
        throwOnWithdrawalFailure: false,
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        providerTransactionId: 'fedapay-payout-amb',
        status: 'pending',
        reason: 'provider_ambiguous',
      });
      expect(databaseService.updateTransaction).toHaveBeenCalledWith('mobile-tx-1', {
        transaction_id: 'fedapay-payout-amb',
        status: 'pending',
      });
      expect(accountsService.registerReleaseIfNotExists).not.toHaveBeenCalled();
      expect(accountsService.registerHoldIfNotExists).toHaveBeenCalledTimes(1);
    });

    it('does not write transaction_id when the provider returned none', async () => {
      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: false,
        errorCode: 'PROVIDER_INIT_FAILED',
        message: 'create failed',
      });

      await service.executeGiveChangePayout(params, { throwOnWithdrawalFailure: false });

      const failedUpdate = databaseService.updateTransaction.mock.calls.find(
        ([, patch]) => patch?.status === 'failed'
      );
      expect(failedUpdate).toBeDefined();
      expect(failedUpdate![1]).not.toHaveProperty('transaction_id');
    });
  });

  it('releases hold when provider initiation fails', async () => {
    mobilePaymentsService.initiatePayment.mockResolvedValue({
      success: false,
      message: 'Insufficient funds',
      errorCode: 'INSUFFICIENT_FUNDS',
    });

    await service.executeGiveChangePayout(
      {
        amount: 5000,
        currency: 'XAF',
        description: 'Auto payout',
        customerPhone: '+237600000000',
        accountId: 'acct-1',
      },
      { throwOnWithdrawalFailure: false }
    );

    expect(accountsService.registerReleaseIfNotExists).toHaveBeenCalledWith({
      accountId: 'acct-1',
      amount: 5000,
      referenceId: 'mobile-tx-1',
      memo: expect.stringContaining('GIVE_CHANGE release'),
    });
  });

  it('marks tx failed when provider initiation fails', async () => {
    mobilePaymentsService.initiatePayment.mockResolvedValue({
      success: false,
      message: 'Insufficient funds',
      errorCode: 'INSUFFICIENT_FUNDS',
    });

    const result = await service.executeGiveChangePayout(
      {
        amount: 5000,
        currency: 'XAF',
        description: 'Auto payout',
        customerPhone: '+237600000000',
        accountId: 'acct-1',
      },
      { throwOnWithdrawalFailure: false }
    );

    expect(result.success).toBe(false);
    expect(databaseService.updateTransaction).toHaveBeenCalledWith(
      'mobile-tx-1',
      expect.objectContaining({ status: 'failed' })
    );
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
  });

  it('marks failed and releases hold when initiatePayment throws', async () => {
    mobilePaymentsService.initiatePayment.mockRejectedValue(
      new Error('network down')
    );

    const result = await service.executeGiveChangePayout(
      {
        amount: 5000,
        currency: 'XAF',
        description: 'Auto payout',
        customerPhone: '+237600000000',
        accountId: 'acct-1',
      },
      { throwOnWithdrawalFailure: false }
    );

    expect(result.success).toBe(false);
    expect(databaseService.updateTransaction).toHaveBeenCalledWith(
      'mobile-tx-1',
      expect.objectContaining({
        status: 'failed',
        error_code: 'INITIATION_EXCEPTION',
      })
    );
    expect(accountsService.registerReleaseIfNotExists).toHaveBeenCalled();
  });

  it('does not release hold when provider accepted but local update fails', async () => {
    databaseService.updateTransaction.mockRejectedValueOnce(
      new Error('hasura down')
    );

    await expect(
      service.executeGiveChangePayout(
        {
          amount: 5000,
          currency: 'XAF',
          description: 'Auto payout',
          customerPhone: '+237600000000',
          accountId: 'acct-1',
          provider: 'freemopay',
        },
        { throwOnWithdrawalFailure: false }
      )
    ).rejects.toThrow('hasura down');

    expect(accountsService.registerReleaseIfNotExists).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).toHaveBeenCalledWith(
      'mobile-tx-1',
      expect.objectContaining({
        transaction_id: 'provider-ref-1',
        status: 'pending',
      })
    );
  });

  it('marks failed before releasing when provider returns no transaction id', async () => {
    mobilePaymentsService.initiatePayment.mockResolvedValue({
      success: true,
      message: 'CREATED',
      provider: 'freemopay',
    });

    const result = await service.executeGiveChangePayout(
      {
        amount: 5000,
        currency: 'XAF',
        description: 'Auto payout',
        customerPhone: '+237600000000',
        accountId: 'acct-1',
      },
      { throwOnWithdrawalFailure: false }
    );

    expect(result.success).toBe(false);
    const statusCallOrder = databaseService.updateTransaction.mock.invocationCallOrder[0];
    const releaseCallOrder =
      accountsService.registerReleaseIfNotExists.mock.invocationCallOrder[0];
    expect(statusCallOrder).toBeLessThan(releaseCallOrder);
    expect(databaseService.updateTransaction).toHaveBeenCalledWith(
      'mobile-tx-1',
      expect.objectContaining({ status: 'failed' })
    );
  });
});

import { DepositRefundService } from './deposit-refund.service';

describe('DepositRefundService', () => {
  const paidOrder = {
    id: 'order-1',
    order_number: '49520979',
    current_status: 'cancelled',
    fulfillment_method: 'delivery',
    currency: 'XAF',
    deposit_amount: 2000,
    deposit_status: 'paid',
    deposit_refund_status: 'none',
    recipient_phone: '+237600000000',
    client: { user_id: 'client-user-1' },
  };

  const hasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
    getAccount: jest.fn(),
  };
  const giveChangePayoutService = {
    executeGiveChangePayout: jest.fn(),
  };
  const depositCalculationService = {
    isAfterRefundLockPoint: jest.fn().mockReturnValue(false),
  };
  const accountsService = {
    registerWithdrawalIfNotExists: jest.fn(),
  };

  let service: DepositRefundService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DepositRefundService(
      hasuraSystemService as never,
      giveChangePayoutService as never,
      depositCalculationService as never,
      accountsService as never
    );
    hasuraSystemService.executeQuery.mockResolvedValue({
      orders_by_pk: paidOrder,
    });
    hasuraSystemService.getAccount.mockResolvedValue({ id: 'acct-client' });
    hasuraSystemService.executeMutation.mockResolvedValue({});
    giveChangePayoutService.executeGiveChangePayout.mockResolvedValue({
      success: true,
      data: { transactionId: 'refund-tx-1' },
    });
    accountsService.registerWithdrawalIfNotExists.mockResolvedValue({
      success: true,
    });
  });

  it('refunds through GiveChange so the wallet hold can debit on callback', async () => {
    const result = await service.refundDeposit('order-1');

    expect(result.success).toBe(true);
    expect(giveChangePayoutService.executeGiveChangePayout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2000,
        accountId: 'acct-client',
        customerPhone: '+237600000000',
        entityId: '49520979',
        paymentEntity: 'order_deposit',
      }),
      { throwOnWithdrawalFailure: false }
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('MarkDepositRefundAttempted'),
      expect.objectContaining({ orderId: 'order-1', status: 'pending' })
    );
  });

  it('does not send a raw initiatePayment without a ledger-backed payout row', async () => {
    await service.refundDeposit('order-1');
    expect(giveChangePayoutService.executeGiveChangePayout).toHaveBeenCalled();
  });

  it('reverses the deposit wallet credit before marking a forfeit', async () => {
    const result = await service.forfeitDeposit(
      'order-1',
      'customer_cancel_after_lock'
    );

    expect(result.success).toBe(true);
    expect(accountsService.registerWithdrawalIfNotExists).toHaveBeenCalledWith({
      accountId: 'acct-client',
      amount: 2000,
      referenceId: 'order-1',
      memo: 'Deposit forfeit for order 49520979',
    });
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('ForfeitDeposit'),
      expect.objectContaining({
        orderId: 'order-1',
        reason: 'customer_cancel_after_lock',
      })
    );
  });

  it('does not mark forfeited when wallet reversal fails', async () => {
    accountsService.registerWithdrawalIfNotExists.mockResolvedValue({
      success: false,
      error: 'INSUFFICIENT_FUNDS',
    });

    const result = await service.forfeitDeposit(
      'order-1',
      'customer_cancel_after_lock'
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('INSUFFICIENT_FUNDS');
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });
});

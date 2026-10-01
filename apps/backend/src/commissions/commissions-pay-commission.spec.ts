jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../accounts/accounts.service', () => ({
  AccountsService: class AccountsService {},
}));
jest.mock('../mobile-payments/give-change-payout.service', () => ({
  GiveChangePayoutService: class GiveChangePayoutService {},
}));
jest.mock('../stripe-payments/payment-routing.service', () => ({
  PaymentRoutingService: class PaymentRoutingService {},
}));
jest.mock('../stripe-payments/stripe-payout.service', () => ({
  StripePayoutService: class StripePayoutService {},
}));
jest.mock('../launch-promo/launch-promo.service', () => ({
  LaunchPromoService: class LaunchPromoService {},
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: class MerchantLifecycleService {},
}));

import { CommissionsService } from './commissions.service';

describe('CommissionsService.payCommission failure handling', () => {
  const order = { id: 'order-1', order_number: 'ORD-1', currency: 'XAF' };

  function createService() {
    const accountsService = {
      registerTransaction: jest
        .fn()
        .mockResolvedValue({ success: true, transactionId: 'tx-1' }),
    };
    const hasura = {
      getAccount: jest.fn().mockResolvedValue({ id: 'acct-1' }),
      // default: no existing deposit; audit insert succeeds
      executeQuery: jest.fn().mockResolvedValue({ account_transactions: [] }),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    const service = new CommissionsService(
      accountsService as any,
      hasura as any,
      {} as any,
      { sendWalletCreditPush: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any
    );
    jest
      .spyOn(service as any, 'tryAutoWithdrawAfterCommission')
      .mockResolvedValue(undefined);
    return { service, accountsService, hasura };
  }

  const pay = (service: CommissionsService, type: any = 'order_subtotal') =>
    (service as any).payCommission(
      order,
      'user-1',
      'business',
      type,
      900,
      'XAF'
    );

  it('deposits and audits on the happy path', async () => {
    const { service, accountsService, hasura } = createService();
    await pay(service);
    expect(accountsService.registerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct-1',
        amount: 900,
        transactionType: 'deposit',
        referenceId: 'order-1',
      })
    );
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertCommissionPayout'),
      expect.anything()
    );
  });

  it('throws when the deposit is rejected (no silent success)', async () => {
    const { service, accountsService } = createService();
    accountsService.registerTransaction.mockResolvedValue({
      success: false,
      error: 'Account not found',
    });
    await expect(pay(service)).rejects.toThrow(/Commission deposit failed/);
  });

  it('throws when the recipient account cannot be resolved', async () => {
    const { service, hasura, accountsService } = createService();
    hasura.getAccount.mockResolvedValue(null);
    await expect(pay(service)).rejects.toThrow(/Account not found/);
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
  });

  it('skips a recipient already paid for this order/type (retry safety)', async () => {
    const { service, hasura, accountsService } = createService();
    hasura.executeQuery.mockResolvedValue({
      account_transactions: [{ id: 'existing' }],
    });
    await pay(service);
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
  });

  it('uses distinct memos so base and per-km agent payouts are not mistaken for each other', async () => {
    const { service, hasura } = createService();
    await (service as any).payCommission(
      order, 'agent-1', 'agent', 'base_delivery_fee', 100, 'XAF'
    );
    await (service as any).payCommission(
      order, 'agent-1', 'agent', 'per_km_delivery_fee', 100, 'XAF'
    );
    const memos = hasura.executeQuery.mock.calls.map(([, v]) => v.memo);
    expect(new Set(memos).size).toBe(2);
  });
});

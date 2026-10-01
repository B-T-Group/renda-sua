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
import type { CommissionConfig } from './types';

describe('waived delivery agent earnings', () => {
  const service = new CommissionsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  const config: CommissionConfig = {
    rendasuaItemCommissionPercentage: 12,
    unverifiedAgentBaseDeliveryCommission: 50,
    verifiedAgentBaseDeliveryCommission: 0,
    unverifiedAgentPerKmDeliveryCommission: 80,
    verifiedAgentPerKmDeliveryCommission: 20,
  };

  it('pays the agent from the stored pre-waiver base and per-km fees', () => {
    const earnings = service.calculateAgentEarningsSync(
      {
        id: 'order-1',
        base_delivery_fee: 500,
        per_km_delivery_fee: 300,
        currency: 'XAF',
        first_order_delivery_fee_promo: false,
      },
      false,
      config
    );

    expect(earnings.baseDeliveryCommission).toBe(250);
    expect(earnings.perKmDeliveryCommission).toBe(240);
    expect(earnings.totalEarnings).toBe(490);
  });
});

describe('waived delivery fee: platform funds only the agent pay', () => {
  const HQ = { id: 'hq-user', email: 'hq@rendasua.com' };
  const partner = {
    id: 'p1',
    user_id: 'partner-user',
    base_delivery_fee_commission: 10,
    per_km_delivery_fee_commission: 10,
    item_commission: 5,
  };
  const baseOrder = {
    id: 'order-1',
    order_number: 'ORD-1',
    currency: 'XAF',
    base_delivery_fee: 500,
    per_km_delivery_fee: 300,
    delivery_fee_waived: true,
    first_order_delivery_fee_promo: false,
    assigned_agent: { id: 'agent-1', user_id: 'agent-user', is_verified: false },
  };
  // unverified agent: base 50% of 500 = 250; per-km 80% of 300 = 240
  const config = {
    rendasuaItemCommissionPercentage: 12,
    unverifiedAgentBaseDeliveryCommission: 50,
    verifiedAgentBaseDeliveryCommission: 0,
    unverifiedAgentPerKmDeliveryCommission: 80,
    verifiedAgentPerKmDeliveryCommission: 20,
  };

  function setup(
    opts: {
      order?: Record<string, unknown>;
      partners?: unknown[];
      txs?: Array<{ memo: string }>;
      failOn?: (req: any) => boolean;
    } = {}
  ) {
    let n = 0;
    const registerTransaction = jest.fn(async (req: any) =>
      opts.failOn?.(req)
        ? { success: false, error: 'boom' }
        : { success: true, transactionId: `tx-${++n}` }
    );
    const accounts = {
      'agent-user': { id: 'agent-acc' },
      'hq-user': { id: 'hq-acc' },
      'partner-user': { id: 'partner-acc' },
    } as Record<string, { id: string }>;
    const executeQuery = jest.fn(async (q: string) =>
      q.includes('WaivedFundingRows') || q.includes('WaivedAgentCreditExists')
        ? { account_transactions: opts.txs ?? [] }
        : {}
    );
    const executeMutation = jest.fn().mockResolvedValue({});
    const service = new CommissionsService(
      { registerTransaction } as never,
      {
        getAccount: jest.fn(async (u: string) => accounts[u]),
        executeQuery,
        executeMutation,
      } as never,
      {} as never,
      { sendWalletCreditPush: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never
    );
    jest.spyOn(service, 'getCommissionConfigs').mockResolvedValue(config as never);
    jest.spyOn(service, 'getRendasuaHQUser').mockResolvedValue(HQ);
    jest
      .spyOn(service, 'getActivePartners')
      .mockResolvedValue((opts.partners ?? [partner]) as never);
    jest
      .spyOn(service as any, 'tryAutoWithdrawAfterCommission')
      .mockResolvedValue(undefined);
    return {
      service,
      registerTransaction,
      executeMutation,
      order: { ...baseOrder, ...opts.order },
    };
  }

  const txs = (m: jest.Mock) => m.mock.calls.map(([r]) => r);
  const audits = (m: jest.Mock) =>
    m.mock.calls
      .map(([, v]) => v?.payout)
      .filter(Boolean);

  it('debits HQ by exactly the agent share, credits the agent, and pays nobody else', async () => {
    const { service, registerTransaction, executeMutation, order } = setup();
    await service.distributeDeliveryCommissions(order);

    const calls = txs(registerTransaction);
    const hq = calls.filter((r) => r.accountId === 'hq-acc');
    const agent = calls.filter((r) => r.accountId === 'agent-acc');
    expect(hq.map((r) => [r.transactionType, r.amount, r.allowNegative])).toEqual([
      ['payment', 250, true],
      ['payment', 240, true],
    ]);
    expect(agent.map((r) => [r.transactionType, r.amount])).toEqual([
      ['deposit', 250],
      ['deposit', 240],
    ]);
    // no partner, no other account, no client
    expect(calls.every((r) => ['hq-acc', 'agent-acc'].includes(r.accountId))).toBe(
      true
    );
    const hqTotal = hq.reduce((a, r) => a + r.amount, 0);
    const agentTotal = agent.reduce((a, r) => a + r.amount, 0);
    expect(hqTotal).toBe(agentTotal); // ledger sums to zero
    // funding is ordered before the agent credit
    expect(calls.findIndex((r) => r.accountId === 'hq-acc')).toBeLessThan(
      calls.findIndex((r) => r.accountId === 'agent-acc')
    );
    expect(hq[0].memo).toContain('funded by platform');
    expect(audits(executeMutation).map((p) => [p.commission_type, p.recipient_type, p.amount])).toEqual(
      expect.arrayContaining([
        ['platform_funded_delivery', 'rendasua', 250],
        ['platform_funded_delivery', 'rendasua', 240],
        ['base_delivery_fee', 'agent', 250],
        ['per_km_delivery_fee', 'agent', 240],
      ])
    );
  });

  it('reverses the HQ debit and throws when the agent credit fails (nobody paid from nothing)', async () => {
    const { service, registerTransaction, order } = setup({
      failOn: (r) => r.accountId === 'agent-acc',
    });
    await expect(service.distributeDeliveryCommissions(order)).rejects.toThrow(
      /platform funding reversed/
    );
    const hq = txs(registerTransaction).filter((r) => r.accountId === 'hq-acc');
    expect(hq.map((r) => [r.transactionType, r.amount])).toEqual([
      ['payment', 250],
      ['deposit', 250], // reversal
    ]);
    expect(hq[1].memo).toContain('reversal');
  });

  it('pays nobody and throws when the HQ debit fails', async () => {
    const { service, registerTransaction, order } = setup({
      failOn: (r) => r.accountId === 'hq-acc',
    });
    await expect(service.distributeDeliveryCommissions(order)).rejects.toThrow(
      /funding failed/
    );
    expect(
      txs(registerTransaction).filter((r) => r.accountId === 'agent-acc')
    ).toHaveLength(0);
  });

  it('throws when the HQ user is missing', async () => {
    const { service, order } = setup();
    jest.spyOn(service, 'getRendasuaHQUser').mockResolvedValue(null);
    await expect(service.distributeDeliveryCommissions(order)).rejects.toThrow(
      /HQ user not found/
    );
  });

  it('retry: skips a component the agent already received and does not fund it again', async () => {
    const { service, registerTransaction, order } = setup({
      txs: [
        { memo: 'Delivery commission (base) for order ORD-1 (agent)' },
        {
          memo: 'Waived delivery fee funded by platform (agent base pay) - order ORD-1',
        },
      ],
    });
    // both lookups return the same rows in this mock; base is "already credited"
    await service.distributeDeliveryCommissions(order);
    const hqAmounts = txs(registerTransaction)
      .filter((r) => r.accountId === 'hq-acc')
      .map((r) => r.amount);
    expect(hqAmounts).not.toContain(250);
  });

  it('retry: an open (un-reversed) HQ funding row is not debited twice, only the agent is credited', async () => {
    const { service, registerTransaction, order } = setup({
      order: { per_km_delivery_fee: 0 },
    });
    // simulate: HQ funded base, agent not yet credited
    (service as any).hasuraSystemService.executeQuery.mockImplementation(
      async (q: string) =>
        q.includes('WaivedFundingRows')
          ? {
              account_transactions: [
                {
                  memo: 'Waived delivery fee funded by platform (agent base pay) - order ORD-1',
                },
              ],
            }
          : { account_transactions: [] }
    );
    await service.distributeDeliveryCommissions(order);
    const calls = txs(registerTransaction);
    expect(calls.filter((r) => r.accountId === 'hq-acc')).toHaveLength(0);
    expect(calls.filter((r) => r.accountId === 'agent-acc')).toHaveLength(1);
  });

  it('non-waived orders are unchanged: partners and HQ share paid, no platform funding', async () => {
    const { service, registerTransaction, order } = setup({
      order: { delivery_fee_waived: false },
    });
    await service.distributeDeliveryCommissions(order);
    const calls = txs(registerTransaction);
    expect(calls.some((r) => r.transactionType === 'payment')).toBe(false);
    expect(calls.some((r) => r.accountId === 'partner-acc')).toBe(true);
    expect(calls.some((r) => r.accountId === 'hq-acc' && r.transactionType === 'deposit')).toBe(true);
  });

  it('first-order delivery promo on a waived order still only funds the agent', async () => {
    const { service, registerTransaction, order } = setup({
      order: { first_order_delivery_fee_promo: true, per_km_delivery_fee: 0 },
    });
    await service.distributeDeliveryCommissions(order);
    const agentDeposits = txs(registerTransaction).filter(
      (r) => r.accountId === 'agent-acc'
    );
    // promo gives the agent base minus partner share (500 - 50)
    expect(agentDeposits.map((r) => r.amount)).toEqual([450]);
    expect(
      txs(registerTransaction).filter((r) => r.accountId === 'hq-acc')[0].amount
    ).toBe(450);
  });

  it('does nothing when no agent is assigned', async () => {
    const { service, registerTransaction, order } = setup({
      order: { assigned_agent: null },
    });
    await service.distributeDeliveryCommissions(order);
    expect(registerTransaction).not.toHaveBeenCalled();
  });
});

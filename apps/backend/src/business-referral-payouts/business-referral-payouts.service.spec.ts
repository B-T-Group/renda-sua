import { BusinessReferralPayoutsService } from './business-referral-payouts.service';

describe('BusinessReferralPayoutsService', () => {
  const eligibleBusiness = {
    id: 'biz-1',
    name: 'Acme Market',
    referred_by_agent_id: 'agent-1',
    agent: {
      id: 'agent-1',
      user_id: 'user-1',
      user: { id: 'user-1', preferred_language: 'en' },
    },
    items_aggregate: { aggregate: { count: 12 } },
  };

  function buildService(overrides?: {
    enabled?: boolean | null;
    businesses?: typeof eligibleBusiness[];
    countryCode?: string | null;
    payoutAmount?: number;
    accountId?: string | null;
    registerError?: Error;
  }) {
    const enabled =
      overrides && 'enabled' in overrides ? overrides.enabled : true;
    const businesses = overrides?.businesses ?? [eligibleBusiness];
    const countryCode =
      overrides && 'countryCode' in overrides ? overrides.countryCode : 'CA';
    const payoutAmount = overrides?.payoutAmount ?? 25;
    const accountId =
      overrides && 'accountId' in overrides ? overrides.accountId : 'acct-1';

    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('EligibleReferredBusinesses')) {
        return { businesses };
      }
      if (query.includes('GetAgentAccount')) {
        return { accounts: accountId ? [{ id: accountId }] : [] };
      }
      return {};
    });
    const executeMutation = jest.fn(async () => ({
      insert_business_referral_payouts_one: { id: 'payout-1' },
    }));
    const registerTransaction = jest.fn(async () => {
      if (overrides?.registerError) throw overrides.registerError;
      return { transactionId: 'tx-1' };
    });
    const resolveRailForUser = jest.fn(async () => 'stripe');
    const getUserCountryCode = jest.fn(async () => countryCode);
    const sendInternalPushByUserId = jest.fn(async () => undefined);
    const getConfigurationByKey = jest.fn(
      async (key: string) => {
        if (key === 'business_referral_payout_enabled') {
          if (enabled === null) throw new Error('config unavailable');
          return { boolean_value: enabled, status: 'active' };
        }
        if (key === 'business_referral_payout_amount') {
          return { number_value: payoutAmount };
        }
        return null;
      }
    );

    const service = new BusinessReferralPayoutsService(
      { executeQuery, executeMutation } as never,
      { registerTransaction } as never,
      { resolveRailForUser, getUserCountryCode } as never,
      { sendInternalPushByUserId } as never,
      { getConfigurationByKey } as never
    );

    return {
      service,
      executeQuery,
      executeMutation,
      registerTransaction,
      sendInternalPushByUserId,
      getConfigurationByKey,
    };
  }

  it('skips the weekly run when payouts are disabled', async () => {
    const { service, executeQuery, registerTransaction } = buildService({
      enabled: false,
    });

    const summary = await service.runWeeklyPayouts();

    expect(summary).toEqual({
      processed: 0,
      credited: 0,
      skipped: 0,
      failures: 0,
      skippedReason: 'disabled',
    });
    expect(executeQuery).not.toHaveBeenCalled();
    expect(registerTransaction).not.toHaveBeenCalled();
  });

  it('treats a payout-enabled config read failure as disabled', async () => {
    const { service, registerTransaction } = buildService({ enabled: null });

    const summary = await service.runWeeklyPayouts();

    expect(summary.skippedReason).toBe('disabled');
    expect(registerTransaction).not.toHaveBeenCalled();
  });

  it('credits the referring agent, records the payout, and notifies', async () => {
    const {
      service,
      registerTransaction,
      executeMutation,
      sendInternalPushByUserId,
    } = buildService();

    const summary = await service.runWeeklyPayouts();

    expect(summary).toEqual({
      processed: 1,
      credited: 1,
      skipped: 0,
      failures: 0,
    });
    expect(registerTransaction).toHaveBeenCalledWith({
      accountId: 'acct-1',
      amount: 25,
      transactionType: 'deposit',
      memo: 'Business referral bonus',
      referenceId: 'biz-1',
    });
    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertBusinessReferralPayout'),
      expect.objectContaining({
        input: expect.objectContaining({
          business_id: 'biz-1',
          agent_id: 'agent-1',
          account_id: 'acct-1',
          transaction_id: 'tx-1',
          amount: 25,
          currency: 'CAD',
          rail: 'stripe',
          item_count: 12,
        }),
      })
    );
    expect(sendInternalPushByUserId).toHaveBeenCalledWith(
      'user-1',
      'Referral credit',
      expect.stringContaining('Acme Market'),
      expect.objectContaining({ event: 'business_referral_credit' })
    );
  });

  it('skips when no payout amount is configured for the agent country', async () => {
    const { service, registerTransaction } = buildService({
      payoutAmount: 0,
    });

    const summary = await service.runWeeklyPayouts();

    expect(summary).toEqual({
      processed: 1,
      credited: 0,
      skipped: 1,
      failures: 0,
    });
    expect(registerTransaction).not.toHaveBeenCalled();
  });

  it('skips when the agent has no matching currency account', async () => {
    const { service, registerTransaction } = buildService({
      accountId: null,
    });

    const summary = await service.runWeeklyPayouts();

    expect(summary.skipped).toBe(1);
    expect(summary.credited).toBe(0);
    expect(registerTransaction).not.toHaveBeenCalled();
  });

  it('continues processing after a per-business credit failure', async () => {
    const second = {
      ...eligibleBusiness,
      id: 'biz-2',
      name: 'Beta Shop',
    };
    const { service, registerTransaction } = buildService({
      businesses: [eligibleBusiness, second],
      registerError: new Error('ledger down'),
    });
    registerTransaction
      .mockRejectedValueOnce(new Error('ledger down'))
      .mockResolvedValueOnce({ transactionId: 'tx-2' });

    const summary = await service.runWeeklyPayouts();

    expect(summary).toEqual({
      processed: 2,
      credited: 1,
      skipped: 0,
      failures: 1,
    });
    expect(registerTransaction).toHaveBeenCalledTimes(2);
  });
});

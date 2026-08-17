jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../accounts/accounts.service', () => ({
  AccountsService: class AccountsService {},
}));
jest.mock('../admin/configurations.service', () => ({
  ConfigurationsService: class ConfigurationsService {},
}));

import { ReferralPyramidService } from './referral-pyramid.service';

describe('ReferralPyramidService', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const accounts = {
    findDepositByReference: jest.fn(),
    findDepositByReferenceId: jest.fn(),
    registerTransaction: jest.fn(),
  };
  const configurations = {
    getConfigurationByKey: jest.fn(),
  };
  const notifications = {
    sendInternalPushByUserId: jest.fn(),
  };

  let service: ReferralPyramidService;

  const earner = {
    kind: 'agent' as const,
    id: 'agent-earner',
    userId: 'user-earner',
    name: 'Ada',
  };
  const referred = {
    kind: 'business' as const,
    id: 'biz-1',
    name: 'Shop',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReferralPyramidService(
      hasura as never,
      accounts as never,
      configurations as never,
      notifications as never
    );
    configurations.getConfigurationByKey.mockImplementation(
      async (key: string) => {
        if (key === 'referral_pyramid_gen1_percent') {
          return { number_value: 5 };
        }
        if (key === 'referral_pyramid_gen2_percent') {
          return { number_value: 3 };
        }
        if (key === 'referral_pyramid_gen3_percent') {
          return { number_value: 1 };
        }
        return null;
      }
    );
    accounts.findDepositByReference.mockResolvedValue(null);
    accounts.findDepositByReferenceId.mockResolvedValue(null);
    accounts.registerTransaction.mockResolvedValue({
      success: true,
      transactionId: 'tx-new',
    });
    notifications.sendInternalPushByUserId.mockResolvedValue(undefined);
    hasura.executeMutation.mockResolvedValue({
      insert_referral_bonus_distributions_one: { id: 'dist-1' },
    });
  });

  function mockNoUplineAndPersonalAccount(accountId = 'acct-earner') {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('AgentReferralParent')) {
        return { agents_by_pk: {} };
      }
      if (query.includes('BusinessReferralParent')) {
        return { businesses_by_pk: {} };
      }
      if (query.includes('ExistingBizDist') || query.includes('ExistingAgentDist')) {
        return { referral_bonus_distributions: [] };
      }
      if (query.includes('PyramidPersonalAccount')) {
        return { accounts: [{ id: accountId }] };
      }
      if (query.includes('UserLang')) {
        return { users_by_pk: { preferred_language: 'en' } };
      }
      return {};
    });
  }

  it('requires a business payout or agent referral id', async () => {
    await expect(
      service.distributeReferralBonus({
        grossAmount: 1000,
        earner,
        referred,
        preferPersonalAccount: true,
        currency: 'XAF',
      })
    ).rejects.toThrow('Distribution source payout/referral id is required');
  });

  it('returns zero credits for non-positive gross amounts', async () => {
    await expect(
      service.distributeReferralBonus({
        grossAmount: 0,
        earner,
        referred,
        preferPersonalAccount: true,
        currency: 'XAF',
        businessReferralPayoutId: 'payout-1',
      })
    ).resolves.toEqual({ credited: 0, transactionIds: [] });
    expect(accounts.registerTransaction).not.toHaveBeenCalled();
  });

  it('credits the earner and records a distribution row', async () => {
    mockNoUplineAndPersonalAccount();

    const result = await service.distributeReferralBonus({
      grossAmount: 5000,
      earner,
      referred,
      preferPersonalAccount: true,
      currency: 'XAF',
      businessReferralPayoutId: 'payout-1',
    });

    expect(result.credited).toBe(1);
    expect(result.transactionIds).toEqual(['tx-new']);
    expect(accounts.registerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct-earner',
        amount: 5000,
        transactionType: 'deposit',
      })
    );
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertReferralBonusDistribution'),
      expect.objectContaining({
        input: expect.objectContaining({
          generation: 0,
          amount: 5000,
          business_referral_payout_id: 'payout-1',
          beneficiary_agent_id: 'agent-earner',
          transaction_id: 'tx-new',
        }),
      })
    );
    expect(notifications.sendInternalPushByUserId).toHaveBeenCalledWith(
      'user-earner',
      'Referral credit',
      expect.stringContaining('5000 XAF'),
      expect.objectContaining({ event: 'referral_pyramid_credit' })
    );
  });

  it('reuses an existing distribution transaction without double-crediting', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('AgentReferralParent')) {
        return { agents_by_pk: {} };
      }
      if (query.includes('ExistingBizDist')) {
        return {
          referral_bonus_distributions: [{ transaction_id: 'tx-existing' }],
        };
      }
      return {};
    });

    const result = await service.distributeReferralBonus({
      grossAmount: 5000,
      earner,
      referred,
      preferPersonalAccount: true,
      currency: 'XAF',
      businessReferralPayoutId: 'payout-1',
    });

    expect(result).toEqual({
      credited: 1,
      transactionIds: ['tx-existing'],
    });
    expect(accounts.registerTransaction).not.toHaveBeenCalled();
    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(notifications.sendInternalPushByUserId).not.toHaveBeenCalled();
  });

  it('throws when the earner share cannot be credited', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('AgentReferralParent')) {
        return { agents_by_pk: {} };
      }
      if (query.includes('ExistingBizDist')) {
        return { referral_bonus_distributions: [] };
      }
      if (query.includes('PyramidPersonalAccount')) {
        return { accounts: [] };
      }
      return {};
    });

    await expect(
      service.distributeReferralBonus({
        grossAmount: 5000,
        earner,
        referred,
        preferPersonalAccount: true,
        currency: 'XAF',
        businessReferralPayoutId: 'payout-1',
      })
    ).rejects.toThrow(
      'Referral earner agent agent-earner could not be credited'
    );
  });

  it('credits upline shares after resolving parents', async () => {
    hasura.executeQuery.mockImplementation(async (query: string, vars: any) => {
      if (query.includes('AgentReferralParent') && vars.id === 'agent-earner') {
        return {
          agents_by_pk: {
            referring_agent: {
              id: 'agent-parent',
              user_id: 'user-parent',
              user: { first_name: 'Pat', last_name: 'Parent' },
            },
          },
        };
      }
      if (query.includes('AgentReferralParent') && vars.id === 'agent-parent') {
        return { agents_by_pk: {} };
      }
      if (query.includes('ExistingBizDist')) {
        return { referral_bonus_distributions: [] };
      }
      if (query.includes('PyramidPersonalAccount')) {
        return {
          accounts: [
            {
              id:
                vars.userId === 'user-parent'
                  ? 'acct-parent'
                  : 'acct-earner',
            },
          ],
        };
      }
      if (query.includes('UserLang')) {
        return { users_by_pk: { preferred_language: 'en' } };
      }
      return {};
    });
    accounts.registerTransaction
      .mockResolvedValueOnce({ success: true, transactionId: 'tx-earner' })
      .mockResolvedValueOnce({ success: true, transactionId: 'tx-parent' });

    const result = await service.distributeReferralBonus({
      grossAmount: 5000,
      earner,
      referred,
      preferPersonalAccount: true,
      currency: 'XAF',
      businessReferralPayoutId: 'payout-1',
    });

    expect(result.credited).toBe(2);
    expect(result.transactionIds).toEqual(['tx-earner', 'tx-parent']);
    expect(accounts.registerTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ accountId: 'acct-earner', amount: 4750 })
    );
    expect(accounts.registerTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ accountId: 'acct-parent', amount: 250 })
    );
  });

  it('treats unique distribution inserts as idempotent success', async () => {
    mockNoUplineAndPersonalAccount();
    hasura.executeMutation.mockRejectedValueOnce(
      new Error('Uniqueness violation on uq_referral_bonus_distributions')
    );

    await expect(
      service.distributeReferralBonus({
        grossAmount: 1000,
        earner,
        referred,
        preferPersonalAccount: true,
        currency: 'XAF',
        agentReferralId: 'agent-ref-1',
      })
    ).resolves.toEqual({
      credited: 1,
      transactionIds: ['tx-new'],
    });
  });

  it('falls back to default percents when config lookup fails', async () => {
    configurations.getConfigurationByKey.mockRejectedValue(
      new Error('config down')
    );
    mockNoUplineAndPersonalAccount();

    await service.distributeReferralBonus({
      grossAmount: 100,
      earner,
      referred,
      preferPersonalAccount: true,
      currency: 'XAF',
      businessReferralPayoutId: 'payout-1',
    });

    expect(accounts.registerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100 })
    );
  });
});

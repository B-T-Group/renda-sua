jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { BusinessReferralPayoutsService } from './business-referral-payouts.service';

describe('BusinessReferralPayoutsService agent wallet lookup', () => {
  const eligibleBusiness = {
    kind: 'agent' as const,
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

  function buildService() {
    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('EligibleAgentReferredBusinesses')) {
        return { businesses: [eligibleBusiness] };
      }
      if (query.includes('EligibleBusinessReferredBusinesses')) {
        return { businesses: [] };
      }
      if (query.includes('GetPersonalAccount')) {
        return { accounts: [{ id: 'acct-1' }] };
      }
      return {};
    });
    const executeMutation = jest.fn(async () => ({
      insert_business_referral_payouts_one: { id: 'payout-1' },
      update_business_referral_payouts: { affected_rows: 1 },
    }));
    const registerTransaction = jest.fn(async () => ({
      success: true,
      transactionId: 'tx-1',
    }));
    const findDepositByReference = jest.fn(async () => null);

    const service = new BusinessReferralPayoutsService(
      { executeQuery, executeMutation } as never,
      { registerTransaction, findDepositByReference } as never,
      {
        resolveRailForUser: jest.fn(async () => 'stripe'),
        getUserCountryCode: jest.fn(async () => 'CA'),
      } as never,
      { sendInternalPushByUserId: jest.fn(async () => undefined) } as never,
      {
        getConfigurationByKey: jest.fn(async (key: string) => {
          if (key === 'business_referral_payout_enabled') {
            return { boolean_value: true, status: 'active' };
          }
          if (key === 'business_referral_payout_amount') {
            return { number_value: 25 };
          }
          return null;
        }),
      } as never
    );

    return { service, executeQuery, registerTransaction };
  }

  it('looks up the agent personal wallet excluding business-location accounts', async () => {
    const { service, executeQuery, registerTransaction } = buildService();

    const summary = await service.runWeeklyPayouts();

    expect(summary.credited).toBe(1);
    const accountCall = executeQuery.mock.calls.find(([query]) =>
      String(query).includes('GetPersonalAccount')
    );
    expect(accountCall).toBeDefined();
    expect(String(accountCall?.[0])).toContain(
      'business_location_id: { _is_null: true }'
    );
    expect(accountCall?.[1]).toEqual({
      userId: 'user-1',
      currency: 'CAD',
    });
    expect(registerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acct-1', amount: 25 })
    );
  });
});

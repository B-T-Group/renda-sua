import { AgentReferralsService } from './agent-referrals.service';
import { ReferralPyramidService } from '../referrals/referral-pyramid.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

describe('AgentReferralsService.creditAfterFirstDelivery', () => {
  let service: AgentReferralsService;
  let hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock };
  let creditSpy: jest.SpiedFunction<
    AgentReferralsService['creditResolvedAgentReferral']
  >;

  const referringAgent = {
    id: 'ref-agent',
    user: {
      first_name: 'Ada',
      email: 'ada@x.com',
      preferred_language: 'en',
    },
  };

  beforeEach(() => {
    hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
    service = new AgentReferralsService(
      hasura as unknown as HasuraSystemService,
      {} as ReferralPyramidService,
      { getConfigurationByKey: jest.fn() } as never
    );
    creditSpy = jest
      .spyOn(service, 'creditResolvedAgentReferral')
      .mockResolvedValue(undefined);
  });

  function mockQueries(handlers: Record<string, unknown>) {
    hasura.executeQuery.mockImplementation((query: string) => {
      const match = Object.entries(handlers).find(([name]) =>
        query.includes(name)
      );
      return Promise.resolve(match ? match[1] : {});
    });
  }

  it('does not credit when a paid distribution already exists', async () => {
    mockQueries({
      AgentReferralByReferred: { agent_referrals: [{ id: 'paid' }] },
      AgentReferralPaidDist: {
        referral_bonus_distributions: [{ id: 'dist-1' }],
      },
    });
    await service.creditAfterFirstDelivery('new-agent', 'CM');
    expect(creditSpy).not.toHaveBeenCalled();
  });

  it('retries credit when a referral row exists without a paid distribution', async () => {
    mockQueries({
      AgentReferralByReferred: { agent_referrals: [{ id: 'orphan' }] },
      AgentReferralPaidDist: { referral_bonus_distributions: [] },
      AgentCompletedDeliveries: {
        orders_aggregate: { aggregate: { count: 1 } },
      },
      ReferredAgentForCredit: {
        agents_by_pk: {
          referral_code_used: 'ABC123',
          user: { first_name: 'Bob', last_name: 'Lee' },
          referring_agent: referringAgent,
        },
      },
    });
    await service.creditAfterFirstDelivery('new-agent', 'CM');
    expect(creditSpy).toHaveBeenCalled();
  });

  it('does not credit before the referred agent completes a delivery', async () => {
    mockQueries({
      AgentReferralByReferred: { agent_referrals: [] },
      AgentCompletedDeliveries: {
        orders_aggregate: { aggregate: { count: 0 } },
      },
    });
    await service.creditAfterFirstDelivery('new-agent', 'CM');
    expect(creditSpy).not.toHaveBeenCalled();
  });

  it('credits the referrer after the first completed delivery', async () => {
    mockQueries({
      AgentReferralByReferred: { agent_referrals: [] },
      AgentCompletedDeliveries: {
        orders_aggregate: { aggregate: { count: 1 } },
      },
      ReferredAgentForCredit: {
        agents_by_pk: {
          referral_code_used: 'ABC123',
          user: { first_name: 'Bob', last_name: 'Lee' },
          referring_agent: referringAgent,
        },
      },
    });
    await service.creditAfterFirstDelivery('new-agent', 'CM');
    expect(creditSpy).toHaveBeenCalledWith(
      'new-agent',
      {
        kind: 'agent',
        agentId: 'ref-agent',
        normalizedCode: 'ABC123',
        userEmail: 'ada@x.com',
        userFirstName: 'Ada',
        preferredLanguage: 'en',
      },
      'CM',
      'Bob Lee'
    );
  });

  it('skips when the agent has no stored referrer', async () => {
    mockQueries({
      AgentReferralByReferred: { agent_referrals: [] },
      AgentCompletedDeliveries: {
        orders_aggregate: { aggregate: { count: 1 } },
      },
      ReferredAgentForCredit: {
        agents_by_pk: {
          referral_code_used: 'ABC123',
          user: { first_name: 'Bob', last_name: 'Lee' },
        },
      },
    });
    await service.creditAfterFirstDelivery('new-agent', 'CM');
    expect(creditSpy).not.toHaveBeenCalled();
  });
});

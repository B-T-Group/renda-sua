import { HttpException, HttpStatus } from '@nestjs/common';
import { AdminReferralService } from './admin-referral.service';

describe('AdminReferralService', () => {
  let service: AdminReferralService;
  let hasura: { executeQuery: jest.Mock };
  let businessReferrals: {
    resolveBusinessReferralCode: jest.Mock;
    notifyReferrerOfBusinessReferral: jest.Mock;
  };
  let agentReferrals: {
    creditResolvedAgentReferral: jest.Mock;
    deleteReferralForReferredAgent: jest.Mock;
  };
  let paymentRouting: { getUserCountryCode: jest.Mock };

  const resolved = {
    kind: 'agent' as const,
    agentId: 'ref-agent',
    normalizedCode: 'ABC123',
    userEmail: 'a@x.com',
    userFirstName: 'Ada',
    preferredLanguage: 'en',
  };

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    businessReferrals = {
      resolveBusinessReferralCode: jest.fn().mockResolvedValue(resolved),
      notifyReferrerOfBusinessReferral: jest.fn().mockResolvedValue(undefined),
    };
    agentReferrals = {
      creditResolvedAgentReferral: jest.fn().mockResolvedValue(undefined),
      deleteReferralForReferredAgent: jest.fn().mockResolvedValue(undefined),
    };
    paymentRouting = { getUserCountryCode: jest.fn().mockResolvedValue('CM') };
    service = new AdminReferralService(
      hasura as any,
      businessReferrals as any,
      agentReferrals as any,
      paymentRouting as any
    );
  });

  it('credits the referrer when applying a code to an agent', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        agents_by_pk: {
          id: 'ag1',
          user_id: 'u1',
          referred_by_agent_id: null,
          referred_by_business_id: null,
          user: { first_name: 'Bob', last_name: 'Lee' },
        },
      })
      .mockResolvedValueOnce({ update_agents_by_pk: { id: 'ag1' } });

    await expect(service.applyToAgent('ag1', 'ABC123')).resolves.toEqual({
      success: true,
    });
    expect(businessReferrals.resolveBusinessReferralCode).toHaveBeenCalledWith(
      'ABC123',
      'u1'
    );
    expect(agentReferrals.creditResolvedAgentReferral).toHaveBeenCalledWith(
      'ag1',
      resolved,
      'CM',
      'Bob Lee',
      { swallowErrors: false }
    );
    expect(
      businessReferrals.notifyReferrerOfBusinessReferral
    ).not.toHaveBeenCalled();
  });

  it('notifies only when applying a code to a business', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        businesses_by_pk: {
          id: 'b1',
          user_id: 'u2',
          name: 'Shop',
          referred_by_agent_id: null,
          referred_by_business_id: null,
          user: { first_name: 'Pat', last_name: 'Kim' },
        },
      })
      .mockResolvedValueOnce({ update_businesses_by_pk: { id: 'b1' } });

    await expect(service.applyToBusiness('b1', 'ABC123')).resolves.toEqual({
      success: true,
    });
    expect(agentReferrals.creditResolvedAgentReferral).not.toHaveBeenCalled();
    expect(
      businessReferrals.notifyReferrerOfBusinessReferral
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'b1',
        businessName: 'Shop',
        businessOwnerName: 'Pat Kim',
      }),
      resolved
    );
  });

  it('rejects when the agent already has a referrer', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      agents_by_pk: {
        id: 'ag1',
        user_id: 'u1',
        referred_by_agent_id: 'existing',
        user: { first_name: 'Bob', last_name: 'Lee' },
      },
    });

    try {
      await service.applyToAgent('ag1', 'ABC123');
      fail('expected conflict');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    }
    expect(agentReferrals.creditResolvedAgentReferral).not.toHaveBeenCalled();
  });

  it('propagates an invalid referral code from resolve', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      agents_by_pk: {
        id: 'ag1',
        user_id: 'u1',
        referred_by_agent_id: null,
        referred_by_business_id: null,
        user: { first_name: 'Bob', last_name: 'Lee' },
      },
    });
    businessReferrals.resolveBusinessReferralCode.mockRejectedValueOnce(
      new HttpException(
        { success: false, error: 'Invalid referral code' },
        HttpStatus.BAD_REQUEST
      )
    );
    await expect(service.applyToAgent('ag1', 'XXXXXX')).rejects.toBeInstanceOf(
      HttpException
    );
    expect(agentReferrals.creditResolvedAgentReferral).not.toHaveBeenCalled();
  });

  it('rejects a missing agent', async () => {
    hasura.executeQuery.mockResolvedValueOnce({ agents_by_pk: null });
    await expect(service.applyToAgent('missing', 'ABC123')).rejects.toBeInstanceOf(
      HttpException
    );
  });

  it('does not persist a referrer when the agent has no country', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      agents_by_pk: {
        id: 'ag1',
        user_id: 'u1',
        referred_by_agent_id: null,
        referred_by_business_id: null,
        user: { first_name: 'Bob', last_name: 'Lee' },
      },
    });
    paymentRouting.getUserCountryCode.mockResolvedValueOnce(null);
    try {
      await service.applyToAgent('ag1', 'ABC123');
      fail('expected bad request');
    } catch (error: any) {
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
    expect(agentReferrals.creditResolvedAgentReferral).not.toHaveBeenCalled();
    expect(hasura.executeQuery).toHaveBeenCalledTimes(1);
  });

  it('rolls back persisted referrer FKs when credit fails', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        agents_by_pk: {
          id: 'ag1',
          user_id: 'u1',
          referred_by_agent_id: null,
          referred_by_business_id: null,
          user: { first_name: 'Bob', last_name: 'Lee' },
        },
      })
      .mockResolvedValueOnce({ update_agents_by_pk: { id: 'ag1' } })
      .mockResolvedValueOnce({ update_agents_by_pk: { id: 'ag1' } });
    agentReferrals.creditResolvedAgentReferral.mockRejectedValueOnce(
      new Error('payout failed')
    );

    await expect(service.applyToAgent('ag1', 'ABC123')).rejects.toThrow(
      'payout failed'
    );
    expect(hasura.executeQuery.mock.calls[1][0]).toContain(
      'AdminApplyAgentReferral'
    );
    expect(agentReferrals.deleteReferralForReferredAgent).toHaveBeenCalledWith(
      'ag1'
    );
    expect(hasura.executeQuery.mock.calls[2][0]).toContain(
      'AdminClearAgentReferral'
    );
  });
});

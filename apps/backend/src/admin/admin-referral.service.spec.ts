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
    creditAfterFirstDelivery: jest.Mock;
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
      creditAfterFirstDelivery: jest.fn().mockResolvedValue(undefined),
    };
    paymentRouting = { getUserCountryCode: jest.fn().mockResolvedValue('CM') };
    service = new AdminReferralService(
      hasura as any,
      businessReferrals as any,
      agentReferrals as any,
      paymentRouting as any
    );
  });

  it('persists the referrer and attempts first-delivery credit', async () => {
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
    expect(agentReferrals.creditAfterFirstDelivery).toHaveBeenCalledWith(
      'ag1',
      'CM'
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
    expect(agentReferrals.creditAfterFirstDelivery).not.toHaveBeenCalled();
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
    expect(agentReferrals.creditAfterFirstDelivery).not.toHaveBeenCalled();
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
    expect(agentReferrals.creditAfterFirstDelivery).not.toHaveBeenCalled();
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
    expect(agentReferrals.creditAfterFirstDelivery).not.toHaveBeenCalled();
    expect(hasura.executeQuery).toHaveBeenCalledTimes(1);
  });

  it('keeps the applied referrer when first-delivery credit is a no-op', async () => {
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
    expect(hasura.executeQuery.mock.calls[1][0]).toContain(
      'AdminApplyAgentReferral'
    );
    expect(agentReferrals.creditAfterFirstDelivery).toHaveBeenCalledWith(
      'ag1',
      'CM'
    );
    expect(hasura.executeQuery).toHaveBeenCalledTimes(2);
  });
});

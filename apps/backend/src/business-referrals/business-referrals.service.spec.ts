import { HttpException } from '@nestjs/common';

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { BusinessReferralsService } from './business-referrals.service';

describe('BusinessReferralsService', () => {
  const agentReferralsService = {
    normalizeAgentCode: jest.fn((code: string) => {
      const normalized = code.trim().toUpperCase();
      return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
    }),
    findAgentByCode: jest.fn(),
  };
  const hasuraSystemService = { executeQuery: jest.fn() };
  const notificationsService = {
    sendAgentBusinessReferredEmail: jest.fn(),
    sendInternalPushByUserId: jest.fn(),
  };
  const paymentRoutingService = {
    resolveRailForCountry: jest.fn().mockResolvedValue('mobile_money'),
    getUserCountryCode: jest.fn().mockResolvedValue('CM'),
  };
  const configService = {
    get: jest.fn().mockReturnValue('https://rendasua.com'),
  };

  let service: BusinessReferralsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BusinessReferralsService(
      agentReferralsService as never,
      hasuraSystemService as never,
      notificationsService as never,
      paymentRoutingService as never,
      configService as never
    );
    // Default: no user-level code match
    hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
  });

  it('resolves user-level referral codes to the owner agent persona', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('FindUserByReferralCode')) {
        return {
          users: [
            {
              id: 'user-u',
              email: 'u@example.com',
              first_name: 'Una',
              last_name: 'User',
              preferred_language: 'en',
              referral_code: 'USR001',
              internal: false,
              account_status: 'active',
            },
          ],
        };
      }
      if (query.includes('ActiveAgentForUser')) {
        return { agents: [{ id: 'agent-u' }] };
      }
      return {};
    });

    const resolved = await service.resolveBusinessReferralCode('USR001');
    expect(resolved).toEqual(
      expect.objectContaining({
        kind: 'agent',
        agentId: 'agent-u',
        normalizedCode: 'USR001',
      })
    );
  });

  it('resolves active agent codes', async () => {
    agentReferralsService.findAgentByCode.mockResolvedValue({
      agentId: 'agent-1',
      userId: 'user-a',
      userFirstName: 'Ann',
      userLastName: 'Agent',
      userEmail: 'ann@example.com',
      status: 'active',
      preferredLanguage: 'en',
    });
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('FindUserByReferralCode')) {
        return { users: [] };
      }
      if (query.includes('FindBusinessByCode')) {
        return { businesses: [] };
      }
      return {};
    });

    const resolved = await service.resolveBusinessReferralCode('ABC123');
    expect(resolved?.kind).toBe('agent');
  });

  it('falls back to business when agent exists but is inactive', async () => {
    agentReferralsService.findAgentByCode.mockResolvedValue({
      agentId: 'agent-1',
      userId: 'user-a',
      userFirstName: 'Ann',
      userLastName: 'Agent',
      userEmail: 'ann@example.com',
      status: 'inactive',
      preferredLanguage: 'en',
    });
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('FindUserByReferralCode')) {
        return { users: [] };
      }
      if (query.includes('FindBusinessByCode')) {
        return {
          businesses: [
            {
              id: 'biz-ref',
              name: 'Referrer Shop',
              business_code: 'ABC123',
              lifecycle_status: 'active',
              user: {
                id: 'user-b',
                first_name: 'Bob',
                email: 'bob@example.com',
                preferred_language: 'fr',
              },
            },
          ],
        };
      }
      return {};
    });

    const resolved = await service.resolveBusinessReferralCode('ABC123');
    expect(resolved?.kind).toBe('business');
  });

  it('rejects suspended business referrers', async () => {
    agentReferralsService.findAgentByCode.mockResolvedValue(null);
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('FindUserByReferralCode')) {
        return { users: [] };
      }
      if (query.includes('FindBusinessByCode')) {
        return {
          businesses: [
            {
              id: 'biz-ref',
              name: 'Suspended Shop',
              business_code: 'XYZ789',
              lifecycle_status: 'suspended',
              user: {
                id: 'user-b',
                first_name: 'Bob',
                email: 'bob@example.com',
                preferred_language: 'en',
              },
            },
          ],
        };
      }
      return {};
    });

    await expect(
      service.resolveBusinessReferralCode('XYZ789')
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('falls back to business codes when no agent matches', async () => {
    agentReferralsService.findAgentByCode.mockResolvedValue(null);
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('FindUserByReferralCode')) {
        return { users: [] };
      }
      if (query.includes('FindBusinessByCode')) {
        return {
          businesses: [
            {
              id: 'biz-ref',
              name: 'Referrer Shop',
              business_code: 'XYZ789',
              lifecycle_status: 'active',
              user: {
                id: 'user-b',
                first_name: 'Bob',
                email: 'bob@example.com',
                preferred_language: 'fr',
              },
            },
          ],
        };
      }
      return {};
    });

    const resolved = await service.resolveBusinessReferralCode('XYZ789');
    expect(resolved).toEqual(
      expect.objectContaining({
        kind: 'business',
        businessId: 'biz-ref',
        normalizedCode: 'XYZ789',
      })
    );
  });

  it('blocks self-referral for business codes', async () => {
    agentReferralsService.findAgentByCode.mockResolvedValue(null);
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('FindUserByReferralCode')) {
        return { users: [] };
      }
      if (query.includes('FindBusinessByCode')) {
        return {
          businesses: [
            {
              id: 'biz-ref',
              name: 'Referrer Shop',
              business_code: 'XYZ789',
              lifecycle_status: 'active',
              user: {
                id: 'user-self',
                first_name: 'Self',
                email: 'self@example.com',
                preferred_language: 'en',
              },
            },
          ],
        };
      }
      return {};
    });

    await expect(
      service.resolveBusinessReferralCode('XYZ789', 'user-self')
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('resolves user-level codes to the business persona when the agent is inactive', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('FindUserByReferralCode')) {
        return {
          users: [
            {
              id: 'user-u',
              email: 'u@example.com',
              first_name: 'Una',
              last_name: 'User',
              preferred_language: 'fr',
              referral_code: 'USR001',
              internal: false,
              account_status: 'active',
            },
          ],
        };
      }
      if (query.includes('ActiveAgentForUser')) {
        return { agents: [] };
      }
      if (query.includes('BusinessForUser')) {
        return {
          businesses: [
            {
              id: 'biz-u',
              name: 'Una Shop',
              lifecycle_status: 'contract_signed',
            },
          ],
        };
      }
      return {};
    });

    const resolved = await service.resolveBusinessReferralCode('USR001');
    expect(resolved).toEqual(
      expect.objectContaining({
        kind: 'business',
        businessId: 'biz-u',
        userId: 'user-u',
        normalizedCode: 'USR001',
      })
    );
  });

  it('blocks self-referral for user-level codes', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('FindUserByReferralCode')) {
        return {
          users: [
            {
              id: 'user-self',
              email: 'self@example.com',
              first_name: 'Self',
              last_name: 'User',
              preferred_language: 'en',
              referral_code: 'USR001',
              internal: false,
              account_status: 'active',
            },
          ],
        };
      }
      return {};
    });

    await expect(
      service.resolveBusinessReferralCode('USR001', 'user-self')
    ).rejects.toMatchObject({ status: 400 });
  });

  it('ignores deleted user-level codes and falls through to legacy lookup', async () => {
    agentReferralsService.findAgentByCode.mockResolvedValue({
      agentId: 'agent-legacy',
      userId: 'user-a',
      userFirstName: 'Ann',
      userEmail: 'ann@example.com',
      status: 'active',
      preferredLanguage: 'en',
    });
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('FindUserByReferralCode')) {
        return {
          users: [
            {
              id: 'user-deleted',
              email: 'gone@example.com',
              first_name: 'Gone',
              last_name: 'User',
              preferred_language: 'en',
              referral_code: 'ABC123',
              internal: false,
              account_status: 'deleted',
            },
          ],
        };
      }
      if (query.includes('FindBusinessByCode')) {
        return { businesses: [] };
      }
      return {};
    });

    const resolved = await service.resolveBusinessReferralCode('ABC123');
    expect(resolved).toEqual(
      expect.objectContaining({ kind: 'agent', agentId: 'agent-legacy' })
    );
  });

  it('rejects user-level codes with no active agent or business persona', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('FindUserByReferralCode')) {
        return {
          users: [
            {
              id: 'user-u',
              email: 'u@example.com',
              first_name: 'Una',
              last_name: 'User',
              preferred_language: 'en',
              referral_code: 'USR001',
              internal: false,
              account_status: 'active',
            },
          ],
        };
      }
      if (query.includes('ActiveAgentForUser')) {
        return { agents: [] };
      }
      if (query.includes('BusinessForUser')) {
        return { businesses: [] };
      }
      return {};
    });

    await expect(service.resolveBusinessReferralCode('USR001')).rejects.toMatchObject(
      { status: 400 }
    );
  });

  it('rejects user-level codes whose business persona is suspended', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('FindUserByReferralCode')) {
        return {
          users: [
            {
              id: 'user-u',
              email: 'u@example.com',
              first_name: 'Una',
              last_name: 'User',
              preferred_language: 'en',
              referral_code: 'USR001',
              internal: false,
              account_status: 'active',
            },
          ],
        };
      }
      if (query.includes('ActiveAgentForUser')) {
        return { agents: [] };
      }
      if (query.includes('BusinessForUser')) {
        return {
          businesses: [
            { id: 'biz-u', name: 'Una Shop', lifecycle_status: 'suspended' },
          ],
        };
      }
      return {};
    });

    await expect(service.resolveBusinessReferralCode('USR001')).rejects.toMatchObject(
      { status: 400 }
    );
  });

  it('treats userCanRefer as true for an active agent', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      agents: [{ id: 'agent-1' }],
    });
    await expect(service.userCanRefer('user-u')).resolves.toBe(true);
  });

  it('treats userCanRefer as false for a suspended business without an agent', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ActiveAgentForUser')) {
        return { agents: [] };
      }
      if (query.includes('BusinessForUser')) {
        return {
          businesses: [
            { id: 'biz-u', name: 'Shop', lifecycle_status: 'suspended' },
          ],
        };
      }
      return {};
    });
    await expect(service.userCanRefer('user-u')).resolves.toBe(false);
  });

  it('returns no referred businesses when the user has neither persona id', async () => {
    const rows = await service.listReferredBusinessesForUser({});
    expect(rows).toEqual([]);
    expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
  });

  it('lists referred businesses with an OR filter across agent and business personas', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses: [
        {
          id: 'biz-2',
          name: 'Referred Shop',
          lifecycle_status: 'created',
          created_at: '2026-01-01T00:00:00Z',
          user: {
            first_name: 'Rae',
            last_name: 'F',
            phone_number: '+237',
            email: 'r@x.com',
          },
          items_approved: { aggregate: { count: 1 } },
          items_rejected: { aggregate: { count: 0 } },
          items_pending: { aggregate: { count: 2 } },
          payment_accounts: [],
        },
      ],
    });

    const rows = await service.listReferredBusinessesForUser({
      agentId: 'agent-1',
      businessId: 'biz-1',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        businessId: 'biz-2',
        followUpStatus: 'contract_pending',
        itemsApproved: 1,
      })
    );
    expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('UserReferredBusinesses'),
      {
        where: {
          _or: [
            { referred_by_agent_id: { _eq: 'agent-1' } },
            { referred_by_business_id: { _eq: 'biz-1' } },
          ],
        },
      }
    );
  });

  it('throws when the user is missing from a referrals summary', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({ users_by_pk: null });
    await expect(
      service.getUserReferralsSummary({ userId: 'missing' })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('summarizes user referrals with the internal payout config key', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('UserReferralSummary')) {
        return {
          users_by_pk: {
            referral_code: 'USR001',
            internal: true,
            country: 'cm',
          },
        };
      }
      if (query.includes('UserReferredCounts')) {
        return {
          businesses_aggregate: { aggregate: { count: 3 } },
          paid: { aggregate: { count: 1 } },
        };
      }
      if (query.includes('ReferralPayoutAmount')) {
        return { application_configurations: [{ number_value: 15000 }] };
      }
      return {};
    });

    const summary = await service.getUserReferralsSummary({
      userId: 'user-u',
      agentId: 'agent-1',
    });

    expect(summary).toEqual(
      expect.objectContaining({
        referralCode: 'USR001',
        referralAmount: 15000,
        currency: 'XAF',
        countryCode: 'CM',
        referredCount: 3,
        paidCount: 1,
        internal: true,
      })
    );
    expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('ReferralPayoutAmount'),
      { key: 'business_referral_payout_amount_internal', country: 'CM' }
    );
  });

  it('falls back to routing country and the standard payout key', async () => {
    paymentRoutingService.getUserCountryCode.mockResolvedValue('CA');
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('UserReferralSummary')) {
        return {
          users_by_pk: {
            referral_code: 'USR001',
            internal: false,
            country: null,
          },
        };
      }
      if (query.includes('ReferralPayoutAmount')) {
        return { application_configurations: [{ number_value: 25 }] };
      }
      return {};
    });

    const summary = await service.getUserReferralsSummary({ userId: 'user-u' });
    expect(summary.currency).toBe('CAD');
    expect(summary.countryCode).toBe('CA');
    expect(summary.referredCount).toBe(0);
    expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('ReferralPayoutAmount'),
      { key: 'business_referral_payout_amount', country: 'CA' }
    );
  });

  it('prefers the user-level code in the business referrals summary', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('BusinessReferralsSummary')) {
        return {
          businesses_by_pk: {
            id: 'biz-1',
            business_code: 'OLD123',
            user_id: 'user-u',
            user: { referral_code: 'USR001', internal: true, country: 'US' },
            referred_businesses_aggregate: { aggregate: { count: 2 } },
            referral_payouts_earned_aggregate: { aggregate: { count: 1 } },
            business_locations: [],
            business_addresses: [],
          },
        };
      }
      if (query.includes('ReferralPayoutAmount')) {
        return { application_configurations: [{ number_value: 40 }] };
      }
      return {};
    });

    const summary = await service.getReferralsSummary('biz-1');
    expect(summary).toEqual(
      expect.objectContaining({
        businessCode: 'USR001',
        referralCode: 'USR001',
        referralAmount: 40,
        currency: 'USD',
        countryCode: 'US',
        referredCount: 2,
        paidCount: 1,
      })
    );
    expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('ReferralPayoutAmount'),
      { key: 'business_referral_payout_amount_internal', country: 'US' }
    );
  });
});

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
    hasuraSystemService.executeQuery.mockResolvedValue({ businesses: [] });

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
    hasuraSystemService.executeQuery.mockResolvedValue({
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
    });

    const resolved = await service.resolveBusinessReferralCode('ABC123');
    expect(resolved?.kind).toBe('business');
  });

  it('rejects suspended business referrers', async () => {
    agentReferralsService.findAgentByCode.mockResolvedValue(null);
    hasuraSystemService.executeQuery.mockResolvedValue({
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
    });

    await expect(
      service.resolveBusinessReferralCode('XYZ789')
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('falls back to business codes when no agent matches', async () => {
    agentReferralsService.findAgentByCode.mockResolvedValue(null);
    hasuraSystemService.executeQuery.mockResolvedValue({
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
    hasuraSystemService.executeQuery.mockResolvedValue({
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
    });

    await expect(
      service.resolveBusinessReferralCode('XYZ789', 'user-self')
    ).rejects.toBeInstanceOf(HttpException);
  });
});

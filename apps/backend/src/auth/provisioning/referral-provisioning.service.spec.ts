import { ReferralProvisioningService } from './referral-provisioning.service';

describe('ReferralProvisioningService.runPostCommitEffects', () => {
  let service: ReferralProvisioningService;
  let businessReferrals: {
    notifyReferrerOfBusinessReferral: jest.Mock;
  };
  let credits: {
    resolveReferrerUserId: jest.Mock;
    awardBusinessReferred: jest.Mock;
    awardAgentReferred: jest.Mock;
  };

  const agentReferral = {
    kind: 'agent' as const,
    agentId: 'ref-agent',
    normalizedCode: 'ABC123',
    userEmail: 'a@x.com',
    userFirstName: 'Ada',
    preferredLanguage: 'en',
  };

  beforeEach(() => {
    businessReferrals = {
      notifyReferrerOfBusinessReferral: jest.fn().mockResolvedValue(undefined),
    };
    credits = {
      resolveReferrerUserId: jest.fn().mockResolvedValue('ref-user'),
      awardBusinessReferred: jest.fn().mockResolvedValue({ id: 'c1' }),
      awardAgentReferred: jest.fn().mockResolvedValue({ id: 'c2' }),
    };
    service = new ReferralProvisioningService(
      businessReferrals as any,
      {} as any,
      credits as any
    );
  });

  it('notifies then awards business-referred credit on a referred shop', async () => {
    await service.runPostCommitEffects({
      entities: [{ type: 'business', id: 'biz-1' } as any],
      referral: agentReferral,
      country: 'CM',
      businessName: 'Shop',
      ownerName: 'Pat',
    });

    expect(
      businessReferrals.notifyReferrerOfBusinessReferral
    ).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: 'biz-1', countryCode: 'CM' }),
      agentReferral
    );
    expect(credits.awardBusinessReferred).toHaveBeenCalledWith({
      referrerUserId: 'ref-user',
      businessId: 'biz-1',
    });
    expect(credits.awardAgentReferred).not.toHaveBeenCalled();
  });

  it('awards agent-referred credit without a business notify', async () => {
    await service.runPostCommitEffects({
      entities: [{ type: 'agent', id: 'ag-1' } as any],
      referral: agentReferral,
      businessName: '',
      ownerName: '',
    });

    expect(
      businessReferrals.notifyReferrerOfBusinessReferral
    ).not.toHaveBeenCalled();
    expect(credits.awardAgentReferred).toHaveBeenCalledWith({
      referrerUserId: 'ref-user',
      agentId: 'ag-1',
    });
  });

  it('skips awards when there is no referral or the referrer user is missing', async () => {
    await service.runPostCommitEffects({
      entities: [{ type: 'business', id: 'biz-1' } as any],
      referral: null,
      businessName: 'Shop',
      ownerName: 'Pat',
    });
    expect(credits.awardBusinessReferred).not.toHaveBeenCalled();

    credits.resolveReferrerUserId.mockResolvedValueOnce(null);
    await service.runPostCommitEffects({
      entities: [{ type: 'agent', id: 'ag-1' } as any],
      referral: agentReferral,
      businessName: '',
      ownerName: '',
    });
    expect(credits.awardAgentReferred).not.toHaveBeenCalled();
  });
});

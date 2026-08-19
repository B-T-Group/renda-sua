import { ReferralProjectedPayoutService } from './referral-projected-payout.service';

describe('ReferralProjectedPayoutService', () => {
  const hasuraSystemService = { executeQuery: jest.fn() };
  const paymentRoutingService = { getUserCountryCode: jest.fn() };
  const configurationsService = { getConfigurationByKey: jest.fn() };

  let service: ReferralProjectedPayoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReferralProjectedPayoutService(
      hasuraSystemService as never,
      paymentRoutingService as never,
      configurationsService as never
    );
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('PayableReferralCount')) {
        return { businesses_aggregate: { aggregate: { count: 2 } } };
      }
      if (query.includes('ProjectionPayoutUser')) {
        return {
          users_by_pk: { internal: false, country: 'CM', agent: { id: 'a1' } },
        };
      }
      return {};
    });
    configurationsService.getConfigurationByKey.mockResolvedValue({
      number_value: 5000,
    });
  });

  it('returns count times configured amount for an agent', async () => {
    const result = await service.forAgent('agent-1', 'user-1');
    expect(result).toEqual({
      payableCount: 2,
      amountPerReferral: 5000,
      projectedAmount: 10000,
      currency: 'XAF',
    });
    expect(configurationsService.getConfigurationByKey).toHaveBeenCalledWith(
      'business_referral_payout_amount',
      'CM'
    );
  });

  it('uses the B2B config key when the referrer has no agent persona', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('PayableReferralCount')) {
        return { businesses_aggregate: { aggregate: { count: 2 } } };
      }
      return {
        users_by_pk: { internal: false, country: 'CM', agent: null },
      };
    });
    configurationsService.getConfigurationByKey.mockResolvedValue({
      number_value: 2000,
    });

    const result = await service.forBusiness('biz-1', 'user-1');
    expect(result).toEqual({
      payableCount: 2,
      amountPerReferral: 2000,
      projectedAmount: 4000,
      currency: 'XAF',
    });
    expect(configurationsService.getConfigurationByKey).toHaveBeenCalledWith(
      'business_to_business_referral_amount',
      'CM'
    );
  });

  it('uses the internal config key for internal users', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('PayableReferralCount')) {
        return { businesses_aggregate: { aggregate: { count: 1 } } };
      }
      return { users_by_pk: { internal: true, country: 'CA' } };
    });
    configurationsService.getConfigurationByKey.mockResolvedValue({
      number_value: 75,
    });

    const result = await service.forBusiness('biz-1', 'user-1');
    expect(result.projectedAmount).toBe(75);
    expect(result.currency).toBe('CAD');
    expect(configurationsService.getConfigurationByKey).toHaveBeenCalledWith(
      'business_referral_payout_amount_internal',
      'CA'
    );
  });

  it('returns zero amount when no referrals are payable', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('PayableReferralCount')) {
        return { businesses_aggregate: { aggregate: { count: 0 } } };
      }
      return { users_by_pk: { internal: false, country: 'CM' } };
    });

    const result = await service.forAgent('agent-1', 'user-1');
    expect(result.projectedAmount).toBe(0);
    expect(result.payableCount).toBe(0);
    expect(configurationsService.getConfigurationByKey).not.toHaveBeenCalled();
  });
});

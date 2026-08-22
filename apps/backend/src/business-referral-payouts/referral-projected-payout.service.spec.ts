import { ReferralProjectedPayoutService } from './referral-projected-payout.service';

describe('ReferralProjectedPayoutService', () => {
  const representativeCompensationService = {
    previewForReferrer: jest.fn(),
  };

  let service: ReferralProjectedPayoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReferralProjectedPayoutService(
      {} as never,
      {} as never,
      {} as never,
      representativeCompensationService as never
    );
  });

  it('returns pending compensation for an agent', async () => {
    representativeCompensationService.previewForReferrer.mockResolvedValue({
      payableCount: 2,
      amountPerReferral: 7500,
      projectedAmount: 15000,
      currency: 'XAF',
    });

    const result = await service.forAgent('agent-1', 'user-1');

    expect(result).toEqual({
      payableCount: 2,
      amountPerReferral: 7500,
      projectedAmount: 15000,
      currency: 'XAF',
    });
    expect(
      representativeCompensationService.previewForReferrer
    ).toHaveBeenCalledWith({ agentId: 'agent-1', userId: 'user-1' });
  });

  it('returns pending compensation for a business referrer', async () => {
    representativeCompensationService.previewForReferrer.mockResolvedValue({
      payableCount: 1,
      amountPerReferral: 1000,
      projectedAmount: 1000,
      currency: 'XAF',
    });

    const result = await service.forBusiness('biz-1', 'user-1');

    expect(result.projectedAmount).toBe(1000);
    expect(
      representativeCompensationService.previewForReferrer
    ).toHaveBeenCalledWith({ businessId: 'biz-1', userId: 'user-1' });
  });
});

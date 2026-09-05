jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { ReferralPayoutPreviewService } from './referral-payout-preview.service';

describe('ReferralPayoutPreviewService', () => {
  const payoutsService = {
    isPayoutFeatureEnabled: jest.fn(),
    listEligibleForPreview: jest.fn(),
    listIncompleteClaimsForPreview: jest.fn(),
    previewGrossForUser: jest.fn(),
  };
  const referralPyramidService = {
    getPyramidPercents: jest.fn(),
    previewBonusShares: jest.fn(),
  };
  const representativeCompensationService = {
    previewPending: jest.fn(),
  };

  let service: ReferralPayoutPreviewService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReferralPayoutPreviewService(
      payoutsService as never,
      referralPyramidService as never,
      representativeCompensationService as never
    );
    payoutsService.isPayoutFeatureEnabled.mockResolvedValue(true);
    payoutsService.listIncompleteClaimsForPreview.mockResolvedValue([]);
    representativeCompensationService.previewPending.mockResolvedValue([]);
    referralPyramidService.getPyramidPercents.mockResolvedValue({
      gen1: 5,
      gen2: 3,
      gen3: 1,
    });
  });

  it('builds one payable row with pyramid beneficiaries', async () => {
    representativeCompensationService.previewPending.mockResolvedValue([
      {
        businessId: 'biz-1',
        businessName: 'Shop One',
        ruleCode: 'onboarding_10_first_sale',
        amount: 7500,
        currency: 'XAF',
        countryCode: 'CM',
        itemCount: 12,
        orderId: 'order-1',
        earnerKind: 'agent',
        earnerId: 'agent-1',
        earnerUserId: 'user-1',
        earnerName: 'Ada Agent',
      },
    ]);
    payoutsService.previewGrossForUser.mockResolvedValue({
      countryCode: 'CM',
      currency: 'XAF',
      amount: 5000,
      configKey: 'business_referral_payout_amount',
    });
    referralPyramidService.previewBonusShares.mockResolvedValue({
      percents: { gen1: 5, gen2: 3, gen3: 1 },
      shares: [
        {
          generation: 0,
          kind: 'agent',
          id: 'agent-1',
          userId: 'user-1',
          name: 'Ada Agent',
          amount: 4750,
          percent: null,
          hasAccount: true,
        },
        {
          generation: 1,
          kind: 'agent',
          id: 'agent-up',
          userId: 'user-up',
          name: 'Upline',
          amount: 250,
          percent: 5,
          hasAccount: true,
        },
      ],
    });

    const result = await service.previewWeeklyPayouts();

    expect(result.payableCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.rows[0].referredBusinessName).toBe('Shop One');
    expect(result.rows[0].beneficiaries).toHaveLength(2);
    expect(result.totalsByCurrency).toEqual([
      { currency: 'XAF', count: 1, gross: 7500 },
    ]);
  });

  it('marks missing earner wallet as skipped', async () => {
    representativeCompensationService.previewPending.mockResolvedValue([
      {
        businessId: 'biz-2',
        businessName: 'Shop Two',
        ruleCode: 'business_referral_10_items',
        amount: 2000,
        currency: 'XAF',
        countryCode: 'CM',
        itemCount: 10,
        orderId: null,
        earnerKind: 'business',
        earnerId: 'biz-ref',
        earnerUserId: 'user-2',
        earnerName: 'Ref Co',
      },
    ]);
    payoutsService.previewGrossForUser.mockResolvedValue({
      countryCode: 'CM',
      currency: 'XAF',
      amount: 2000,
      configKey: 'business_to_business_referral_amount',
    });
    referralPyramidService.previewBonusShares.mockResolvedValue({
      percents: { gen1: 5, gen2: 3, gen3: 1 },
      shares: [
        {
          generation: 0,
          kind: 'business',
          id: 'biz-ref',
          userId: 'user-2',
          name: 'Ref Co',
          amount: 2000,
          percent: null,
          hasAccount: false,
        },
      ],
    });

    const result = await service.previewWeeklyPayouts();

    expect(result.payableCount).toBe(0);
    expect(result.rows[0].skipReason).toBe('no_account');
    expect(result.totalsByCurrency).toEqual([]);
  });

  it('includes incomplete claim retries in the preview', async () => {
    representativeCompensationService.previewPending.mockResolvedValue([]);
    payoutsService.listIncompleteClaimsForPreview.mockResolvedValue([
      {
        referredBusinessId: 'biz-pending',
        referredBusinessName: 'Pending Shop',
        referralKind: 'agent',
        amount: 5000,
        currency: 'XAF',
        earner: {
          kind: 'agent',
          id: 'agent-1',
          userId: 'user-1',
          name: 'Ada Agent',
        },
      },
    ]);
    payoutsService.previewGrossForUser.mockResolvedValue({
      countryCode: 'CM',
      currency: 'XAF',
      amount: 5000,
      configKey: 'business_referral_payout_amount',
    });
    referralPyramidService.previewBonusShares.mockResolvedValue({
      percents: { gen1: 5, gen2: 3, gen3: 1 },
      shares: [
        {
          generation: 0,
          kind: 'agent',
          id: 'agent-1',
          userId: 'user-1',
          name: 'Ada Agent',
          amount: 5000,
          percent: null,
          hasAccount: true,
        },
      ],
    });

    const result = await service.previewWeeklyPayouts();

    expect(result.payableCount).toBe(1);
    expect(result.rows[0].pendingRetry).toBe(true);
    expect(result.rows[0].referredBusinessName).toBe('Pending Shop');
  });

  it('keeps skipped rows when filtering by market', async () => {
    representativeCompensationService.previewPending.mockResolvedValue([
      {
        businessId: 'biz-skip',
        businessName: 'Empty Config Shop',
        ruleCode: 'onboarding_10_first_sale',
        amount: 0,
        currency: 'XAF',
        countryCode: 'CM',
        itemCount: 10,
        orderId: null,
        earnerKind: 'agent',
        earnerId: 'agent-1',
        earnerUserId: 'user-1',
        earnerName: 'Ada Agent',
      },
    ]);
    payoutsService.previewGrossForUser.mockResolvedValue({
      countryCode: 'CM',
      currency: 'XAF',
      amount: 0,
      configKey: null,
    });

    const result = await service.previewWeeklyPayouts('CM');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].skipReason).toBe('no_amount');
    expect(result.rows[0].countryCode).toBe('CM');
  });
});

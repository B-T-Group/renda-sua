import {
  BUSINESS_REFERRAL_10_ITEMS,
  ONBOARDING_10_FIRST_SALE,
  ONBOARDING_25_LARGE_SALE,
  ONBOARDING_25_SMALL_SALE,
  SALE_PERCENT,
  evaluateCompensation,
  isSmallSale,
  matchingOnboardingRulesForOrder,
  pickHighestUnpaidOnboardingRule,
  salePercentAmount,
  type CompensationMarketConfig,
} from './compensation-rules';

const XAF: CompensationMarketConfig = {
  currency: 'XAF',
  onboarding10FirstSale: 7500,
  onboarding25SmallSale: 10000,
  onboarding25LargeSale: 15000,
  smallSaleMaxExclusive: 10000,
  largeSaleMaxInclusive: 25000,
  salePercent: 1,
  businessReferral10Items: 1000,
};

const CAD: CompensationMarketConfig = {
  currency: 'CAD',
  onboarding10FirstSale: 25,
  onboarding25SmallSale: 40,
  onboarding25LargeSale: 50,
  smallSaleMaxExclusive: 25,
  largeSaleMaxInclusive: 75,
  salePercent: 1,
  businessReferral10Items: 10,
};

describe('compensation-rules', () => {
  describe('sale bands', () => {
    it('treats 9999.99 XAF as small and 10000 as large', () => {
      expect(isSmallSale(9999.99, 10000)).toBe(true);
      expect(isSmallSale(10000, 10000)).toBe(false);
    });

    it('treats 24.99 CAD as small and 25 as large', () => {
      expect(isSmallSale(24.99, 25)).toBe(true);
      expect(isSmallSale(25, 25)).toBe(false);
    });
  });

  describe('matchingOnboardingRulesForOrder', () => {
    it('matches only the 10-item bonus below 25 items', () => {
      expect(
        matchingOnboardingRulesForOrder({
          approvedItemCount: 10,
          orderSubtotal: 20000,
          config: XAF,
        })
      ).toEqual([ONBOARDING_10_FIRST_SALE]);
    });

    it('matches 10-item and small-25 on a sale below 10000 at 25 items', () => {
      expect(
        matchingOnboardingRulesForOrder({
          approvedItemCount: 25,
          orderSubtotal: 9999.99,
          config: XAF,
        })
      ).toEqual([ONBOARDING_10_FIRST_SALE, ONBOARDING_25_SMALL_SALE]);
    });

    it('matches 10-item and large-25 on a sale at or above 10000', () => {
      expect(
        matchingOnboardingRulesForOrder({
          approvedItemCount: 25,
          orderSubtotal: 10000,
          config: XAF,
        })
      ).toEqual([ONBOARDING_10_FIRST_SALE, ONBOARDING_25_LARGE_SALE]);
    });
  });

  describe('pickHighestUnpaidOnboardingRule', () => {
    it('picks 15000 when a first 25-item sale is large', () => {
      expect(
        pickHighestUnpaidOnboardingRule({
          approvedItemCount: 25,
          orderSubtotal: 15000,
          paidOnboardingRules: [],
          config: XAF,
        })
      ).toBe(ONBOARDING_25_LARGE_SALE);
    });

    it('picks 10000 on a later small sale after 7500 is paid', () => {
      expect(
        pickHighestUnpaidOnboardingRule({
          approvedItemCount: 25,
          orderSubtotal: 5000,
          paidOnboardingRules: [ONBOARDING_10_FIRST_SALE],
          config: XAF,
        })
      ).toBe(ONBOARDING_25_SMALL_SALE);
    });

    it('uses CAD thresholds', () => {
      expect(
        pickHighestUnpaidOnboardingRule({
          approvedItemCount: 25,
          orderSubtotal: 24.99,
          paidOnboardingRules: [ONBOARDING_10_FIRST_SALE],
          config: CAD,
        })
      ).toBe(ONBOARDING_25_SMALL_SALE);
      expect(
        pickHighestUnpaidOnboardingRule({
          approvedItemCount: 25,
          orderSubtotal: 25,
          paidOnboardingRules: [ONBOARDING_10_FIRST_SALE],
          config: CAD,
        })
      ).toBe(ONBOARDING_25_LARGE_SALE);
    });
  });

  describe('evaluateCompensation', () => {
    it('pays no agent milestone without a triggering order', () => {
      expect(
        evaluateCompensation({
          approvedItemCount: 10,
          completedSales: [{ id: 'o1', subtotal: 20000, currency: 'XAF' }],
          payoutCurrency: 'XAF',
          paidOnboardingRules: [],
          hasAgentReferrer: true,
          hasBusinessReferrer: false,
          alreadyPaidBusinessReferral: false,
          config: XAF,
        })
      ).toEqual([]);
    });

    it('pays 7500 on the first 10-item sale and not 1%', () => {
      const actions = evaluateCompensation({
        approvedItemCount: 10,
        completedSales: [{ id: 'o1', subtotal: 20000, currency: 'XAF' }],
        payoutCurrency: 'XAF',
        paidOnboardingRules: [],
        hasAgentReferrer: true,
        hasBusinessReferrer: false,
        alreadyPaidBusinessReferral: false,
        triggeringOrderId: 'o1',
        config: XAF,
      });
      expect(actions).toEqual([
        expect.objectContaining({
          ruleCode: ONBOARDING_10_FIRST_SALE,
          amount: 7500,
          orderId: 'o1',
        }),
      ]);
    });

    it('pays 10000 on a later small 25-item sale after 7500', () => {
      const actions = evaluateCompensation({
        approvedItemCount: 25,
        completedSales: [
          { id: 'o1', subtotal: 20000, currency: 'XAF' },
          { id: 'o2', subtotal: 5000, currency: 'XAF' },
        ],
        payoutCurrency: 'XAF',
        paidOnboardingRules: [ONBOARDING_10_FIRST_SALE],
        hasAgentReferrer: true,
        hasBusinessReferrer: false,
        alreadyPaidBusinessReferral: false,
        triggeringOrderId: 'o2',
        paidOrderIds: ['o1'],
        config: XAF,
      });
      expect(actions).toEqual([
        expect.objectContaining({
          ruleCode: ONBOARDING_25_SMALL_SALE,
          amount: 10000,
          orderId: 'o2',
        }),
      ]);
    });

    it('pays 15000 on a later large 25-item sale after 7500 and 10000', () => {
      const actions = evaluateCompensation({
        approvedItemCount: 30,
        completedSales: [
          { id: 'o1', subtotal: 8000, currency: 'XAF' },
          { id: 'o2', subtotal: 5000, currency: 'XAF' },
          { id: 'o3', subtotal: 12000, currency: 'XAF' },
        ],
        payoutCurrency: 'XAF',
        paidOnboardingRules: [
          ONBOARDING_10_FIRST_SALE,
          ONBOARDING_25_SMALL_SALE,
        ],
        hasAgentReferrer: true,
        hasBusinessReferrer: false,
        alreadyPaidBusinessReferral: false,
        triggeringOrderId: 'o3',
        paidOrderIds: ['o1', 'o2'],
        config: XAF,
      });
      expect(actions).toEqual([
        expect.objectContaining({
          ruleCode: ONBOARDING_25_LARGE_SALE,
          amount: 15000,
          orderId: 'o3',
        }),
      ]);
    });

    it('pays only 15000 on a first large 25-item sale', () => {
      const actions = evaluateCompensation({
        approvedItemCount: 25,
        completedSales: [{ id: 'o1', subtotal: 15000, currency: 'XAF' }],
        payoutCurrency: 'XAF',
        paidOnboardingRules: [],
        hasAgentReferrer: true,
        hasBusinessReferrer: false,
        alreadyPaidBusinessReferral: false,
        triggeringOrderId: 'o1',
        config: XAF,
      });
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual(
        expect.objectContaining({
          ruleCode: ONBOARDING_25_LARGE_SALE,
          amount: 15000,
          orderId: 'o1',
        })
      );
    });

    it('pays 1% when all milestone types for that band are already paid', () => {
      const actions = evaluateCompensation({
        approvedItemCount: 30,
        completedSales: [
          { id: 'o1', subtotal: 8000, currency: 'XAF' },
          { id: 'o2', subtotal: 5000, currency: 'XAF' },
          { id: 'o3', subtotal: 12000, currency: 'XAF' },
          { id: 'o4', subtotal: 50000, currency: 'XAF' },
        ],
        payoutCurrency: 'XAF',
        paidOnboardingRules: [
          ONBOARDING_10_FIRST_SALE,
          ONBOARDING_25_SMALL_SALE,
          ONBOARDING_25_LARGE_SALE,
        ],
        hasAgentReferrer: true,
        hasBusinessReferrer: false,
        alreadyPaidBusinessReferral: false,
        triggeringOrderId: 'o4',
        paidOrderIds: ['o1', 'o2', 'o3'],
        config: XAF,
      });
      expect(actions).toEqual([
        expect.objectContaining({
          ruleCode: SALE_PERCENT,
          amount: 500,
          orderId: 'o4',
        }),
      ]);
    });

    it('does not pay again on an order that already paid a commission', () => {
      expect(
        evaluateCompensation({
          approvedItemCount: 10,
          completedSales: [{ id: 'o1', subtotal: 20000, currency: 'XAF' }],
          payoutCurrency: 'XAF',
          paidOnboardingRules: [ONBOARDING_10_FIRST_SALE],
          hasAgentReferrer: true,
          hasBusinessReferrer: false,
          alreadyPaidBusinessReferral: false,
          triggeringOrderId: 'o1',
          paidOrderIds: ['o1'],
          config: XAF,
        })
      ).toEqual([]);
    });

    it('pays the B2B 10-item reward once without an order', () => {
      const actions = evaluateCompensation({
        approvedItemCount: 10,
        completedSales: [],
        payoutCurrency: 'XAF',
        paidOnboardingRules: [],
        hasAgentReferrer: false,
        hasBusinessReferrer: true,
        alreadyPaidBusinessReferral: false,
        config: XAF,
      });
      expect(actions).toEqual([
        expect.objectContaining({
          ruleCode: BUSINESS_REFERRAL_10_ITEMS,
          amount: 1000,
        }),
      ]);
    });

    it('does not pay B2B twice', () => {
      expect(
        evaluateCompensation({
          approvedItemCount: 12,
          completedSales: [],
          payoutCurrency: 'XAF',
          paidOnboardingRules: [],
          hasAgentReferrer: false,
          hasBusinessReferrer: true,
          alreadyPaidBusinessReferral: true,
          config: XAF,
        })
      ).toEqual([]);
    });
  });

  describe('salePercentAmount', () => {
    it('rounds XAF to whole francs and CAD to cents', () => {
      expect(salePercentAmount(9999, 1, 'XAF')).toBe(100);
      expect(salePercentAmount(24.99, 1, 'CAD')).toBe(0.25);
    });
  });
});

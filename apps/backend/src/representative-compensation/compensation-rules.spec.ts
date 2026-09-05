import {
  BUSINESS_REFERRAL_10_ITEMS,
  ONBOARDING_10_FIRST_SALE,
  SALE_PERCENT,
  defaultOnboardingMinSaleTotal,
  evaluateCompensation,
  inWindowSaleTotal,
  onboardingWindowEndsAt,
  salePercentAmount,
  saleWithinOnboardingWindow,
  type CompensationMarketConfig,
} from './compensation-rules';

const XAF: CompensationMarketConfig = {
  currency: 'XAF',
  onboarding10FirstSale: 7500,
  onboarding10MinSaleTotal: 2500,
  salePercent: 1,
  businessReferral10Items: 1000,
};

const CAD: CompensationMarketConfig = {
  currency: 'CAD',
  onboarding10FirstSale: 25,
  onboarding10MinSaleTotal: 0,
  salePercent: 1,
  businessReferral10Items: 10,
};

const onboarded = '2026-05-01T00:00:00.000Z';

function sale(
  id: string,
  subtotal: number,
  completedAt = '2026-05-10T00:00:00.000Z',
  currency = 'XAF'
) {
  return { id, subtotal, currency, completedAt };
}

function agentEval(
  extra: Partial<Parameters<typeof evaluateCompensation>[0]>
) {
  return evaluateCompensation({
    approvedItemCount: 10,
    completedSales: [sale('o1', 20000)],
    payoutCurrency: 'XAF',
    paidOnboardingRules: [],
    hasAgentReferrer: true,
    hasBusinessReferrer: false,
    alreadyPaidBusinessReferral: false,
    businessOnboardedAt: onboarded,
    triggeringOrderId: 'o1',
    config: XAF,
    ...extra,
  });
}

describe('compensation-rules', () => {
  describe('saleWithinOnboardingWindow', () => {
    it('allows a sale on day 30 and rejects day 31', () => {
      expect(
        saleWithinOnboardingWindow(onboarded, '2026-05-31T00:00:00.000Z')
      ).toBe(true);
      expect(
        saleWithinOnboardingWindow(onboarded, '2026-05-31T00:00:01.000Z')
      ).toBe(false);
    });

    it('rejects a missing completedAt', () => {
      expect(saleWithinOnboardingWindow(onboarded, undefined)).toBe(false);
    });
  });

  describe('evaluateCompensation', () => {
    it('pays no agent bonus without a triggering order', () => {
      expect(
        agentEval({ triggeringOrderId: undefined, completedSales: [sale('o1', 20000)] })
      ).toEqual([]);
    });

    it('pays only 1% when in-window sales are below 2500 XAF', () => {
      const actions = agentEval({
        completedSales: [sale('o1', 1000)],
      });
      expect(actions).toEqual([
        expect.objectContaining({
          ruleCode: SALE_PERCENT,
          amount: 10,
          orderId: 'o1',
        }),
      ]);
    });

    it('pays 7500 when in-window sales reach exactly 2500 XAF', () => {
      expect(agentEval({ completedSales: [sale('o1', 2500)] })).toEqual([
        expect.objectContaining({
          ruleCode: ONBOARDING_10_FIRST_SALE,
          amount: 7500,
          orderId: 'o1',
        }),
        expect.objectContaining({ ruleCode: SALE_PERCENT, amount: 25 }),
      ]);
    });

    it('pays 7500 on the sale that crosses 2500 XAF', () => {
      const first = sale('o1', 1500, '2026-05-08T00:00:00.000Z');
      const second = sale('o2', 1500, '2026-05-12T00:00:00.000Z');
      expect(
        agentEval({
          completedSales: [first, second],
          triggeringOrderId: 'o1',
        })
      ).toEqual([
        expect.objectContaining({ ruleCode: SALE_PERCENT, amount: 15 }),
      ]);
      expect(
        agentEval({
          completedSales: [first, second],
          triggeringOrderId: 'o2',
        })
      ).toEqual([
        expect.objectContaining({
          ruleCode: ONBOARDING_10_FIRST_SALE,
          amount: 7500,
          orderId: 'o2',
        }),
        expect.objectContaining({
          ruleCode: SALE_PERCENT,
          amount: 15,
          orderId: 'o2',
        }),
      ]);
    });

    it('pays 7500 and 1% on the qualifying first sale', () => {
      const actions = agentEval({});
      expect(actions).toEqual([
        expect.objectContaining({
          ruleCode: ONBOARDING_10_FIRST_SALE,
          amount: 7500,
          orderId: 'o1',
        }),
        expect.objectContaining({
          ruleCode: SALE_PERCENT,
          amount: 200,
          orderId: 'o1',
        }),
      ]);
    });

    it('pays CAD 25 plus 1% on a qualifying Canadian sale', () => {
      const actions = agentEval({
        completedSales: [sale('o1', 80, '2026-05-10T00:00:00.000Z', 'CAD')],
        payoutCurrency: 'CAD',
        config: CAD,
      });
      expect(actions).toEqual([
        expect.objectContaining({
          ruleCode: ONBOARDING_10_FIRST_SALE,
          amount: 25,
        }),
        expect.objectContaining({ ruleCode: SALE_PERCENT, amount: 0.8 }),
      ]);
    });

    it('pays only 1% after the 7500 is already credited', () => {
      const actions = agentEval({
        completedSales: [sale('o1', 20000), sale('o2', 50000, '2026-06-01T00:00:00.000Z')],
        paidOnboardingRules: [ONBOARDING_10_FIRST_SALE],
        triggeringOrderId: 'o2',
        paidSalePercentOrderIds: ['o1'],
      });
      expect(actions).toEqual([
        expect.objectContaining({
          ruleCode: SALE_PERCENT,
          amount: 500,
          orderId: 'o2',
        }),
      ]);
    });

    it('pays only 1% when the sale is after day 30', () => {
      const actions = agentEval({
        completedSales: [sale('o1', 20000, '2026-06-15T00:00:00.000Z')],
      });
      expect(actions).toEqual([
        expect.objectContaining({
          ruleCode: SALE_PERCENT,
          amount: 200,
          orderId: 'o1',
        }),
      ]);
    });

    it('pays only 1% when the catalog has fewer than 10 items', () => {
      const actions = agentEval({ approvedItemCount: 9 });
      expect(actions).toEqual([
        expect.objectContaining({ ruleCode: SALE_PERCENT, amount: 200 }),
      ]);
    });

    it('does not pay 1% again on an order that already has it', () => {
      expect(
        agentEval({
          paidOnboardingRules: [ONBOARDING_10_FIRST_SALE],
          paidSalePercentOrderIds: ['o1'],
        })
      ).toEqual([]);
    });

    it('pays the B2B 10-item reward once without an order', () => {
      expect(
        evaluateCompensation({
          approvedItemCount: 10,
          completedSales: [],
          payoutCurrency: 'XAF',
          paidOnboardingRules: [],
          hasAgentReferrer: false,
          hasBusinessReferrer: true,
          alreadyPaidBusinessReferral: false,
          config: XAF,
        })
      ).toEqual([
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

  describe('onboarding window helpers', () => {
    it('defaults the min sale total by payout currency', () => {
      expect(defaultOnboardingMinSaleTotal('XAF')).toBe(2500);
      expect(defaultOnboardingMinSaleTotal('CAD')).toBe(0);
      expect(defaultOnboardingMinSaleTotal('USD')).toBe(0);
    });

    it('returns the window end or null for missing dates', () => {
      expect(onboardingWindowEndsAt(onboarded)).toBe('2026-05-31T00:00:00.000Z');
      expect(onboardingWindowEndsAt(undefined)).toBeNull();
      expect(onboardingWindowEndsAt('not-a-date')).toBeNull();
    });

    it('sums only in-window matching-currency sales up to the cap', () => {
      const second = sale('b', 2000, '2026-05-12T00:00:00.000Z');
      expect(
        inWindowSaleTotal({
          completedSales: [
            sale('a', 1000, '2026-05-08T00:00:00.000Z'),
            second,
            sale('c', 5000, '2026-05-20T00:00:00.000Z'),
            sale('d', 9000, '2026-06-15T00:00:00.000Z'),
            sale('e', 800, '2026-05-09T00:00:00.000Z', 'CAD'),
            { id: 'f', subtotal: 0, currency: 'XAF', completedAt: '2026-05-09T00:00:00.000Z' },
          ],
          payoutCurrency: 'XAF',
          onboardedAt: onboarded,
          upToSale: second,
        })
      ).toBe(3000);
    });

    it('returns 0 when onboardedAt is missing', () => {
      expect(
        inWindowSaleTotal({
          completedSales: [sale('o1', 2500)],
          payoutCurrency: 'XAF',
          onboardedAt: undefined,
        })
      ).toBe(0);
    });
  });

  describe('salePercentAmount', () => {
    it('rounds XAF to whole francs and CAD to cents', () => {
      expect(salePercentAmount(9999, 1, 'XAF')).toBe(100);
      expect(salePercentAmount(24.99, 1, 'CAD')).toBe(0.25);
    });
  });
});

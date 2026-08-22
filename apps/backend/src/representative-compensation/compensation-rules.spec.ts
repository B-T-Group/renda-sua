import {
  BUSINESS_REFERRAL_10_ITEMS,
  ONBOARDING_10_FIRST_SALE,
  SALE_PERCENT,
  evaluateCompensation,
  salePercentAmount,
  saleWithinOnboardingWindow,
  type CompensationMarketConfig,
} from './compensation-rules';

const XAF: CompensationMarketConfig = {
  currency: 'XAF',
  onboarding10FirstSale: 7500,
  salePercent: 1,
  businessReferral10Items: 1000,
};

const CAD: CompensationMarketConfig = {
  currency: 'CAD',
  onboarding10FirstSale: 25,
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

  describe('salePercentAmount', () => {
    it('rounds XAF to whole francs and CAD to cents', () => {
      expect(salePercentAmount(9999, 1, 'XAF')).toBe(100);
      expect(salePercentAmount(24.99, 1, 'CAD')).toBe(0.25);
    });
  });
});

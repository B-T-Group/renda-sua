import {
  buildPayBoardSummary,
  filterPayBoardItems,
  indexPayBoardExtras,
  merchantNextStep,
  parsePayBoardStatus,
  toMerchantItem,
  toScheduleItem,
} from './agent-pay-board.mapper';
import type { MerchantReferralInput } from './agent-pay-board.types';

const FUTURE = '2099-01-01T00:00:00.000Z';
const PAST = '2020-01-01T00:00:00.000Z';

function merchant(overrides: Partial<MerchantReferralInput> = {}): MerchantReferralInput {
  return {
    businessId: 'biz-1',
    businessName: 'Shop',
    currency: 'XAF',
    selfSaleAmount: 5000,
    otherBuyerAmount: 7500,
    salePercent: 1,
    salePercentEarned: 0,
    itemsApproved: 0,
    minItems: 2,
    salesTotal: 0,
    minSalesTotal: 2500,
    windowEndsAt: FUTURE,
    onboardingStatus: 'none',
    paidAmount: null,
    paidAt: null,
    legacyPaid: false,
    ...overrides,
  };
}

describe('agent pay board mapper', () => {
  it('exposes the 5000 and 7500 commission structure', () => {
    const item = toMerchantItem(merchant({ itemsApproved: 2 }));
    expect(item.structure).toMatchObject({
      type: 'merchant_referral',
      selfSaleAmount: 5000,
      otherBuyerAmount: 7500,
      salePercent: 1,
    });
    expect(item.nextStep).toBe('reach_sales');
    expect(item.paymentStatus).toBe('unpaid');
  });

  it('picks the next step from items, sales, claim, and the window', () => {
    expect(merchantNextStep(merchant())).toBe('add_items');
    expect(merchantNextStep(merchant({ itemsApproved: 2, salesTotal: 1000 }))).toBe(
      'reach_sales'
    );
    expect(merchantNextStep(merchant({ onboardingStatus: 'pending' }))).toBe(
      'awaiting_payout'
    );
    expect(merchantNextStep(merchant({ windowEndsAt: PAST }))).toBe('window_closed');
    expect(merchantNextStep(merchant({ onboardingStatus: 'credited', paidAmount: 7500 }))).toBe(
      'paid'
    );
    expect(merchantNextStep(merchant({ legacyPaid: true, paidAmount: 2000 }))).toBe('paid');
  });

  it('marks a closed window unpaid and a credited bonus paid', () => {
    const closed = toMerchantItem(merchant({ windowEndsAt: PAST }));
    expect(closed.paymentStatus).toBe('unpaid');
    expect(closed.structure).toMatchObject({
      type: 'merchant_referral',
      onboarding: { status: 'window_expired', paidAmount: null },
    });
    const paid = toMerchantItem(
      merchant({ onboardingStatus: 'credited', paidAmount: 5000, paidAt: PAST })
    );
    expect(paid.paymentStatus).toBe('paid');
    expect(paid.structure).toMatchObject({
      type: 'merchant_referral',
      onboarding: { status: 'paid', paidAmount: 5000 },
    });
  });

  it('filters paid and unpaid and defaults an unknown status to unpaid', () => {
    const items = [
      toMerchantItem(merchant({ onboardingStatus: 'credited', paidAmount: 5000 })),
      toMerchantItem(merchant({ businessId: 'biz-2', businessName: 'Other' })),
    ];
    expect(filterPayBoardItems(items, 'unpaid').map((item) => item.id)).toEqual([
      'merchant_referral:biz-2',
    ]);
    expect(filterPayBoardItems(items, 'paid')).toHaveLength(1);
    expect(filterPayBoardItems(items, 'all')).toHaveLength(2);
    expect(parsePayBoardStatus(undefined)).toBe('unpaid');
    expect(parsePayBoardStatus('nope')).toBe('unpaid');
    expect(parsePayBoardStatus('all')).toBe('all');
  });

  it('sums earned sources and keeps pending bonuses out of earned', () => {
    const paid = toMerchantItem(
      merchant({ onboardingStatus: 'credited', paidAmount: 5000, salePercentEarned: 40 })
    );
    const summary = buildPayBoardSummary({
      currency: 'XAF',
      items: [paid, toMerchantItem(merchant({ businessId: 'biz-2' }))],
      merchantEarned: 5000,
      merchantPending: 7500,
      salePercentEarned: 100,
      scheduleEarned: 2000,
      deliveryEarned: 800,
    });
    expect(summary.earnedAmount).toBe(7900);
    expect(summary.pendingAmount).toBe(7500);
    expect(summary.counts).toEqual({ paid: 1, unpaid: 1 });
    expect(summary.sources).toEqual([
      { kind: 'merchant_referral', earnedAmount: 5000, pendingAmount: 7500 },
      { kind: 'sale_percent', earnedAmount: 100, pendingAmount: 0 },
      { kind: 'payment_schedule', earnedAmount: 2000, pendingAmount: 0 },
      { kind: 'delivery_commission', earnedAmount: 800, pendingAmount: 0 },
    ]);
  });

  it('indexes credited sales and pending onboarding without counting a closed window', () => {
    const extras = indexPayBoardExtras({
      currency: 'XAF',
      deliveryEarned: 10,
      scheduleRuns: [{ assignmentId: 'plan-1', amount: 2000, currency: 'XAF' }],
      events: [
        {
          businessId: 'biz-1',
          amount: 80,
          currency: 'XAF',
          status: 'credited',
          ruleCode: 'sale_percent',
        },
        {
          businessId: 'biz-1',
          amount: 7500,
          currency: 'XAF',
          status: 'pending',
          ruleCode: 'onboarding_x_first_sale',
        },
      ],
    });
    expect(extras.salePercentEarned).toBe(80);
    expect(extras.salePercentByBusiness['biz-1']).toBe(80);
    expect(extras.merchantPending).toBe(7500);
    expect(extras.scheduleEarned).toBe(2000);
    expect(extras.deliveryEarned).toBe(10);
  });

  it('treats a fully met schedule as paid and an open one as unpaid', () => {
    const open = toScheduleItem(schedule({ percent: 40 }));
    const met = toScheduleItem(schedule({ percent: 100 }));
    expect(open).toMatchObject({ paymentStatus: 'unpaid', nextStep: 'meet_objectives' });
    expect(met).toMatchObject({ paymentStatus: 'paid', nextStep: 'objectives_met' });
    expect(toScheduleItem(schedule({ percent: 0, target: 0 }))).toBeNull();
  });
});

function schedule(input: { percent: number; target?: number }): Parameters<typeof toScheduleItem>[0] {
  const target = input.target ?? 10;
  return {
    id: 'plan-1',
    title: 'Weekly plan',
    currency: 'XAF',
    stipendAmount: 1000,
    frequency: 'weekly',
    deadline: FUTURE,
    postedAmount: 1000,
    overallPercent: input.percent,
    objectives:
      target <= 0
        ? []
        : [{ key: 'merchantRecruitments', actual: 4, target, percent: input.percent }],
  };
}

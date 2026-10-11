import { AgentPayBoardService } from './agent-pay-board.service';
import type { PayBoard } from './agent-pay-board.types';
import type { ReferredBusinessFollowUp } from '../business-referrals/referred-business-followup.util';
import {
  LEGACY_ONBOARDING_FIRST_SALE_AMOUNT_KEY,
  ONBOARDING_X_FIRST_SALE_AMOUNT_KEY,
  ONBOARDING_X_SELF_SALE_AMOUNT_KEY,
} from '../representative-compensation/compensation-rules';
import type { ObjectiveProgress } from '../payment-programs/payment-schedule-progress.service';

const FUTURE = '2099-01-01T00:00:00.000Z';
const PAST = '2020-01-01T00:00:00.000Z';
const SALE_PERCENT_KEY = 'sale_only_commission_percent';

type ConfigValue = { number_value?: unknown } | null;

function metric(
  target: number | null = null,
  percent: number | null = null,
  actual = 0
) {
  return { actual, target, percent };
}

function progress(patch: Partial<ObjectiveProgress> = {}): ObjectiveProgress {
  return {
    itemSales: metric(),
    rentals: metric(),
    clientSignups: metric(),
    merchantRecruitments: metric(),
    agentRecruitments: metric(),
    completionPercent: null,
    overallPercent: null,
    nextObjective: null,
    ...patch,
  };
}

function business(
  overrides: Partial<ReferredBusinessFollowUp> & { businessId: string }
): ReferredBusinessFollowUp {
  return {
    businessName: 'Shop',
    ownerFirstName: 'Ada',
    ownerLastName: 'Lovelace',
    phone: '+237600000000',
    email: 'shop@example.com',
    lifecycleStatus: 'active',
    followUpStatus: 'active',
    itemsApproved: 2,
    itemsRejected: 0,
    itemsPending: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    country: 'CM',
    commission: {
      status: 'pending',
      paidAmount: null,
      currency: 'XAF',
      paidAt: null,
      requirements: {
        itemsApproved: 2,
        minItems: 2,
        salesTotal: 1000,
        minSalesTotal: 2500,
        windowEndsAt: FUTURE,
        requiresSale: true,
      },
    },
    ...overrides,
  };
}

function merchant(board: PayBoard, businessId: string) {
  const item = board.items.find(
    (row) => row.id === `merchant_referral:${businessId}`
  );
  if (!item || item.structure.type !== 'merchant_referral') {
    throw new Error(`missing merchant ${businessId}`);
  }
  return item;
}

function createHarness(options?: {
  businesses?: ReferredBusinessFollowUp[];
  schedules?: Array<Record<string, unknown>>;
  extras?: Record<string, unknown>;
  config?: (key: string, country: string) => Promise<ConfigValue>;
}) {
  const executeQuery = jest.fn().mockResolvedValue(options?.extras ?? {});
  const listReferredBusinesses = jest
    .fn()
    .mockResolvedValue(options?.businesses ?? []);
  const listAcceptedDetails = jest
    .fn()
    .mockResolvedValue(options?.schedules ?? []);
  const getConfigurationByKey = jest.fn(options?.config ?? (async () => null));
  type Deps = ConstructorParameters<typeof AgentPayBoardService>;
  const service = new AgentPayBoardService(
    { executeQuery } as unknown as Deps[0],
    { listReferredBusinesses } as unknown as Deps[1],
    { listAcceptedDetails } as unknown as Deps[2],
    { getConfigurationByKey } as unknown as Deps[3]
  );
  return {
    service,
    executeQuery,
    listReferredBusinesses,
    getConfigurationByKey,
  };
}

describe('AgentPayBoardService', () => {
  it('prices each shop from its own market and scopes the ledger to that agent', async () => {
    const {
      service,
      executeQuery,
      listReferredBusinesses,
      getConfigurationByKey,
    } = createHarness({
      businesses: [business({ businessId: 'biz-ga', country: 'GA' })],
      config: async (key, country) => {
        if (country !== 'GA') return { number_value: 1 };
        if (key === ONBOARDING_X_SELF_SALE_AMOUNT_KEY)
          return { number_value: 4000 };
        if (key === ONBOARDING_X_FIRST_SALE_AMOUNT_KEY)
          return { number_value: 8000 };
        if (key === SALE_PERCENT_KEY) return { number_value: 2 };
        return null;
      },
    });

    const board = await service.getBoard({
      agentId: 'agent-1',
      userId: 'user-1',
      country: 'cm',
      status: 'all',
    });

    expect(listReferredBusinesses).toHaveBeenCalledWith('agent-1');
    expect(executeQuery).toHaveBeenCalledWith(expect.any(String), {
      agentId: 'agent-1',
      userId: 'user-1',
      currency: 'XAF',
    });
    expect(getConfigurationByKey).not.toHaveBeenCalledWith(
      LEGACY_ONBOARDING_FIRST_SALE_AMOUNT_KEY,
      'GA'
    );
    const shop = merchant(board, 'biz-ga');
    expect(shop.structure).toMatchObject({
      selfSaleAmount: 4000,
      otherBuyerAmount: 8000,
      salePercent: 2,
      ownerName: 'Ada Lovelace',
    });
    expect(shop.currency).toBe('XAF');
  });

  it('falls back when a market amount is missing, non-positive, or unreadable', async () => {
    const { service, getConfigurationByKey } = createHarness({
      businesses: [business({ businessId: 'biz-ga', country: 'ga' })],
      config: async (key) => {
        if (key === ONBOARDING_X_SELF_SALE_AMOUNT_KEY)
          return { number_value: 0 };
        if (key === ONBOARDING_X_FIRST_SALE_AMOUNT_KEY)
          return { number_value: null };
        if (key === LEGACY_ONBOARDING_FIRST_SALE_AMOUNT_KEY)
          return { number_value: -5 };
        if (key === SALE_PERCENT_KEY) throw new Error('config down');
        return { number_value: Number.NaN };
      },
    });

    const board = await service.getBoard({
      agentId: 'agent-1',
      userId: 'user-1',
      country: 'GA',
      status: 'all',
    });

    expect(getConfigurationByKey).toHaveBeenCalledWith(
      LEGACY_ONBOARDING_FIRST_SALE_AMOUNT_KEY,
      'GA'
    );
    expect(merchant(board, 'biz-ga').structure).toMatchObject({
      selfSaleAmount: 5000,
      otherBuyerAmount: 7500,
      salePercent: 1,
    });
  });

  it('uses the CAD defaults and keeps an XAF bonus out of the CAD total', async () => {
    const { service } = createHarness({
      businesses: [
        business({
          businessId: 'biz-ca',
          country: 'CA',
          commission: {
            status: 'paid',
            paidAmount: 25,
            currency: '',
            paidAt: PAST,
            requirements: {
              itemsApproved: 2,
              minItems: 2,
              salesTotal: 40,
              minSalesTotal: 0,
              windowEndsAt: FUTURE,
              requiresSale: true,
            },
          },
        }),
        business({
          businessId: 'biz-cm',
          country: 'CM',
          commission: {
            status: 'paid',
            paidAmount: 7500,
            currency: 'XAF',
            paidAt: PAST,
            requirements: {
              itemsApproved: 2,
              minItems: 2,
              salesTotal: 3000,
              minSalesTotal: 2500,
              windowEndsAt: FUTURE,
              requiresSale: true,
            },
          },
        }),
      ],
      extras: {
        compensation_events: [
          {
            business_id: 'biz-cm',
            amount: 80,
            currency: 'XAF',
            status: 'credited',
            rule_code: 'sale_percent',
          },
          {
            business_id: 'biz-ca',
            amount: '4.5',
            currency: 'CAD',
            status: 'credited',
            rule_code: 'sale_percent',
          },
        ],
        commission_payouts_aggregate: {
          aggregate: { sum: { amount: '10.5' } },
        },
      },
    });

    const board = await service.getBoard({
      agentId: 'agent-ca',
      userId: 'user-ca',
      country: 'CA',
      status: 'all',
    });

    expect(merchant(board, 'biz-ca').structure).toMatchObject({
      selfSaleAmount: 25,
      otherBuyerAmount: 25,
      salePercent: 1,
      salePercentEarned: 4.5,
    });
    expect(merchant(board, 'biz-ca').currency).toBe('CAD');
    expect(merchant(board, 'biz-cm').structure.salePercentEarned).toBe(80);
    expect(board.summary.currency).toBe('CAD');
    expect(board.summary.earnedAmount).toBe(40);
    expect(board.summary.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'merchant_referral',
          earnedAmount: 25,
        }),
        expect.objectContaining({ kind: 'sale_percent', earnedAmount: 4.5 }),
        expect.objectContaining({
          kind: 'delivery_commission',
          earnedAmount: 10.5,
        }),
      ])
    );
  });

  it('keeps a credited bonus, counts a failed one as pending, and drops an empty plan', async () => {
    const { service } = createHarness({
      businesses: [
        business({
          businessId: 'biz-paid',
          commission: {
            status: 'paid',
            paidAmount: 1,
            currency: 'XAF',
            paidAt: PAST,
            requirements: {
              itemsApproved: 2,
              minItems: 2,
              salesTotal: 3000,
              minSalesTotal: 2500,
              windowEndsAt: FUTURE,
              requiresSale: true,
            },
          },
        }),
        business({ businessId: 'biz-failed' }),
      ],
      schedules: [
        {
          id: 'empty-plan',
          amount: 1000,
          currency: 'XAF',
          endsAt: FUTURE,
          schedule: { name: 'Unused', frequency: 'weekly' },
          progress: progress(),
        },
        {
          id: 'weekly',
          amount: '1000',
          currency: 'XAF',
          endsAt: null,
          schedule: { name: '   ', frequency: 'weekly' },
          progress: progress({
            merchantRecruitments: metric(4, 25, 1),
            overallPercent: 25,
          }),
        },
      ],
      extras: {
        compensation_events: [
          {
            business_id: 'biz-paid',
            amount: 5000,
            currency: 'XAF',
            status: 'credited',
            rule_code: 'onboarding_x_first_sale',
          },
          {
            business_id: 'biz-paid',
            amount: 9000,
            currency: 'XAF',
            status: 'pending',
            rule_code: 'onboarding_10_first_sale',
          },
          {
            business_id: null,
            amount: null,
            currency: null,
            status: null,
            rule_code: null,
          },
          {
            business_id: 'biz-failed',
            amount: 2000,
            currency: 'XAF',
            status: 'failed',
            rule_code: 'onboarding_x_first_sale',
          },
        ],
        payment_schedule_runs: [
          {
            assignment_id: 'weekly',
            amount: '1500',
            assignment: { currency: 'XAF' },
          },
          {
            assignment_id: 'weekly',
            amount: 50,
            assignment: { currency: null },
          },
        ],
      },
    });

    const board = await service.getBoard({
      agentId: 'agent-1',
      userId: 'user-1',
      country: 'CM',
      status: 'all',
    });

    expect(merchant(board, 'biz-paid').structure.onboarding).toMatchObject({
      status: 'paid',
      paidAmount: 5000,
    });
    expect(merchant(board, 'biz-failed').nextStep).toBe('awaiting_payout');
    expect(
      board.items.some((item) => item.id === 'payment_schedule:empty-plan')
    ).toBe(false);
    // A run with no currency still posts on the assignment card.
    // Only an XAF run is included in the board summary.
    const plan = board.items.find(
      (item) => item.id === 'payment_schedule:weekly'
    );
    expect(plan).toMatchObject({
      title: '',
      deadline: null,
      paymentStatus: 'unpaid',
      structure: {
        type: 'payment_schedule',
        earnedAmount: 1550,
        stipendAmount: 1000,
      },
    });
    expect(board.summary.pendingAmount).toBe(2000);
    expect(board.summary.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'merchant_referral',
          earnedAmount: 5000,
          pendingAmount: 2000,
        }),
        expect.objectContaining({
          kind: 'payment_schedule',
          earnedAmount: 1500,
        }),
      ])
    );
  });

  it('filters closed windows and uses the agent market when the shop has no country', async () => {
    const { service } = createHarness({
      businesses: [
        business({
          businessId: 'late',
          country: null,
          commission: {
            status: 'pending',
            paidAmount: null,
            currency: '',
            paidAt: null,
            requirements: {
              itemsApproved: 0,
              minItems: 2,
              salesTotal: 0,
              minSalesTotal: 2500,
              windowEndsAt: PAST,
              requiresSale: true,
            },
          },
        }),
        business({ businessId: 'open', country: 'CM' }),
      ],
      config: async (key, country) => {
        if (country !== 'CM') return null;
        if (key === ONBOARDING_X_SELF_SALE_AMOUNT_KEY)
          return { number_value: '6500' };
        if (key === ONBOARDING_X_FIRST_SALE_AMOUNT_KEY)
          return { number_value: 9000 };
        return { number_value: 1 };
      },
    });

    const expired = await service.getBoard({
      agentId: 'agent-1',
      userId: 'user-1',
      country: 'CM',
      status: 'expired',
    });

    expect(expired.items.map((item) => item.id)).toEqual([
      'merchant_referral:late',
    ]);
    expect(merchant(expired, 'late').structure).toMatchObject({
      selfSaleAmount: 6500,
      otherBuyerAmount: 9000,
    });
    expect(merchant(expired, 'late').currency).toBe('XAF');
    expect(merchant(expired, 'late').nextStep).toBe('window_closed');
  });
});

import { RepresentativeCompensationService } from './representative-compensation.service';
import { ONBOARDING_10_FIRST_SALE, SALE_PERCENT } from './compensation-rules';

describe('RepresentativeCompensationService', () => {
  const hasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const paymentRoutingService = {
    getUserCountryCode: jest.fn(),
    resolveRailForUser: jest.fn(),
  };
  const configurationsService = {
    getConfigurationByKey: jest.fn(),
  };
  const referralPyramidService = {
    distributeReferralBonus: jest.fn(),
  };
  const accountsService = {
    findDepositByReference: jest.fn(),
    findDepositByReferenceId: jest.fn(),
    registerTransaction: jest.fn(),
  };

  let service: RepresentativeCompensationService;

  const snapshot = {
    businesses_by_pk: {
      id: 'biz-1',
      name: 'Shop',
      created_at: '2026-05-01T00:00:00.000Z',
      referred_by_agent_id: 'agent-1',
      referred_by_business_id: null,
      referring_agent: {
        id: 'agent-1',
        user_id: 'user-1',
        user: { first_name: 'Ada', last_name: 'Agent' },
      },
      referring_business: null,
      items_aggregate: { aggregate: { count: 12 } },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RepresentativeCompensationService(
      hasuraSystemService as never,
      paymentRoutingService as never,
      configurationsService as never,
      referralPyramidService as never,
      accountsService as never
    );
    paymentRoutingService.getUserCountryCode.mockResolvedValue('CM');
    paymentRoutingService.resolveRailForUser.mockResolvedValue('mobile_money');
    configurationsService.getConfigurationByKey.mockImplementation(
      async (key: string) => {
        if (key === 'business_referral_payout_enabled') {
          return { boolean_value: true, status: 'active' };
        }
        return null;
      }
    );
    referralPyramidService.distributeReferralBonus.mockResolvedValue({
      credited: 1,
      transactionIds: ['tx-1'],
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_representative_compensation_events_one: {
        id: 'evt-1',
        reference_id: 'ref-1',
        status: 'pending',
      },
    });
  });

  function mockBusinessQueries(
    sales: Array<{ id: string; subtotal: number; completedAt?: string }>,
    events: Array<Record<string, unknown>> = [],
    itemCount = 12
  ) {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CompensationBusiness')) {
        return {
          businesses_by_pk: {
            ...snapshot.businesses_by_pk,
            items_aggregate: { aggregate: { count: itemCount } },
          },
        };
      }
      if (query.includes('CompensationSales')) {
        return {
          orders: sales.map((sale) => ({
            id: sale.id,
            subtotal: sale.subtotal,
            currency: 'XAF',
            completed_at: sale.completedAt ?? '2026-05-10T00:00:00.000Z',
          })),
        };
      }
      if (query.includes('CompensationEventsForBusiness')) {
        return { representative_compensation_events: events };
      }
      if (query.includes('LegacyReferralPayout')) {
        return { business_referral_payouts: [] };
      }
      if (
        query.includes('CompensationPersonalAccount') ||
        query.includes('CompensationBusinessAccount')
      ) {
        return { accounts: [{ id: 'acct-1' }] };
      }
      return {};
    });
  }

  function stubSaleCredit() {
    accountsService.findDepositByReference.mockResolvedValue(null);
    accountsService.findDepositByReferenceId.mockResolvedValue(null);
    accountsService.registerTransaction.mockResolvedValue({
      success: true,
      transactionId: 'tx-sale',
    });
  }

  it('claims pending 7500 and credits 1% on the qualifying first sale', async () => {
    mockBusinessQueries([{ id: 'order-1', subtotal: 20000 }]);
    stubSaleCredit();

    const result = await service.evaluateForOrder('order-1', 'biz-1');

    expect(result.credited).toBe(1);
    expect(referralPyramidService.distributeReferralBonus).not.toHaveBeenCalled();
    expect(accountsService.registerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 200, transactionType: 'deposit' })
    );
    const inserts = hasuraSystemService.executeMutation.mock.calls
      .filter(([q]) => String(q).includes('InsertCompensationEvent'))
      .map(([, vars]) => vars.object.rule_code);
    expect(inserts).toEqual([ONBOARDING_10_FIRST_SALE, SALE_PERCENT]);
  });

  it('credits only 1% when the first sale is below 2500 XAF', async () => {
    mockBusinessQueries([{ id: 'order-1', subtotal: 1000 }]);
    stubSaleCredit();

    const result = await service.evaluateForOrder('order-1', 'biz-1');

    expect(result.credited).toBe(1);
    const inserts = hasuraSystemService.executeMutation.mock.calls
      .filter(([q]) => String(q).includes('InsertCompensationEvent'))
      .map(([, vars]) => vars.object.rule_code);
    expect(inserts).toEqual([SALE_PERCENT]);
  });

  it('pays 1% on a later sale after 7500 is already pending', async () => {
    mockBusinessQueries(
      [
        { id: 'order-1', subtotal: 8000 },
        { id: 'order-4', subtotal: 50000 },
      ],
      [
        {
          rule_code: ONBOARDING_10_FIRST_SALE,
          amount: 7500,
          status: 'pending',
          triggering_order_id: 'order-1',
        },
      ]
    );
    stubSaleCredit();

    const result = await service.evaluateForOrder('order-4', 'biz-1');

    expect(result.credited).toBe(2);
    expect(referralPyramidService.distributeReferralBonus).not.toHaveBeenCalled();
    expect(accountsService.registerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500, transactionType: 'deposit' })
    );
  });

  it('still pays 1% on a later retry of the onboarding order', async () => {
    mockBusinessQueries(
      [{ id: 'order-1', subtotal: 20000 }],
      [
        {
          rule_code: ONBOARDING_10_FIRST_SALE,
          amount: 7500,
          status: 'pending',
          triggering_order_id: 'order-1',
        },
      ]
    );
    stubSaleCredit();

    const result = await service.evaluateForOrder('order-1', 'biz-1');

    expect(result.credited).toBe(1);
    expect(accountsService.registerTransaction).toHaveBeenCalled();
    expect(referralPyramidService.distributeReferralBonus).not.toHaveBeenCalled();
  });

  it('does not fulfill an existing pending 7500 during weekday evaluate', async () => {
    mockBusinessQueries(
      [
        { id: 'order-1', subtotal: 8000 },
        { id: 'order-2', subtotal: 9000 },
      ],
      [],
      12
    );
    stubSaleCredit();
    hasuraSystemService.executeMutation.mockImplementation(
      async (mutation: string, vars?: any) => {
        if (String(mutation).includes('InsertCompensationEvent')) {
          if (vars?.object?.rule_code === ONBOARDING_10_FIRST_SALE) {
            throw new Error(
              'Uniqueness violation on uq_rce_business_onboarding_rule'
            );
          }
          return {
            insert_representative_compensation_events_one: {
              id: 'evt-pct',
              reference_id: 'ref-pct',
              status: 'pending',
              rule_code: SALE_PERCENT,
            },
          };
        }
        return {
          update_representative_compensation_events_by_pk: { id: 'evt-old' },
        };
      }
    );
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CompensationBusiness')) {
        return {
          businesses_by_pk: {
            ...snapshot.businesses_by_pk,
            items_aggregate: { aggregate: { count: 12 } },
          },
        };
      }
      if (query.includes('CompensationSales')) {
        return {
          orders: [
            {
              id: 'order-1',
              subtotal: 8000,
              currency: 'XAF',
              completed_at: '2026-05-10T00:00:00.000Z',
            },
            {
              id: 'order-2',
              subtotal: 9000,
              currency: 'XAF',
              completed_at: '2026-05-10T00:00:00.000Z',
            },
          ],
        };
      }
      if (query.includes('CompensationEventsForBusiness')) {
        return { representative_compensation_events: [] };
      }
      if (query.includes('LegacyReferralPayout')) {
        return { business_referral_payouts: [] };
      }
      if (
        query.includes('CompensationPersonalAccount') ||
        query.includes('CompensationBusinessAccount')
      ) {
        return { accounts: [{ id: 'acct-1' }] };
      }
      if (query.includes('ExistingCompensationEvent')) {
        const where = arguments[1]?.where;
        if (where?.triggering_order_id?._eq === 'order-2') {
          return { representative_compensation_events: [] };
        }
        return {
          representative_compensation_events: [
            {
              id: 'evt-old',
              reference_id: 'ref-old',
              status: 'pending',
              rule_code: ONBOARDING_10_FIRST_SALE,
              amount: 7500,
              triggering_order_id: null,
            },
          ],
        };
      }
      return {};
    });

    const result = await service.evaluateForOrder('order-2', 'biz-1');

    expect(result.credited).toBe(2);
    expect(referralPyramidService.distributeReferralBonus).not.toHaveBeenCalled();
    expect(accountsService.registerTransaction).toHaveBeenCalled();
  });

  it('credits only pending onboarding_10_first_sale rows on Saturday', async () => {
    configurationsService.getConfigurationByKey.mockResolvedValue({
      boolean_value: true,
      status: 'active',
    });
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('PendingOnboardingCompensation')) {
        return {
          representative_compensation_events: [
            {
              id: 'evt-bonus',
              reference_id: 'ref-bonus',
              status: 'pending',
              rule_code: ONBOARDING_10_FIRST_SALE,
              amount: 7500,
              business_id: 'biz-1',
              triggering_order_id: 'order-1',
            },
          ],
        };
      }
      if (query.includes('CompensationBusiness')) return snapshot;
      if (query.includes('CompensationSales')) {
        return {
          orders: [
            {
              id: 'order-1',
              subtotal: 20000,
              currency: 'XAF',
              completed_at: '2026-05-10T00:00:00.000Z',
            },
          ],
        };
      }
      if (query.includes('CompensationEventsForBusiness')) {
        return {
          representative_compensation_events: [
            {
              rule_code: ONBOARDING_10_FIRST_SALE,
              amount: 7500,
              status: 'pending',
              triggering_order_id: 'order-1',
            },
          ],
        };
      }
      if (query.includes('LegacyReferralPayout')) {
        return { business_referral_payouts: [] };
      }
      return {};
    });

    const result = await service.sweepPending();

    expect(result.credited).toBe(1);
    expect(referralPyramidService.distributeReferralBonus).toHaveBeenCalledWith(
      expect.objectContaining({
        grossAmount: 7500,
        compensationEventId: 'evt-bonus',
      })
    );
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
  });

  it('lists pending onboarding rows in Saturday preview', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      representative_compensation_events: [
        {
          amount: 7500,
          currency: 'XAF',
          country_code: 'CM',
          item_count: 12,
          triggering_order_id: 'order-1',
          business: { id: 'biz-1', name: 'Shop' },
          earner_agent: {
            id: 'agent-1',
            user_id: 'user-1',
            user: { first_name: 'Ada', last_name: 'Agent' },
          },
          earner_business: null,
        },
      ],
    });

    const rows = await service.previewPending('CM');

    expect(rows).toEqual([
      expect.objectContaining({
        businessId: 'biz-1',
        ruleCode: ONBOARDING_10_FIRST_SALE,
        amount: 7500,
        earnerKind: 'agent',
        earnerName: 'Ada Agent',
      }),
    ]);
  });

  it('retries a failed onboarding_10_first_sale on Saturday', async () => {
    configurationsService.getConfigurationByKey.mockResolvedValue({
      boolean_value: true,
      status: 'active',
    });
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('PendingOnboardingCompensation')) {
        return {
          representative_compensation_events: [
            {
              id: 'evt-failed',
              reference_id: 'ref-failed',
              status: 'failed',
              rule_code: ONBOARDING_10_FIRST_SALE,
              amount: 7500,
              business_id: 'biz-1',
              triggering_order_id: 'order-1',
            },
          ],
        };
      }
      if (query.includes('CompensationBusiness')) return snapshot;
      if (query.includes('CompensationSales')) {
        return {
          orders: [
            {
              id: 'order-1',
              subtotal: 20000,
              currency: 'XAF',
              completed_at: '2026-05-10T00:00:00.000Z',
            },
          ],
        };
      }
      if (query.includes('CompensationEventsForBusiness')) {
        return {
          representative_compensation_events: [
            {
              rule_code: ONBOARDING_10_FIRST_SALE,
              amount: 7500,
              status: 'failed',
              triggering_order_id: 'order-1',
            },
          ],
        };
      }
      if (query.includes('LegacyReferralPayout')) {
        return { business_referral_payouts: [] };
      }
      return {};
    });

    const result = await service.sweepPending();

    expect(result.credited).toBe(1);
    expect(referralPyramidService.distributeReferralBonus).toHaveBeenCalledWith(
      expect.objectContaining({ compensationEventId: 'evt-failed' })
    );
  });

  it('retries a failed 1% from an earlier order on the next sale', async () => {
    mockBusinessQueries(
      [
        { id: 'order-1', subtotal: 8000 },
        { id: 'order-2', subtotal: 9000 },
      ],
      [
        {
          rule_code: ONBOARDING_10_FIRST_SALE,
          amount: 7500,
          status: 'pending',
          triggering_order_id: 'order-1',
        },
      ]
    );
    stubSaleCredit();
    hasuraSystemService.executeMutation.mockImplementation(
      async (mutation: string, vars?: any) => {
        if (
          String(mutation).includes('InsertCompensationEvent') &&
          vars?.object?.triggering_order_id === 'order-1'
        ) {
          throw new Error('Uniqueness violation on uq_rce_order_sale_percent');
        }
        if (String(mutation).includes('InsertCompensationEvent')) {
          return {
            insert_representative_compensation_events_one: {
              id: 'evt-pct-2',
              reference_id: 'ref-pct-2',
              status: 'pending',
              rule_code: SALE_PERCENT,
            },
          };
        }
        return {
          update_representative_compensation_events_by_pk: { id: 'evt-pct-failed' },
        };
      }
    );
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CompensationBusiness')) {
        return {
          businesses_by_pk: {
            ...snapshot.businesses_by_pk,
            items_aggregate: { aggregate: { count: 12 } },
          },
        };
      }
      if (query.includes('CompensationSales')) {
        return {
          orders: [
            {
              id: 'order-1',
              subtotal: 8000,
              currency: 'XAF',
              completed_at: '2026-05-10T00:00:00.000Z',
            },
            {
              id: 'order-2',
              subtotal: 9000,
              currency: 'XAF',
              completed_at: '2026-05-10T00:00:00.000Z',
            },
          ],
        };
      }
      if (query.includes('CompensationEventsForBusiness')) {
        return {
          representative_compensation_events: [
            {
              rule_code: ONBOARDING_10_FIRST_SALE,
              amount: 7500,
              status: 'pending',
              triggering_order_id: 'order-1',
            },
          ],
        };
      }
      if (query.includes('LegacyReferralPayout')) {
        return { business_referral_payouts: [] };
      }
      if (
        query.includes('CompensationPersonalAccount') ||
        query.includes('CompensationBusinessAccount')
      ) {
        return { accounts: [{ id: 'acct-1' }] };
      }
      if (query.includes('ExistingCompensationEvent')) {
        return {
          representative_compensation_events: [
            {
              id: 'evt-pct-failed',
              reference_id: 'ref-pct-failed',
              status: 'failed',
              rule_code: SALE_PERCENT,
              amount: 80,
              triggering_order_id: 'order-1',
              sale_amount: 8000,
            },
          ],
        };
      }
      return {};
    });

    const result = await service.evaluateForOrder('order-2', 'biz-1');

    expect(result.credited).toBe(2);
    expect(accountsService.registerTransaction).toHaveBeenCalledTimes(2);
    expect(referralPyramidService.distributeReferralBonus).not.toHaveBeenCalled();
  });

  it('does nothing when the payout flag is off', async () => {
    configurationsService.getConfigurationByKey.mockResolvedValue({
      boolean_value: false,
      status: 'active',
    });

    const result = await service.evaluateForBusiness('biz-1');

    expect(result).toEqual({ credited: 0, skipped: 0, failed: 0 });
    expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
  });
});

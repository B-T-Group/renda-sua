import { RepresentativeCompensationService } from './representative-compensation.service';
import {
  ONBOARDING_10_FIRST_SALE,
  ONBOARDING_25_LARGE_SALE,
  SALE_PERCENT,
} from './compensation-rules';

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

  function mockBusinessQueries(sales: Array<{ id: string; subtotal: number }>) {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CompensationBusiness')) return snapshot;
      if (query.includes('CompensationSales')) {
        return {
          orders: sales.map((sale) => ({
            id: sale.id,
            subtotal: sale.subtotal,
            currency: 'XAF',
          })),
        };
      }
      if (query.includes('CompensationEventsForBusiness')) {
        return { representative_compensation_events: [] };
      }
      if (query.includes('LegacyReferralPayout')) {
        return { business_referral_payouts: [] };
      }
      return {};
    });
  }

  it('credits the 10-item first-sale milestone and skips 1% on that order', async () => {
    mockBusinessQueries([{ id: 'order-1', subtotal: 20000 }]);

    const result = await service.evaluateForOrder('order-1', 'biz-1');

    expect(result.credited).toBe(1);
    expect(referralPyramidService.distributeReferralBonus).toHaveBeenCalledWith(
      expect.objectContaining({
        grossAmount: 7500,
        compensationEventId: 'evt-1',
      })
    );
    const insert = hasuraSystemService.executeMutation.mock.calls.find(([q]) =>
      String(q).includes('InsertCompensationEvent')
    );
    expect(insert?.[1].object.rule_code).toBe(ONBOARDING_10_FIRST_SALE);
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
  });

  it('pays 1% when already at the large milestone', async () => {
    mockBusinessQueries([{ id: 'order-2', subtotal: 50000 }]);
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CompensationBusiness')) {
        return {
          businesses_by_pk: {
            ...snapshot.businesses_by_pk,
            items_aggregate: { aggregate: { count: 30 } },
          },
        };
      }
      if (query.includes('CompensationSales')) {
        return {
          orders: [
            { id: 'order-1', subtotal: 20000, currency: 'XAF' },
            { id: 'order-2', subtotal: 50000, currency: 'XAF' },
          ],
        };
      }
      if (query.includes('CompensationEventsForBusiness')) {
        return {
          representative_compensation_events: [
            {
              rule_code: ONBOARDING_25_LARGE_SALE,
              amount: 15000,
              status: 'credited',
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
      return {};
    });
    accountsService.findDepositByReference.mockResolvedValue(null);
    accountsService.findDepositByReferenceId.mockResolvedValue(null);
    accountsService.registerTransaction.mockResolvedValue({
      success: true,
      transactionId: 'tx-sale',
    });

    const result = await service.evaluateForOrder('order-2', 'biz-1');

    expect(result.credited).toBe(1);
    expect(accountsService.registerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500, transactionType: 'deposit' })
    );
    const insert = hasuraSystemService.executeMutation.mock.calls.find(([q]) =>
      String(q).includes('InsertCompensationEvent')
    );
    expect(insert?.[1].object.rule_code).toBe(SALE_PERCENT);
  });

  it('does not pay 1% on a later retry of the onboarding order', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CompensationBusiness')) return snapshot;
      if (query.includes('CompensationSales')) {
        return { orders: [{ id: 'order-1', subtotal: 20000, currency: 'XAF' }] };
      }
      if (query.includes('CompensationEventsForBusiness')) {
        return {
          representative_compensation_events: [
            {
              rule_code: ONBOARDING_10_FIRST_SALE,
              amount: 7500,
              status: 'credited',
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

    const result = await service.evaluateForOrder('order-1', 'biz-1');

    expect(result.credited).toBe(0);
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(referralPyramidService.distributeReferralBonus).not.toHaveBeenCalled();
  });

  it('skips a duplicate insert on unique violation', async () => {
    mockBusinessQueries([{ id: 'order-1', subtotal: 20000 }]);
    hasuraSystemService.executeMutation.mockRejectedValue(
      new Error('Uniqueness violation on uq_rce_business_onboarding_rule')
    );
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CompensationBusiness')) return snapshot;
      if (query.includes('CompensationSales')) {
        return { orders: [{ id: 'order-1', subtotal: 20000, currency: 'XAF' }] };
      }
      if (query.includes('CompensationEventsForBusiness')) {
        return { representative_compensation_events: [] };
      }
      if (query.includes('LegacyReferralPayout')) {
        return { business_referral_payouts: [] };
      }
      if (query.includes('ExistingCompensationEvent')) {
        return {
          representative_compensation_events: [
            { id: 'evt-1', reference_id: 'ref-1', status: 'credited' },
          ],
        };
      }
      return {};
    });

    const result = await service.evaluateForOrder('order-1', 'biz-1');

    expect(result.skipped).toBeGreaterThanOrEqual(1);
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

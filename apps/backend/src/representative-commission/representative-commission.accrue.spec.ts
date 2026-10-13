import { RepresentativeCommissionService } from './representative-commission.service';
import type { AccrualOrder } from './representative-commission.service';

const order = (completedAt: string | null): AccrualOrder => ({
  orderId: 'order-1',
  businessId: 'biz-1',
  currency: 'XAF',
  subtotal: 10000,
  itemCommission: 1000,
  deliveryFeeWaived: false,
  baseDeliveryFee: 0,
  perKmDeliveryFee: 0,
  firstOrderDiscount: 0,
  clientUserId: 'client-user',
  countryCode: 'CM',
  completedAt,
});

describe('RepresentativeCommissionService.accrue', () => {
  const hasura = { executeQuery: jest.fn() };
  const configurations = {
    getConfigurationByKey: jest.fn(),
    // Global lookup = the country-less read (country_code IS NULL).
    getGlobalConfigurationByKey: jest.fn((key: string) =>
      configurations.getConfigurationByKey(key, undefined)
    ),
  };
  const grids = { loadFor: jest.fn() };
  const accounts = {};
  const service = new RepresentativeCommissionService(
    hasura as never,
    configurations as never,
    grids as never,
    accounts as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configurations.getConfigurationByKey.mockResolvedValue({
      boolean_value: true,
      status: 'active',
    });
    grids.loadFor.mockResolvedValue({ id: 'grid-1', inactiveDays: 90, currency: 'XAF' });
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('PortfolioBusiness')) {
        return {
          businesses_by_pk: {
            id: 'biz-1',
            referred_by_agent_id: 'agent-1',
            merchant_agreement_accepted_at: '2024-01-01T00:00:00.000Z',
            referring_agent: { user_id: 'user-1' },
          },
          representative_portfolio_exits_by_pk: null,
        };
      }
      if (query.includes('AgentContractEnd')) return { agent_contracts: [] };
      if (query.includes('LastPortfolioSale')) {
        return { orders: [{ completed_at: '2020-01-01T00:00:00.000Z' }] };
      }
      if (query.includes('ExitPortfolio')) {
        return { insert_representative_portfolio_exits_one: { business_id: 'biz-1' } };
      }
      if (query.includes('InsertPortfolioAccrual')) {
        return { insert_representative_commission_accruals_one: { id: 'acc-1' } };
      }
      throw new Error(`unexpected query ${query.slice(0, 60)}`);
    });
  });

  it('does not lapse or insert while the sale has no completed_at', async () => {
    await service.accrue(order(null));
    expect(hasura.executeQuery).not.toHaveBeenCalled();
    expect(configurations.getConfigurationByKey).not.toHaveBeenCalled();
  });

  it('accrues a completed sale and does not exit on an older last sale', async () => {
    const cutover = Date.parse('2026-11-02T00:00:00.000Z');
    const completedAt = new Date(Math.max(Date.now(), cutover)).toISOString();
    await service.accrue(order(completedAt));
    const queries = hasura.executeQuery.mock.calls.map((call) => String(call[0]));
    expect(queries.some((query) => query.includes('ExitPortfolio'))).toBe(false);
    expect(queries.some((query) => query.includes('LastPortfolioSale'))).toBe(false);
    expect(queries.some((query) => query.includes('InsertPortfolioAccrual'))).toBe(true);
  });
});

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../accounts/accounts.service', () => ({
  AccountsService: class AccountsService {},
}));
jest.mock('../mobile-payments/give-change-payout.service', () => ({
  GiveChangePayoutService: class GiveChangePayoutService {},
}));
jest.mock('../stripe-payments/payment-routing.service', () => ({
  PaymentRoutingService: class PaymentRoutingService {},
}));
jest.mock('../stripe-payments/stripe-payout.service', () => ({
  StripePayoutService: class StripePayoutService {},
}));
jest.mock('../launch-promo/launch-promo.service', () => ({
  LaunchPromoService: class LaunchPromoService {},
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: class MerchantLifecycleService {},
}));

import { CommissionsService } from './commissions.service';

describe('CommissionsService portfolio accrual', () => {
  const hasura = { executeQuery: jest.fn() };
  const routing = { getUserCountryCode: jest.fn() };
  const launchPromo = { orderConsumedPromo: jest.fn() };
  const portfolio: { accrue: jest.Mock; replacesLegacy?: jest.Mock } = { accrue: jest.fn() };

  function createService() {
    return new CommissionsService(
      {} as never,
      hasura as never,
      {} as never,
      {} as never,
      routing as never,
      {} as never,
      launchPromo as never,
      portfolio as never
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    portfolio.accrue.mockResolvedValue(undefined);
    launchPromo.orderConsumedPromo.mockResolvedValue(false);
    routing.getUserCountryCode.mockResolvedValue('cm');
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CompletedPortfolioOrder')) return { orders_by_pk: completedOrder() };
      if (query.includes('PortfolioAgentUser')) {
        return { businesses_by_pk: { referring_agent: { user_id: 'agent-user' } } };
      }
      throw new Error(`unexpected query ${query.slice(0, 60)}`);
    });
  });

  it('does not accrue an order that is not complete or delivered', async () => {
    const service = createService();
    jest.spyOn(service, 'getCommissionConfigs').mockResolvedValue(configs(10));
    hasura.executeQuery.mockResolvedValueOnce({
      orders_by_pk: completedOrder({ current_status: 'pending' }),
    });
    await service.accruePortfolioForCompletedOrder('order-1');
    hasura.executeQuery.mockResolvedValueOnce({ orders_by_pk: null });
    await service.accruePortfolioForCompletedOrder('missing');
    hasura.executeQuery.mockResolvedValueOnce({
      orders_by_pk: completedOrder({ current_status: 'COMPLETE' }),
    });
    await service.accruePortfolioForCompletedOrder('order-1');
    expect(portfolio.accrue).not.toHaveBeenCalled();
    expect(launchPromo.orderConsumedPromo).not.toHaveBeenCalled();
  });

  it('accrues the item percent for a delivered order and zero when promo was consumed', async () => {
    const service = createService();
    const configsSpy = jest.spyOn(service, 'getCommissionConfigs').mockResolvedValue(configs(10));
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CompletedPortfolioOrder')) {
        return { orders_by_pk: completedOrder({ current_status: 'delivered', subtotal: '2500' }) };
      }
      return { businesses_by_pk: { referring_agent: { user_id: 'agent-user' } } };
    });
    await service.accruePortfolioForCompletedOrder('order-1');
    expect(portfolio.accrue).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        subtotal: 2500,
        itemCommission: 250,
        countryCode: 'CM',
        clientUserId: 'client-1',
        baseDeliveryFee: 500,
        firstOrderDiscount: 100,
        completedAt: '2026-11-02T00:00:00.000Z',
      })
    );
    expect(configsSpy).toHaveBeenCalledWith('loc-1');

    launchPromo.orderConsumedPromo.mockResolvedValue(true);
    await service.accruePortfolioForCompletedOrder('order-1');
    expect(portfolio.accrue).toHaveBeenLastCalledWith(
      expect.objectContaining({ itemCommission: 0, subtotal: 2500 })
    );
  });

  it('defaults a missing agent country to CM and ignores a non-numeric subtotal', async () => {
    const service = createService();
    const configsSpy = jest.spyOn(service, 'getCommissionConfigs').mockResolvedValue(configs(10));
    routing.getUserCountryCode.mockResolvedValue(null);
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('CompletedPortfolioOrder')) {
        return {
          orders_by_pk: completedOrder({
            subtotal: 'abc',
            business_location_id: null,
            business_location: { id: 'loc-nested' },
            client: null,
          }),
        };
      }
      return { businesses_by_pk: { referring_agent: null } };
    });
    await service.accruePortfolioForCompletedOrder('order-1');
    expect(routing.getUserCountryCode).not.toHaveBeenCalled();
    expect(portfolio.accrue).toHaveBeenCalledWith(
      expect.objectContaining({
        itemCommission: 0,
        subtotal: 0,
        countryCode: 'CM',
        clientUserId: null,
      })
    );
    expect(configsSpy).toHaveBeenCalledWith('loc-nested');
  });

  it('drops legacy pay only when the portfolio check returns true', async () => {
    const service = createService();
    const at = new Date('2026-11-02T00:00:00.000Z');
    const replacesLegacy = jest.fn().mockResolvedValue(true);
    portfolio.replacesLegacy = replacesLegacy;

    await expect(service.portfolioReplacesLegacy('CM', 'XAF', at)).resolves.toBe(true);
    replacesLegacy.mockResolvedValue(false);
    await expect(service.portfolioReplacesLegacy('CA', 'CAD', at)).resolves.toBe(false);
    replacesLegacy.mockResolvedValue(undefined);
    await expect(service.portfolioReplacesLegacy('CM', 'XAF', at)).resolves.toBe(false);
    expect(replacesLegacy).toHaveBeenLastCalledWith('CM', 'XAF', at);
  });

  it('keeps legacy pay when the portfolio check throws or is unwired', async () => {
    const service = createService();
    const at = new Date('2026-11-02T00:00:00.000Z');
    portfolio.replacesLegacy = jest.fn().mockRejectedValue(new Error('grid down'));

    await expect(service.portfolioReplacesLegacy('CM', 'XAF', at)).resolves.toBe(false);

    const unwired = new CommissionsService(
      {} as never,
      hasura as never,
      {} as never,
      {} as never,
      routing as never,
      {} as never,
      launchPromo as never
    );
    await expect(unwired.portfolioReplacesLegacy('CM', 'XAF', at)).resolves.toBe(false);
  });

  it('swallows a portfolio failure and skips an order with no shop', async () => {
    const service = createService();
    jest.spyOn(service, 'getCommissionConfigs').mockRejectedValue(new Error('config down'));
    await expect(service.accruePortfolioForCompletedOrder('order-1')).resolves.toBeUndefined();
    expect(portfolio.accrue).not.toHaveBeenCalled();

    jest.spyOn(service, 'getCommissionConfigs').mockResolvedValue(configs(10));
    hasura.executeQuery.mockResolvedValue({
      orders_by_pk: completedOrder({ business_id: null }),
    });
    await service.accruePortfolioForCompletedOrder('order-1');
    expect(portfolio.accrue).not.toHaveBeenCalled();
  });
});

function configs(percent: number) {
  return {
    rendasuaItemCommissionPercentage: percent,
    unverifiedAgentBaseDeliveryCommission: 80,
    verifiedAgentBaseDeliveryCommission: 80,
    unverifiedAgentPerKmDeliveryCommission: 80,
    verifiedAgentPerKmDeliveryCommission: 80,
  };
}

function completedOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    business_id: 'biz-1',
    business_location_id: 'loc-1',
    currency: 'XAF',
    subtotal: 10000,
    current_status: 'complete',
    completed_at: '2026-11-02T00:00:00.000Z',
    delivery_fee_waived: false,
    base_delivery_fee: '500',
    per_km_delivery_fee: 0,
    first_order_base_delivery_discount_amount: '100',
    client: { user_id: 'client-1' },
    ...overrides,
  };
}

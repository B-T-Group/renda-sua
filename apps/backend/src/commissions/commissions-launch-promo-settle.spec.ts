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

describe('CommissionsService launch promo settle/restore', () => {
  function createService() {
    const accountsService = {};
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    const giveChangePayoutService = {};
    const notificationsService = {};
    const paymentRoutingService = {};
    const stripePayoutService = {};
    const launchPromo = {
      consumePromoOrder: jest.fn(),
      restorePromoOrder: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CommissionsService(
      accountsService as any,
      hasura as any,
      giveChangePayoutService as any,
      notificationsService as any,
      paymentRoutingService as any,
      stripePayoutService as any,
      launchPromo as any
    );
    return { service, hasura, launchPromo };
  }

  const order = {
    id: 'order-1',
    order_number: 'ORD-1',
    business_id: 'biz-1',
    business_location_id: 'loc-1',
    subtotal: 1000,
    currency: 'XAF',
    base_delivery_fee: 0,
    per_km_delivery_fee: 0,
  };

  it('consumes promo then restores when settle fails after consume', async () => {
    const { service, launchPromo } = createService();
    launchPromo.consumePromoOrder.mockResolvedValue(true);
    jest
      .spyOn(service as any, 'settleItemCommissions')
      .mockRejectedValue(new Error('settle failed'));

    await expect(service.distributeItemCommissions(order)).rejects.toThrow(
      'settle failed'
    );

    expect(launchPromo.consumePromoOrder).toHaveBeenCalledWith(
      'biz-1',
      'order-1'
    );
    expect(launchPromo.restorePromoOrder).toHaveBeenCalledWith(
      'biz-1',
      'order-1'
    );
  });

  it('does not restore when settle fails without a consumed promo', async () => {
    const { service, launchPromo } = createService();
    launchPromo.consumePromoOrder.mockResolvedValue(false);
    jest
      .spyOn(service as any, 'settleItemCommissions')
      .mockRejectedValue(new Error('settle failed'));

    await expect(service.distributeItemCommissions(order)).rejects.toThrow(
      'settle failed'
    );

    expect(launchPromo.consumePromoOrder).toHaveBeenCalledWith(
      'biz-1',
      'order-1'
    );
    expect(launchPromo.restorePromoOrder).not.toHaveBeenCalled();
  });

  it('skips consume when business id cannot be resolved', async () => {
    const { service, launchPromo, hasura } = createService();
    hasura.executeQuery.mockRejectedValue(new Error('hasura down'));

    jest.spyOn(service, 'calculateCommissions').mockResolvedValue({
      baseDeliveryFee: { agent: 0, partner: 0, rendasua: 0 },
      perKmDeliveryFee: { agent: 0, partner: 0, rendasua: 0 },
      itemCommission: { partner: 0, rendasua: 0 },
      orderSubtotal: { business: 1000, rendasua: 0 },
    } as any);
    jest.spyOn(service, 'getRendasuaHQUser').mockResolvedValue({ id: 'hq-1' });
    jest.spyOn(service, 'getActivePartners').mockResolvedValue([]);
    jest
      .spyOn(service as any, 'processItemCommissions')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'processOrderSubtotalPayment')
      .mockResolvedValue(undefined);

    await service.distributeItemCommissions({
      ...order,
      business_id: undefined,
      business_location_id: 'loc-missing',
    });

    expect(launchPromo.consumePromoOrder).not.toHaveBeenCalled();
    expect(launchPromo.restorePromoOrder).not.toHaveBeenCalled();
  });

  it('forces zero item commission when promo is consumed', async () => {
    const { service, launchPromo } = createService();
    launchPromo.consumePromoOrder.mockResolvedValue(true);

    const calculateSpy = jest
      .spyOn(service, 'calculateCommissions')
      .mockResolvedValue({
        baseDeliveryFee: { agent: 0, partner: 0, rendasua: 0 },
        perKmDeliveryFee: { agent: 0, partner: 0, rendasua: 0 },
        itemCommission: { partner: 50, rendasua: 50 },
        orderSubtotal: { business: 1000, rendasua: 0 },
      } as any);
    jest.spyOn(service, 'getRendasuaHQUser').mockResolvedValue({ id: 'hq-1' });
    jest.spyOn(service, 'getActivePartners').mockResolvedValue([
      { user_id: 'partner-1', item_commission: 20 } as any,
    ]);
    const processItemSpy = jest
      .spyOn(service as any, 'processItemCommissions')
      .mockResolvedValue(undefined);
    const subtotalSpy = jest
      .spyOn(service as any, 'processOrderSubtotalPayment')
      .mockResolvedValue(undefined);

    await service.distributeItemCommissions(order);

    expect(calculateSpy).toHaveBeenCalledWith(order, {
      forceZeroItemCommission: true,
    });
    expect(processItemSpy).toHaveBeenCalledWith(
      order,
      { partner: 50, rendasua: 50 },
      { id: 'hq-1' },
      [{ user_id: 'partner-1', item_commission: 20 }],
      true
    );
    expect(subtotalSpy).toHaveBeenCalled();
    expect(launchPromo.restorePromoOrder).not.toHaveBeenCalled();
  });

  it('processItemCommissions no-ops partner/HQ credits when forceZero', async () => {
    const { service } = createService();
    const paySpy = jest
      .spyOn(service as any, 'payCommission')
      .mockResolvedValue(undefined);

    await (service as any).processItemCommissions(
      order,
      { partner: 40, rendasua: 60 },
      { id: 'hq-1' },
      [{ user_id: 'partner-1', item_commission: 20 }],
      true
    );

    expect(paySpy).not.toHaveBeenCalled();
  });

  it('resolves business id from location when order.business_id is missing', async () => {
    const { service, launchPromo, hasura } = createService();
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (String(query).includes('OrderBusinessId')) {
        return {
          business_locations_by_pk: { business_id: 'biz-from-loc' },
        };
      }
      return {};
    });
    launchPromo.consumePromoOrder.mockResolvedValue(false);
    jest.spyOn(service, 'calculateCommissions').mockResolvedValue({
      baseDeliveryFee: { agent: 0, partner: 0, rendasua: 0 },
      perKmDeliveryFee: { agent: 0, partner: 0, rendasua: 0 },
      itemCommission: { partner: 0, rendasua: 0 },
      orderSubtotal: { business: 1000, rendasua: 0 },
    } as any);
    jest.spyOn(service, 'getRendasuaHQUser').mockResolvedValue({ id: 'hq-1' });
    jest.spyOn(service, 'getActivePartners').mockResolvedValue([]);
    jest
      .spyOn(service as any, 'processItemCommissions')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'processOrderSubtotalPayment')
      .mockResolvedValue(undefined);

    await service.distributeItemCommissions({
      ...order,
      business_id: undefined,
    });

    expect(launchPromo.consumePromoOrder).toHaveBeenCalledWith(
      'biz-from-loc',
      'order-1'
    );
  });

  it('credits the service fee to HQ when launch promo zeros item commission', async () => {
    const { service, launchPromo } = createService();
    launchPromo.consumePromoOrder.mockResolvedValue(true);
    const paySpy = mockItemSettle(service);

    await service.distributeItemCommissions({
      ...order,
      service_fee: 150.456,
      currency: 'XAF',
    });

    expect(paySpy).toHaveBeenCalledTimes(1);
    expect(paySpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1', service_fee: 150.456 }),
      'hq-1',
      'rendasua',
      'service_fee',
      150.46,
      'XAF'
    );
    expect(launchPromo.restorePromoOrder).not.toHaveBeenCalled();
  });

  it('still credits the service fee when the promo is not consumed', async () => {
    const { service, launchPromo } = createService();
    launchPromo.consumePromoOrder.mockResolvedValue(false);
    const paySpy = mockItemSettle(service);

    await service.distributeItemCommissions({ ...order, service_fee: 75 });

    expect(paySpy).toHaveBeenCalledWith(
      expect.anything(),
      'hq-1',
      'rendasua',
      'service_fee',
      75,
      'XAF'
    );
  });

  it.each([0, undefined, 'nope', -5])(
    'does not move money for service fee %p',
    async (serviceFee) => {
      const { service, launchPromo } = createService();
      launchPromo.consumePromoOrder.mockResolvedValue(true);
      const paySpy = mockItemSettle(service);

      await service.distributeItemCommissions({
        ...order,
        service_fee: serviceFee,
      });

      expect(paySpy).not.toHaveBeenCalled();
      expect(launchPromo.restorePromoOrder).not.toHaveBeenCalled();
    }
  );

  it('defaults a missing service-fee currency to XAF', async () => {
    const { service, launchPromo } = createService();
    launchPromo.consumePromoOrder.mockResolvedValue(false);
    const paySpy = mockItemSettle(service);

    await service.distributeItemCommissions({
      ...order,
      currency: undefined,
      service_fee: 10,
    });

    expect(paySpy).toHaveBeenCalledWith(
      expect.anything(),
      'hq-1',
      'rendasua',
      'service_fee',
      10,
      'XAF'
    );
  });

  it('restores the promo when the service fee credit fails', async () => {
    const { service, launchPromo } = createService();
    launchPromo.consumePromoOrder.mockResolvedValue(true);
    const paySpy = mockItemSettle(service);
    paySpy.mockRejectedValue(new Error('ledger down'));

    await expect(
      service.distributeItemCommissions({ ...order, service_fee: 100 })
    ).rejects.toThrow('ledger down');
    expect(launchPromo.restorePromoOrder).toHaveBeenCalledWith('biz-1', 'order-1');
  });
});

describe('delivery commission config defaults', () => {
  function createService() {
    const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
    const service = new CommissionsService(
      {} as any,
      hasura as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { consumePromoOrder: jest.fn(), restorePromoOrder: jest.fn() } as any
    );
    return { service, hasura };
  }

  it('falls back to 80 when the delivery rate rows are missing', async () => {
    const { service, hasura } = createService();
    hasura.executeQuery.mockResolvedValue({ application_configurations: [] });

    await expect(service.getCommissionConfigs()).resolves.toMatchObject({
      unverifiedAgentBaseDeliveryCommission: 80,
      verifiedAgentBaseDeliveryCommission: 80,
      unverifiedAgentPerKmDeliveryCommission: 80,
      verifiedAgentPerKmDeliveryCommission: 80,
    });
  });

  it('keeps a stored rate and treats 0 or null as missing', async () => {
    const { service, hasura } = createService();
    hasura.executeQuery.mockResolvedValue({
      application_configurations: [
        { config_key: 'unverified_agent_base_delivery_commission', number_value: 60 },
        { config_key: 'verified_agent_base_delivery_commission', number_value: 0 },
        { config_key: 'unverified_agent_per_km_delivery_commission', number_value: null },
      ],
    });

    await expect(service.getCommissionConfigs()).resolves.toMatchObject({
      unverifiedAgentBaseDeliveryCommission: 60,
      verifiedAgentBaseDeliveryCommission: 80,
      unverifiedAgentPerKmDeliveryCommission: 80,
      verifiedAgentPerKmDeliveryCommission: 80,
    });
  });
});

function mockItemSettle(service: CommissionsService) {
  jest.spyOn(service, 'calculateCommissions').mockResolvedValue({
    baseDeliveryFee: { agent: 0, partner: 0, rendasua: 0 },
    perKmDeliveryFee: { agent: 0, partner: 0, rendasua: 0 },
    itemCommission: { partner: 50, rendasua: 50 },
    orderSubtotal: { business: 1000, rendasua: 0 },
  } as any);
  jest.spyOn(service, 'getRendasuaHQUser').mockResolvedValue({ id: 'hq-1' });
  jest.spyOn(service, 'getActivePartners').mockResolvedValue([]);
  jest.spyOn(service as any, 'processItemCommissions').mockResolvedValue(undefined);
  jest.spyOn(service as any, 'processOrderSubtotalPayment').mockResolvedValue(undefined);
  return jest.spyOn(service as any, 'payCommission').mockResolvedValue(undefined);
}

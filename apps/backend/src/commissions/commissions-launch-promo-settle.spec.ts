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
      .spyOn(service, 'getRendasuaHQUser')
      .mockResolvedValue(null);

    await expect(service.distributeItemCommissions(order)).rejects.toThrow(
      'RendaSua HQ user not found'
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
      .spyOn(service, 'getRendasuaHQUser')
      .mockResolvedValue(null);

    await expect(service.distributeItemCommissions(order)).rejects.toThrow(
      'RendaSua HQ user not found'
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
});

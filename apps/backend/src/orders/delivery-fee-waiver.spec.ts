jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { OrdersService } from './orders.service';

type FeeInfo = {
  deliveryFee: number;
  method: 'distance_based';
  currency: string;
  country: string;
  baseDeliveryFee: number;
  perKmDeliveryFee: number;
  isFirstOrderClient: boolean;
  firstOrderDeliveryFeePromo: boolean;
  firstOrderBaseDeliveryDiscountAmount: number;
  baseDeliveryFeeBeforeDiscount: number;
  distance?: number;
};

function feeInfo(overrides: Partial<FeeInfo> = {}): FeeInfo {
  return {
    deliveryFee: 800,
    method: 'distance_based',
    currency: 'XAF',
    country: 'CM',
    baseDeliveryFee: 400,
    perKmDeliveryFee: 300,
    isFirstOrderClient: true,
    firstOrderDeliveryFeePromo: true,
    firstOrderBaseDeliveryDiscountAmount: 100,
    baseDeliveryFeeBeforeDiscount: 500,
    distance: 4,
    ...overrides,
  };
}

function createHarness(accountType: string | null = 'ELITE') {
  const executeQuery = jest.fn().mockResolvedValue({
    businesses_by_pk: accountType ? { account_type: accountType } : null,
  });
  const deliveryConfigService = {
    getFreeDeliveryCommissionThreshold: jest.fn().mockResolvedValue(10000),
    getNormalDeliveryBaseFee: jest.fn().mockResolvedValue(500),
    getFastDeliveryBaseFee: jest.fn().mockResolvedValue(1500),
    getPerKmDeliveryFee: jest.fn().mockResolvedValue(100),
    getMaxPerKmDeliveryFee: jest.fn().mockResolvedValue(1500),
    getMaxDeliveryFee: jest.fn().mockResolvedValue(1000),
  };
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, {
    hasuraSystemService: { executeQuery },
    deliveryConfigService,
    logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
  });
  return { service, executeQuery, deliveryConfigService };
}

describe('applyDeliveryWaiver', () => {
  it('leaves the fee in place when distance or country is missing', async () => {
    const { service, deliveryConfigService } = createHarness();
    const result = await service.applyDeliveryWaiver(
      feeInfo({ distance: undefined, country: '' }),
      'biz-1',
      80000
    );

    expect(result.deliveryFeeWaived).toBe(false);
    expect(result.deliveryFee).toBe(800);
    expect(result.firstOrderDeliveryFeePromo).toBe(true);
    expect(deliveryConfigService.getMaxDeliveryFee).not.toHaveBeenCalled();
  });

  it('charges 0 inside the range when the store plan meets the threshold', async () => {
    const { service, executeQuery, deliveryConfigService } = createHarness('ELITE');
    const result = await service.applyDeliveryWaiver(
      feeInfo({ country: 'Gabon' }),
      'biz-1',
      80000
    );

    expect(deliveryConfigService.getMaxDeliveryFee).toHaveBeenCalledWith('GA');
    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('BusinessAccountType'),
      { id: 'biz-1' }
    );
    expect(result).toMatchObject({
      deliveryFee: 0,
      deliveryFeeBeforeWaiver: 800,
      baseDeliveryFee: 500,
      firstOrderDeliveryFeePromo: false,
      firstOrderBaseDeliveryDiscountAmount: 0,
      deliveryFeeWaived: true,
    });
  });

  it('keeps the fee when a lower plan misses the threshold', async () => {
    const { service } = createHarness('STANDARD');
    const result = await service.applyDeliveryWaiver(feeInfo(), 'biz-1', 80000);

    expect(result.deliveryFeeWaived).toBe(false);
    expect(result.deliveryFee).toBe(800);
    expect(result.firstOrderDeliveryFeePromo).toBe(true);
  });

  it('keeps the fee beyond the deduced distance even when commission is high', async () => {
    const { service } = createHarness('ELITE');
    const result = await service.applyDeliveryWaiver(
      feeInfo({ distance: 6 }),
      'biz-1',
      200000
    );

    expect(result.deliveryFeeWaived).toBe(false);
    expect(result.deliveryFee).toBe(800);
  });

  it('does not look up a business when the subtotal cannot earn commission', async () => {
    const { service, executeQuery } = createHarness();
    const missingBusiness = await service.applyDeliveryWaiver(feeInfo(), undefined, 80000);
    const zeroSubtotal = await service.applyDeliveryWaiver(feeInfo(), 'biz-1', 0);

    expect(missingBusiness.deliveryFeeWaived).toBe(false);
    expect(zeroSubtotal.deliveryFeeWaived).toBe(false);
    expect(executeQuery).not.toHaveBeenCalled();
  });
});

describe('calculateTieredDeliveryFee', () => {
  it('trims the per-km slice to the country total cap', async () => {
    const { service, deliveryConfigService } = createHarness();
    const fee = await (service as any).calculateTieredDeliveryFee(8, 'Cameroon', false);

    expect(deliveryConfigService.getNormalDeliveryBaseFee).toHaveBeenCalledWith('CM');
    expect(deliveryConfigService.getFastDeliveryBaseFee).not.toHaveBeenCalled();
    expect(fee).toEqual({ baseFee: 500, perKmFee: 500, totalFee: 1000 });
  });

  it('uses the fast base and still will not exceed the total cap', async () => {
    const { service } = createHarness();
    const fee = await (service as any).calculateTieredDeliveryFee(8, 'CM', true);

    expect(fee).toEqual({ baseFee: 1000, perKmFee: 0, totalFee: 1000 });
  });

  it('uses the hardcoded fallback when country config lookup fails', async () => {
    const { service, deliveryConfigService } = createHarness();
    deliveryConfigService.getNormalDeliveryBaseFee.mockRejectedValueOnce(
      new Error('hasura down')
    );

    const fee = await (service as any).calculateTieredDeliveryFee(20, 'CM', false);

    expect(fee).toEqual({ baseFee: 1000, perKmFee: 1500, totalFee: 2500 });
  });
});

describe('quoteDeliveryFeeForCheckout', () => {
  it('returns the order fee then applies the waiver for the seller group', async () => {
    const { service } = createHarness();
    const info = feeInfo();
    const waived = { ...info, deliveryFee: 0, deliveryFeeWaived: true };
    const calc = jest
      .spyOn(service, 'calculateItemDeliveryFee')
      .mockResolvedValue(info as never);
    const waiver = jest
      .spyOn(service, 'applyDeliveryWaiver')
      .mockResolvedValue(waived as never);

    const result = await service.quoteDeliveryFeeForCheckout({
      businessInventoryId: 'inv-1',
      addressId: 'addr-1',
      requiresFastDelivery: true,
      businessId: 'biz-1',
      subtotal: 5000,
    });

    expect(calc).toHaveBeenCalledWith('inv-1', 'addr-1', true);
    expect(waiver).toHaveBeenCalledWith(info, 'biz-1', 5000);
    expect(result).toBe(waived);
  });
});

describe('Canada tiered delivery fee (base 2, fast base 8, 1 per km, max per-km 15, no total cap)', () => {
  function canadaService() {
    const { service, deliveryConfigService } = createHarness();
    deliveryConfigService.getNormalDeliveryBaseFee.mockResolvedValue(2);
    deliveryConfigService.getFastDeliveryBaseFee.mockResolvedValue(8);
    deliveryConfigService.getPerKmDeliveryFee.mockResolvedValue(1);
    deliveryConfigService.getMaxPerKmDeliveryFee.mockResolvedValue(15);
    deliveryConfigService.getMaxDeliveryFee.mockResolvedValue(0);
    return service as unknown as {
      calculateTieredDeliveryFee(
        km: number,
        country: string,
        fast: boolean
      ): Promise<{ baseFee: number; perKmFee: number; totalFee: number }>;
    };
  }

  it.each([
    [3, false, 5],
    [8, true, 16],
    [15, false, 17],
    [40, false, 17],
    [40, true, 23],
  ])('%i km fast=%s costs %i CAD', async (km, fast, total) => {
    const result = await canadaService().calculateTieredDeliveryFee(km, 'CA', fast);
    expect(result.totalFee).toBe(total);
  });
});

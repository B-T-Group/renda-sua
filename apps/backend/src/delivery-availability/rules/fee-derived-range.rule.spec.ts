import { DeliveryConfigService } from '../../delivery-configs/delivery-configs.service';
import {
  DeliveryAvailabilityContext,
  DeliveryUnavailableReason,
} from '../delivery-availability.types';
import { FeeDerivedRangeRule } from './fee-derived-range.rule';

describe('FeeDerivedRangeRule', () => {
  const deliveryConfigService = {
    getNormalDeliveryBaseFee: jest.fn().mockResolvedValue(500),
    getPerKmDeliveryFee: jest.fn().mockResolvedValue(100),
    getMaxDeliveryFee: jest.fn().mockResolvedValue(1000),
  } as unknown as jest.Mocked<DeliveryConfigService>;

  const rule = new FeeDerivedRangeRule(deliveryConfigService);

  const ctx: DeliveryAvailabilityContext = {
    businessId: 'business-1',
    sellerCountry: 'CM',
    sellerState: 'Littoral',
    pickupLat: 0,
    pickupLon: 0,
    deliveryLat: 0,
    deliveryLon: 0,
    evaluatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('passes when coordinates are missing', async () => {
    await expect(rule.evaluate({ ...ctx, deliveryLat: null })).resolves.toEqual({
      pass: true,
    });
  });

  it('fails when the client is farther than the fee-derived distance', async () => {
    const outcome = await rule.evaluate({
      ...ctx,
      deliveryLat: 0.1,
      deliveryLon: 0,
    });

    expect(outcome.pass).toBe(false);
    if (!outcome.pass) {
      expect(outcome.reason).toBe(DeliveryUnavailableReason.DELIVERY_RADIUS_EXCEEDED);
    }
  });

  it('passes inside the deduced 5 km', async () => {
    const outcome = await rule.evaluate({
      ...ctx,
      deliveryLat: 0.02,
      deliveryLon: 0,
    });
    expect(outcome).toEqual({ pass: true });
  });

  it('does not limit distance when the cap is unset', async () => {
    deliveryConfigService.getMaxDeliveryFee.mockResolvedValueOnce(0);
    const outcome = await rule.evaluate({
      ...ctx,
      deliveryLat: 1,
      deliveryLon: 0,
    });
    expect(outcome).toEqual({ pass: true });
  });
});

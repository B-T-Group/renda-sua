import { DeliveryAvailabilityService } from './delivery-availability.service';
import {
  DeliveryAvailabilityContext,
  DeliveryAvailabilityRule,
  DeliveryUnavailableReason,
} from './delivery-availability.types';

describe('DeliveryAvailabilityService', () => {
  const ctx: DeliveryAvailabilityContext = {
    businessId: 'business-1',
    sellerCountry: 'CM',
    sellerState: 'Littoral',
    pickupLat: 4,
    pickupLon: 9,
    evaluatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  function rule(
    id: string,
    order: number,
    evaluate: DeliveryAvailabilityRule['evaluate']
  ): DeliveryAvailabilityRule {
    return { id, order, evaluate };
  }

  it('returns available when all rules pass and keeps the first estimate', async () => {
    const service = new DeliveryAvailabilityService([
      rule('second', 200, async () => ({
        pass: true,
        estimatedDeliveryMinutes: 40,
      })),
      rule('first', 100, async () => ({
        pass: true,
        estimatedDeliveryMinutes: 25,
      })),
    ]);

    const result = await service.evaluate(ctx);

    expect(result.available).toBe(true);
    expect(result.estimatedDeliveryMinutes).toBe(25);
    expect(result.reason).toBeNull();
    expect(result.ruleId).toBeNull();
  });

  it('short-circuits on the first failing rule in ascending order', async () => {
    const laterRule = jest.fn();
    const service = new DeliveryAvailabilityService([
      rule('later', 300, laterRule),
      rule('blocker', 100, async () => ({
        pass: false,
        reason: DeliveryUnavailableReason.NO_ELIGIBLE_AGENT,
        metadata: { radiusKm: 20 },
      })),
    ]);

    const result = await service.evaluate(ctx);

    expect(result.available).toBe(false);
    expect(result.reason).toBe(DeliveryUnavailableReason.NO_ELIGIBLE_AGENT);
    expect(result.ruleId).toBe('blocker');
    expect(result.metadata).toEqual({ radiusKm: 20 });
    expect(laterRule).not.toHaveBeenCalled();
  });

  it('accumulates analytics metadata from passing rules', async () => {
    const service = new DeliveryAvailabilityService([
      rule('area', 50, async () => ({
        pass: true,
        metadata: { countryCode: 'CM' },
      })),
      rule('agents', 100, async () => ({
        pass: true,
        metadata: { eligibleAgentCount: 3, radiusKm: 20 },
      })),
    ]);

    const result = await service.evaluate(ctx);

    expect(result.available).toBe(true);
    expect(result.metadata).toEqual({
      countryCode: 'CM',
      eligibleAgentCount: 3,
      radiusKm: 20,
    });
  });

  it('fails safe with EVALUATION_ERROR when a rule throws', async () => {
    const service = new DeliveryAvailabilityService([
      rule('boom', 100, async () => {
        throw new Error('hasura down');
      }),
    ]);

    const result = await service.evaluate(ctx);

    expect(result.available).toBe(false);
    expect(result.reason).toBe(DeliveryUnavailableReason.EVALUATION_ERROR);
  });

  it('is available when no rules are registered', async () => {
    const service = new DeliveryAvailabilityService(null);

    const result = await service.evaluate(ctx);

    expect(result.available).toBe(true);
  });
});

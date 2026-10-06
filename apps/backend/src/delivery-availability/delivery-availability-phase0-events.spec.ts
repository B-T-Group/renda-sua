import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryAvailabilityService } from './delivery-availability.service';
import { SiteEventsService } from '../site-events/site-events.service';
import {
  DELIVERY_AVAILABILITY_RULES,
  DeliveryAvailabilityContext,
  DeliveryAvailabilityRule,
  DeliveryUnavailableReason,
} from './delivery-availability.types';

describe('DeliveryAvailabilityService Phase 0 Events', () => {
  let service: DeliveryAvailabilityService;
  let siteEventsService: jest.Mocked<SiteEventsService>;

  const mockContext: DeliveryAvailabilityContext = {
    businessId: 'biz-123',
    businessLocationId: 'loc-123',
    sellerCountry: 'CM',
    sellerState: 'Littoral',
    clientId: 'client-456',
  };

  beforeEach(async () => {
    const mockSiteEventsService = {
      trackEvent: jest.fn().mockResolvedValue(undefined),
    };

    const mockRule: DeliveryAvailabilityRule = {
      id: 'test-rule',
      order: 1,
      evaluate: jest.fn().mockResolvedValue({
        pass: true,
        estimatedDeliveryMinutes: 30,
        metadata: { eligibleAgentCount: 5, radiusKm: 10 },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryAvailabilityService,
        { provide: SiteEventsService, useValue: mockSiteEventsService },
        { provide: DELIVERY_AVAILABILITY_RULES, useValue: [mockRule] },
      ],
    }).compile();

    service = module.get<DeliveryAvailabilityService>(
      DeliveryAvailabilityService
    );
    siteEventsService = module.get(SiteEventsService);
  });

  it('should emit checkout.delivery_availability on successful evaluation', async () => {
    const result = await service.evaluate(mockContext);

    expect(result.available).toBe(true);

    // Wait for async emission
    await new Promise((resolve) => setImmediate(resolve));

    expect(siteEventsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'checkout.delivery_availability',
        metadata: expect.objectContaining({
          businessId: 'biz-123',
          businessLocationId: 'loc-123',
          sellerCountry: 'CM',
          sellerState: 'Littoral',
          clientId: 'client-456',
          available: true,
          reason: null,
          ruleId: null,
          eligibleAgentCount: 5,
          radiusKm: 10,
          durationMs: expect.any(Number),
        }),
        subjectType: undefined,
        subjectId: undefined,
      }),
      expect.objectContaining({
        viewerType: 'server',
        viewerId: 'system',
      })
    );
  });

  it('should emit checkout.delivery_availability on failure', async () => {
    const failRule: DeliveryAvailabilityRule = {
      id: 'no-agents',
      order: 1,
      evaluate: jest.fn().mockResolvedValue({
        pass: false,
        reason: DeliveryUnavailableReason.NO_ELIGIBLE_AGENT,
        metadata: { eligibleAgentCount: 0 },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryAvailabilityService,
        { provide: SiteEventsService, useValue: siteEventsService },
        { provide: DELIVERY_AVAILABILITY_RULES, useValue: [failRule] },
      ],
    }).compile();

    const serviceWithFailRule = module.get<DeliveryAvailabilityService>(
      DeliveryAvailabilityService
    );

    const result = await serviceWithFailRule.evaluate(mockContext);

    expect(result.available).toBe(false);
    expect(result.reason).toBe(DeliveryUnavailableReason.NO_ELIGIBLE_AGENT);

    await new Promise((resolve) => setImmediate(resolve));

    expect(siteEventsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'checkout.delivery_availability',
        metadata: expect.objectContaining({
          available: false,
          reason: DeliveryUnavailableReason.NO_ELIGIBLE_AGENT,
          ruleId: 'no-agents',
        }),
      }),
      expect.any(Object)
    );
  });

  it('should allow repeated evaluations without dedupe', async () => {
    await service.evaluate(mockContext);
    await service.evaluate(mockContext);

    await new Promise((resolve) => setImmediate(resolve));

    expect(siteEventsService.trackEvent).toHaveBeenCalledTimes(2);
  });

  it('should not fail if SiteEventsService is unavailable', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryAvailabilityService,
        { provide: DELIVERY_AVAILABILITY_RULES, useValue: [] },
        { provide: SiteEventsService, useValue: { trackEvent: jest.fn() } },
      ],
    }).compile();

    const serviceWithoutEvents =
      module.get<DeliveryAvailabilityService>(DeliveryAvailabilityService);

    const result = await serviceWithoutEvents.evaluate(mockContext);

    expect(result.available).toBe(true);
  });
});

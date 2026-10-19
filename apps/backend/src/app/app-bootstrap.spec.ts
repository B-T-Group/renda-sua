import { webcrypto } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { InventoryItemsService } from '../inventory-items/inventory-items.service';
import { PaymentCallbackRegistryService } from '../mobile-payments/payment-callback/payment-callback-registry.service';
import { OrdersService } from '../orders/orders.service';
import { RentalsService } from '../rentals/rentals.service';
import { DedicatedAgentsConfigService } from '../dedicated-agents/dedicated-agents-config.service';
import { DedicatedCheckoutCoverageService } from '../dedicated-agents/dedicated-checkout-coverage.service';
import { DedicatedCoverageService } from '../dedicated-agents/dedicated-coverage.service';
import { DedicatedDispatchService } from '../orders/dedicated-dispatch.service';
import { DedicatedSlotReminderService } from '../orders/dedicated-slot-reminder.service';
import { OrderDispatchInternalController } from '../orders/order-dispatch-internal.controller';
import { OrderReassignmentService } from '../orders/order-reassignment.service';
import { OrderOffersService } from '../orders/order-offers.service';
import { AgentInRegionRule } from '../delivery-availability/rules/agent-in-region.rule';
import { CheckoutPreflightService } from '../orders/checkout-preflight.service';
import { AppModule } from './app.module';

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  configurable: true,
});

process.env.TWILIO_ACCOUNT_SID ||= 'test_sid';
process.env.TWILIO_ACCOUNT_TOKEN ||= 'test_token';
process.env.TWILIO_VERIFY_SERVICE_SID ||= 'test_verify_sid';
// QA #593 R3: MyPVitService fails boot without both operation account codes (S3); set them
// here so the smoke test does not depend on apps/backend/.env being loaded.
process.env.MYPVIT_AIRTEL_MERCHANT_OPERATION_ACCOUNT_CODE ||= 'ACC_BOOT_AIRTEL';
process.env.MYPVIT_MOOV_MERCHANT_OPERATION_ACCOUNT_CODE ||= 'ACC_BOOT_MOOV';
// Keep Redis-backed services on their in-memory fallback so the smoke test
// neither needs a local Redis nor hangs in app.close() retrying a dead socket.
process.env.REDIS_HOST = '';
process.env.SESSION_ENCRYPTION_KEY ||= 'test-session-encryption-key-32bytes';
process.env.COMMERCE_TOKEN_ENCRYPTION_KEY ||=
  'test-commerce-token-encryption-key-32b';

const hasuraSystemMock = {
  request: jest.fn().mockResolvedValue({}),
  executeQuery: jest.fn().mockResolvedValue({ rental_location_listings: [] }),
};

const hasuraUserMock = {
  getActivePersonaHeader: jest.fn(),
  sessionPersonaContext: jest.fn().mockReturnValue({}),
  executeQuery: jest.fn().mockResolvedValue({}),
  getUser: jest.fn(),
  getUserId: jest.fn().mockReturnValue('anonymous'),
  resolveContext: jest.fn(),
  isConfigured: jest.fn().mockReturnValue(false),
};

describe('App bootstrap (DI smoke test)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HasuraSystemService)
      .useValue(hasuraSystemMock)
      .overrideProvider(HasuraUserService)
      .useValue(hasuraUserMock)
      .compile();

    app = moduleRef.createNestApplication();
    await moduleRef.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('resolves RentalsService and OrdersService', () => {
    expect(app.get(RentalsService)).toBeInstanceOf(RentalsService);
    expect(app.get(OrdersService)).toBeInstanceOf(OrdersService);
  });

  it('registers payment callback handlers from domain modules', () => {
    const registry = app.get(PaymentCallbackRegistryService);
    const handlers = registry.getHandlers();
    expect(handlers.length).toBeGreaterThanOrEqual(2);
  });

  it('OrdersService and RentalsService resolve as singletons without contextId', () => {
    const ordersA = app.get(OrdersService);
    const ordersB = app.get(OrdersService);
    expect(ordersA).toBe(ordersB);
    expect(app.get(RentalsService)).toBe(app.get(RentalsService));
  });

  it('listPublicRentalListings uses injected InventoryItemsService without DI errors', async () => {
    const rentals = app.get(RentalsService);
    const inventory = app.get(InventoryItemsService);
    jest.spyOn(inventory, 'isCatalogLocationSupported').mockResolvedValue(true);

    await expect(rentals.listPublicRentalListings({})).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    expect(hasuraSystemMock.executeQuery).toHaveBeenCalled();
  });

  it('#594: checkout, order create and the agent-in-region rule get the dedicated coverage services', () => {
    // These are @Optional() injections, so a missing module import would fail silently.
    const rule = app.get(AgentInRegionRule) as unknown as { dedicatedCoverage?: unknown };
    expect(rule.dedicatedCoverage).toBeInstanceOf(DedicatedCoverageService);
    const preflight = app.get(CheckoutPreflightService) as unknown as { dedicatedCheckoutCoverage?: unknown };
    expect(preflight.dedicatedCheckoutCoverage).toBeInstanceOf(DedicatedCheckoutCoverageService);
    const orders = app.get(OrdersService) as unknown as { dedicatedAgentsConfig?: unknown };
    expect(orders.dedicatedAgentsConfig).toBeInstanceOf(DedicatedAgentsConfigService);
  });

  it('#594 PR 5: the dispatch gate gets the dedicated fallback, which resolves the claim core', () => {
    const offers = app.get(OrderOffersService) as unknown as { dedicatedDispatch?: unknown };
    expect(offers.dedicatedDispatch).toBeInstanceOf(DedicatedDispatchService);
    const claimer = (offers.dedicatedDispatch as unknown as { claimer: () => unknown }).claimer();
    expect(claimer).toBe(app.get(OrdersService));
  });

  it('#594 PR 6: release and slot reminder wiring (all @Optional())', () => {
    const reassignment = app.get(OrderReassignmentService) as unknown as { dedicatedConfig?: unknown };
    expect(reassignment.dedicatedConfig).toBeInstanceOf(DedicatedAgentsConfigService);
    const orders = app.get(OrdersService) as unknown as { dedicatedSlotReminder?: unknown };
    expect(orders.dedicatedSlotReminder).toBeInstanceOf(DedicatedSlotReminderService);
    const internal = app.get(OrderDispatchInternalController) as unknown as { slotReminderService?: unknown };
    expect(internal.slotReminderService).toBe(orders.dedicatedSlotReminder);
  });
});

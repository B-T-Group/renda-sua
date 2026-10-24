/**
 * Unit tests for CheckoutPreflightService
 *
 * These tests verify that:
 *  - EMAIL verification is returned for Stripe seller groups
 *  - PHONE verification is returned for Mobile Money seller groups
 *  - Seller/business-owner rail is the authoritative checkout method
 *    (not buyer /stripe-connect/status)
 *  - Item country vs guest country mismatch is blocked
 *  - Delivery country mismatch is blocked
 *  - Mixed-country carts are blocked
 *  - Missing payment capabilities are blocked
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MobilePaymentsService } from '../mobile-payments/mobile-payments.service';
import { MobilePaymentPhonesService } from '../mobile-payment-phones/mobile-payment-phones.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { DeliveryAvailabilityService } from '../delivery-availability/delivery-availability.service';
import { MetaConversionsService } from '../meta-conversions/meta-conversions.service';
import { CheckoutPreflightService } from './checkout-preflight.service';
import { DedicatedCheckoutCoverageService } from '../dedicated-agents/dedicated-checkout-coverage.service';
import { VariantInventoryService } from '../item-variants/variant-inventory.service';
import { DepositCalculationService } from './deposit-calculation.service';
import { FxEstimateService } from '../diaspora/fx-estimate.service';
import { FulfillmentPromiseService } from './fulfillment-promise.service';
import { StripeTaxCheckoutBuilderService } from '../stripe-tax/stripe-tax-checkout-builder.service';
import {
  CheckoutMethod,
  CheckoutPreflightDto,
  VerificationMethod,
} from './dto/checkout-preflight.dto';
import {
  FOOD_ITEM_CLOSED_CODE,
  FOOD_ITEM_SOLD_OUT_CODE,
} from '../food/food-order-guard.util';
import { FOOD_CATEGORY_NAME } from '../food/food.constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInventoryRow(overrides: {
  id?: string;
  businessId?: string;
  ownerUserId?: string;
  sellerCountry?: string;
  businessName?: string;
  currency?: string;
  payOnDelivery?: boolean;
  payAtPickup?: boolean;
  initialDepositEnabled?: boolean;
  initialDepositPercent?: number | null;
  shippingEnabled?: boolean;
  shippingPrice?: number | null;
  available?: number;
  price?: number;
  itemName?: string;
  canAcceptOrders?: boolean;
  phoneVerified?: boolean;
  exportAvailable?: boolean;
  moderationStatus?: string;
} = {}) {
  const sellerCountry = overrides.sellerCountry ?? 'CM';
  const isStripeCountry = sellerCountry === 'CA';
  const phoneVerified =
    overrides.phoneVerified ?? !isStripeCountry;

  return {
    id: overrides.id ?? 'inv-1',
    selling_price: overrides.price ?? 1000,
    computed_available_quantity: overrides.available ?? 10,
    is_active: true,
    business_location: {
      business_id: overrides.businessId ?? 'biz-1',
      is_active: true,
      business: {
        id: overrides.businessId ?? 'biz-1',
        name: overrides.businessName ?? 'Test Business',
        can_accept_orders: overrides.canAcceptOrders ?? true,
        user: { id: overrides.ownerUserId ?? 'owner-1' },
      },
      address: { country: sellerCountry },
      mobile_payment_phone: isStripeCountry
        ? null
        : { is_verified: phoneVerified },
    },
    item: {
      id: 'item-1',
      name: overrides.itemName ?? 'Test Item',
      currency: overrides.currency ?? 'XAF',
      weight: 0,
      max_order_quantity: null as number | null,
      export_available: overrides.exportAvailable ?? false,
      moderation_status: overrides.moderationStatus ?? 'approved',
      pay_on_delivery_enabled: overrides.payOnDelivery ?? false,
      pay_at_pickup_enabled: overrides.payAtPickup ?? false,
      initial_deposit_enabled: overrides.initialDepositEnabled ?? false,
      initial_deposit_percent: overrides.initialDepositPercent ?? null,
      shipping_enabled: overrides.shippingEnabled ?? false,
      shipping_price: overrides.shippingPrice ?? null,
      item_variants: [] as Array<{
        id: string;
        name?: string;
        price?: number;
        quantity?: number;
      }>,
    },
  };
}

const MONDAY_LUNCH = {
  day_of_week: 1,
  start_time: '12:30:00',
  end_time: '16:00:00',
};

function makeFoodInventoryRow(overrides: {
  id?: string;
  itemName?: string;
  available?: number;
  markedUnavailableAt?: string | null;
  slots?: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
} = {}) {
  const row = makeInventoryRow({
    id: overrides.id,
    itemName: overrides.itemName ?? 'Pizza',
    available: overrides.available,
  });
  return {
    ...row,
    food_settings: [
      {
        marked_unavailable_at: overrides.markedUnavailableAt ?? null,
        availability_slots: overrides.slots ?? [MONDAY_LUNCH],
      },
    ],
    item: {
      ...row.item,
      is_cooked_food: true,
      item_sub_category: { item_category: { name: FOOD_CATEGORY_NAME } },
    },
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CheckoutPreflightService', () => {
  let service: CheckoutPreflightService;
  let serviceFee: { resolve: jest.Mock };
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let hasuraUserService: jest.Mocked<HasuraUserService>;
  let paymentRoutingService: jest.Mocked<PaymentRoutingService>;
  let mobilePaymentsService: jest.Mocked<MobilePaymentsService>;
  let loyaltyService: jest.Mocked<LoyaltyService>;
  let deliveryAvailabilityService: jest.Mocked<DeliveryAvailabilityService>;
  let fxEstimateService: jest.Mocked<FxEstimateService>;
  let dedicatedCoverage: { isEnabled: jest.Mock; coveredSlots: jest.Mock };

  beforeEach(async () => {
    // #594: flag off by default, so every other test sees today's response.
    dedicatedCoverage = {
      isEnabled: jest.fn().mockResolvedValue(false),
      coveredSlots: jest.fn().mockResolvedValue([]),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutPreflightService,
        { provide: DedicatedCheckoutCoverageService, useValue: dedicatedCoverage },
        {
          provide: HasuraSystemService,
          useValue: {
            executeQuery: jest.fn(),
            getAccount: jest.fn().mockResolvedValue({ available_balance: 0 }),
          },
        },
        {
          provide: HasuraUserService,
          useValue: {
            isConfigured: jest.fn().mockReturnValue(false),
            getUser: jest.fn(),
          },
        },
        {
          provide: PaymentRoutingService,
          useValue: {
            resolveRailForUser: jest.fn().mockResolvedValue('mobile_money'),
            resolveRailForCountry: jest.fn().mockResolvedValue('mobile_money'),
            getUserCountryCode: jest.fn().mockResolvedValue(null),
            resolveTrustedPayerCountry: jest.fn(
              async ({
                profileCountry,
                requestedCountry,
              }: {
                profileCountry?: string | null;
                requestedCountry?: string | null;
              }) => requestedCountry || profileCountry || null
            ),
            resolveOrderRail: jest.fn(
              async ({ sellerCountry }: { sellerCountry?: string | null }) => {
                const rail =
                  await paymentRoutingService.resolveRailForCountry(
                    sellerCountry ?? undefined
                  );
                return { rail, source: 'seller', isDiaspora: false };
              }
            ),
          },
        },
        {
          provide: MobilePaymentsService,
          useValue: {
            getProvider: jest.fn().mockReturnValue('freemopay'),
            getProviderForCountry: jest.fn((country?: string) =>
              String(country || '').toUpperCase() === 'CM' ? 'freemopay' : 'mypvit'
            ),
          },
        },
        {
          provide: MobilePaymentPhonesService,
          useValue: {
            resolveCheckoutPaymentPhone: jest.fn().mockResolvedValue({
              phoneE164: null,
              phoneId: null,
              source: 'none',
            }),
          },
        },
        {
          provide: LoyaltyService,
          useValue: {
            validateDiscountCode: jest.fn().mockResolvedValue({ valid: false }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'stripe') {
                return { manualCaptureEnabled: false };
              }
              if (key === 'merchantLifecycle') {
                return { checkoutGateEnabled: true };
              }
              return undefined;
            }),
          },
        },
        {
          provide: StripeTaxCheckoutBuilderService,
          useValue: {
            isTaxEnabledForCountry: jest.fn().mockReturnValue(false),
            normalizeCountryCode: jest.fn((c: string) => c),
          },
        },
        {
          provide: DeliveryAvailabilityService,
          useValue: {
            evaluate: jest.fn().mockResolvedValue({
              available: true,
              estimatedDeliveryMinutes: null,
              reason: null,
              ruleId: null,
            }),
          },
        },
        {
          provide: MetaConversionsService,
          useValue: {
            trackInitiateCheckoutSafe: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: FulfillmentPromiseService,
          useValue: {
            timezoneForCountry: jest.fn().mockResolvedValue('UTC'),
            evaluateAsap: jest.fn().mockReturnValue({
              available: true,
              estimatedPrepMinutes: 30,
              scheduleRequired: false,
              estimatedReadyAt: '2026-08-21T12:30:00.000Z',
              estimatedFulfillBy: '2026-08-21T13:00:00.000Z',
            }),
            closedStoreMessage: jest.fn().mockReturnValue('This store is closed.'),
          },
        },
        {
          provide: FxEstimateService,
          useValue: {
            estimate: jest.fn().mockReturnValue(null),
            payerCurrencyForCountry: jest.fn().mockReturnValue(null),
          },
        },
        DepositCalculationService,
        {
          provide: require('./service-fee.service').ServiceFeeService,
          useValue: { resolve: jest.fn().mockResolvedValue(0) },
        },
        {
          provide: VariantInventoryService,
          useValue: {
            retargetLines: jest.fn(
              async (
                lines: Array<{
                  business_inventory_id: string;
                  item_variant_id?: string | null;
                }>,
                inventoryById: Map<string, any>
              ) => {
                for (const line of lines) {
                  if (!line.item_variant_id) continue;
                  const parent = inventoryById.get(line.business_inventory_id);
                  if (!parent || parent.item_variant_id) continue;
                  const id = `${parent.id}:${line.item_variant_id}`;
                  inventoryById.set(id, { ...parent, id });
                  line.business_inventory_id = id;
                }
              }
            ),
          },
        },
      ],
    }).compile();

    service = module.get<CheckoutPreflightService>(CheckoutPreflightService);
    serviceFee = module.get(require('./service-fee.service').ServiceFeeService);
    hasuraSystemService = module.get(HasuraSystemService);
    hasuraUserService = module.get(HasuraUserService);
    paymentRoutingService = module.get(PaymentRoutingService);
    mobilePaymentsService = module.get(MobilePaymentsService);
    loyaltyService = module.get(LoyaltyService);
    deliveryAvailabilityService = module.get(DeliveryAvailabilityService);
    fxEstimateService = module.get(FxEstimateService);
  });

  function mockInventory(
    rows: ReturnType<typeof makeInventoryRow>[],
    options: { addressCountry?: string | null; stripeCountries?: string[] } = {}
  ) {
    (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
      (query: string) => {
        if (query.includes('GetInventoryForPreflight')) {
          return Promise.resolve({ business_inventory: rows });
        }
        if (query.includes('GetAddressCountry')) {
          return Promise.resolve({
            addresses_by_pk: options.addressCountry
              ? { country: options.addressCountry }
              : null,
          });
        }
        if (query.includes('StripeCountries')) {
          return Promise.resolve({
            supported_payment_systems: (options.stripeCountries ?? ['CA']).map(
              (country) => ({ country })
            ),
          });
        }
        if (query.includes('GetMarketFlag')) {
          // Default: momo_pay_now_delivery_enabled = true for all tests
          // Individual tests can override this by setting up their own mock
          return Promise.resolve({
            application_configurations: [{ boolean_value: true }],
          });
        }
        return Promise.resolve({});
      }
    );
  }

  it('returns ITEMS_REQUIRED without querying inventory when items is missing', async () => {
    const result = await service.resolve({} as CheckoutPreflightDto, false);

    expect(result.can_proceed).toBe(false);
    expect(result.blocking_errors).toEqual([
      {
        code: 'ITEMS_REQUIRED',
        message: 'Add at least one item to continue checkout.',
      },
    ]);
    expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 1. Returns EMAIL + STRIPE for Stripe seller/order groups
  // -------------------------------------------------------------------------
  it('returns EMAIL verification and STRIPE checkout method for Stripe seller groups', async () => {
    mockInventory([makeInventoryRow({ ownerUserId: 'owner-ca', sellerCountry: 'CA' })]);
    (paymentRoutingService.resolveRailForCountry as jest.Mock).mockResolvedValue('stripe');
    (paymentRoutingService.resolveRailForUser as jest.Mock).mockResolvedValue('stripe');

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      provisional_country: 'CA',
    };

    const result = await service.resolve(dto, false);

    expect(result.checkout_method).toBe(CheckoutMethod.STRIPE);
    expect(result.verification_method).toBe(VerificationMethod.EMAIL);
    expect(result.can_proceed).toBe(true);
    expect(result.blocking_errors).toHaveLength(0);
    expect(result.groups[0].payment_rail).toBe('stripe');
  });

  it('adds the service fee to the group total and keeps it out of the discount', async () => {
    serviceFee.resolve.mockResolvedValue(100);
    (loyaltyService.validateDiscountCode as jest.Mock).mockResolvedValue({
      valid: true,
      percentage: 10,
    });
    mockInventory([makeInventoryRow({ price: 1000, sellerCountry: 'CM' })]);

    const result = await service.resolve(
      {
        items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
        provisional_country: 'CM',
        discount_code: 'SAVE10',
      },
      true
    );

    expect(serviceFee.resolve).toHaveBeenCalledWith('CM', 'XAF');
    expect(result.groups[0].service_fee).toBe(100);
    expect(result.groups[0].subtotal).toBe(1000);
    expect(result.groups[0].total).toBe(1100);
    expect(result.discount).toMatchObject({ valid: true, discount_amount: 100 });
  });

  // -------------------------------------------------------------------------
  // 2. Returns PHONE + MOBILE_MONEY for Mobile Money seller groups
  // -------------------------------------------------------------------------
  it('returns PHONE verification and MOBILE_MONEY checkout method for MM seller groups', async () => {
    mockInventory([makeInventoryRow({ ownerUserId: 'owner-cm', sellerCountry: 'CM' })]);
    (paymentRoutingService.resolveRailForUser as jest.Mock).mockResolvedValue('mobile_money');

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      provisional_country: 'CM',
    };

    const result = await service.resolve(dto, false);

    expect(result.checkout_method).toBe(CheckoutMethod.MOBILE_MONEY);
    expect(result.verification_method).toBe(VerificationMethod.PHONE);
    expect(result.can_proceed).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 3. Uses SELLER rail (not buyer rail) as authoritative checkout method
  // -------------------------------------------------------------------------
  it('uses seller/business-owner rail as the authoritative checkout method, not buyer rail', async () => {
    // Seller is in a Stripe country
    mockInventory([makeInventoryRow({ ownerUserId: 'owner-ca', sellerCountry: 'CA' })]);
    (paymentRoutingService.resolveRailForCountry as jest.Mock).mockResolvedValue('stripe');
    (paymentRoutingService.resolveRailForUser as jest.Mock)
      .mockImplementation((userId: string) => {
        if (userId === 'owner-ca') return Promise.resolve('stripe');
        // Buyer rail would be mobile_money (if this were checked)
        return Promise.resolve('mobile_money');
      });

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      provisional_country: 'CA',
    };

    const result = await service.resolve(dto, false);

    // Seller is Stripe ? checkout is Stripe, regardless of buyer rail
    expect(result.checkout_method).toBe(CheckoutMethod.STRIPE);
    expect(result.verification_method).toBe(VerificationMethod.EMAIL);
  });

  // -------------------------------------------------------------------------
  // 4. Blocks item country vs guest country mismatch
  // -------------------------------------------------------------------------
  it('blocks checkout when guest shopping country does not match seller country', async () => {
    mockInventory([makeInventoryRow({ sellerCountry: 'CM' })]);

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      provisional_country: 'CA', // guest is in Canada, item is in Cameroon
    };

    const result = await service.resolve(dto, false);

    expect(result.can_proceed).toBe(false);
    const blocker = result.blocking_errors.find(
      (e) => e.code === 'UNSUPPORTED_COUNTRY_COMBINATION'
    );
    expect(blocker).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 5. Blocks delivery country mismatch
  // -------------------------------------------------------------------------
  it('blocks checkout when delivery address country does not match seller country', async () => {
    mockInventory([makeInventoryRow({ sellerCountry: 'CM' })], {
      addressCountry: 'CA',
    });

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      delivery_address_id: 'addr-canada',
    };

    const result = await service.resolve(dto, false);

    expect(result.can_proceed).toBe(false);
    const blocker = result.blocking_errors.find(
      (e) => e.code === 'DELIVERY_COUNTRY_MISMATCH'
    );
    expect(blocker).toBeDefined();
  });

  it('allows delivery when the address uses the seller country name', async () => {
    mockInventory([makeInventoryRow({ sellerCountry: 'CM' })], {
      addressCountry: 'Cameroon',
    });

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      delivery_address_id: 'addr-douala',
      provisional_country: 'CM',
    };

    const result = await service.resolve(dto, false);

    expect(
      result.blocking_errors.some((e) => e.code === 'DELIVERY_COUNTRY_MISMATCH')
    ).toBe(false);
  });

  it('allows delivery when the address uses the French Cameroon name', async () => {
    mockInventory([makeInventoryRow({ sellerCountry: 'CM' })], {
      addressCountry: 'Cameroun',
    });

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      delivery_address_id: 'addr-douala',
      provisional_country: 'CM',
    };

    const result = await service.resolve(dto, false);

    expect(
      result.blocking_errors.some((e) => e.code === 'DELIVERY_COUNTRY_MISMATCH')
    ).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 6. Blocks mixed-country carts
  // -------------------------------------------------------------------------
  it('blocks checkout for mixed-country carts', async () => {
    const row1 = makeInventoryRow({ id: 'inv-1', businessId: 'biz-1', sellerCountry: 'CM', ownerUserId: 'owner-1' });
    const row2 = makeInventoryRow({ id: 'inv-2', businessId: 'biz-2', sellerCountry: 'CA', ownerUserId: 'owner-2' });
    mockInventory([row1, row2]);

    const dto: CheckoutPreflightDto = {
      items: [
        { business_inventory_id: 'inv-1', quantity: 1 },
        { business_inventory_id: 'inv-2', quantity: 1 },
      ],
    };

    const result = await service.resolve(dto, false);

    expect(result.can_proceed).toBe(false);
    const blocker = result.blocking_errors.find((e) => e.code === 'MIXED_COUNTRY_CART');
    expect(blocker).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 7. Missing payment capability (inventory not found)
  // -------------------------------------------------------------------------
  it('blocks checkout when inventory items are not found', async () => {
    (hasuraSystemService.executeQuery as jest.Mock).mockResolvedValue({
      business_inventory: [],
    });

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'non-existent', quantity: 1 }],
    };

    const result = await service.resolve(dto, false);

    expect(result.can_proceed).toBe(false);
    const blocker = result.blocking_errors.find(
      (e) => e.code === 'INVENTORY_NOT_FOUND'
    );
    expect(blocker).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 8. Returns can_proceed = false on inventory fetch failure
  // -------------------------------------------------------------------------
  it('returns can_proceed false when inventory fetch throws', async () => {
    (hasuraSystemService.executeQuery as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
    };

    const result = await service.resolve(dto, false);

    expect(result.success).toBe(true);
    expect(result.can_proceed).toBe(false);
    expect(result.blocking_errors[0]?.code).toBe('INVENTORY_FETCH_FAILED');
  });

  it('blocks pay_at_delivery for Stripe-rail sellers', async () => {
    const row = makeInventoryRow({
      sellerCountry: 'CA',
      ownerUserId: 'owner-ca',
      payOnDelivery: true,
    });
    mockInventory([row]);
    (paymentRoutingService.resolveRailForCountry as jest.Mock).mockResolvedValue('stripe');
    (paymentRoutingService.resolveRailForUser as jest.Mock).mockResolvedValue('stripe');

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      provisional_country: 'CA',
      payment_timing: 'pay_at_delivery',
    };

    const result = await service.resolve(dto, false);

    expect(result.can_proceed).toBe(false);
    const blocker = result.blocking_errors.find(
      (e) => e.code === 'PAY_AT_DELIVERY_STRIPE_NOT_SUPPORTED'
    );
    expect(blocker).toBeDefined();
  });

  it('blocks pay_at_pickup for Stripe-rail sellers', async () => {
    const row = makeInventoryRow({
      sellerCountry: 'CA',
      ownerUserId: 'owner-ca',
      payAtPickup: true,
    });
    mockInventory([row]);
    (paymentRoutingService.resolveRailForCountry as jest.Mock).mockResolvedValue('stripe');
    (paymentRoutingService.resolveRailForUser as jest.Mock).mockResolvedValue('stripe');

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      fulfillment_method: 'pickup',
      provisional_country: 'CA',
      payment_timing: 'pay_at_pickup',
    };

    const result = await service.resolve(dto, false);

    expect(result.can_proceed).toBe(false);
    const blocker = result.blocking_errors.find(
      (e) => e.code === 'PAY_AT_PICKUP_STRIPE_NOT_SUPPORTED'
    );
    expect(blocker).toBeDefined();
  });

  it('allows store pickup with pay_now for Stripe-rail sellers', async () => {
    mockInventory([
      makeInventoryRow({
        sellerCountry: 'CA',
        ownerUserId: 'owner-ca',
        payAtPickup: true,
      }),
    ]);
    (paymentRoutingService.resolveRailForCountry as jest.Mock).mockResolvedValue('stripe');
    (paymentRoutingService.resolveRailForUser as jest.Mock).mockResolvedValue('stripe');

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      fulfillment_method: 'pickup',
      provisional_country: 'CA',
      payment_timing: 'pay_now',
    };

    const result = await service.resolve(dto, false);

    expect(result.can_proceed).toBe(true);
    expect(result.checkout_method).toBe(CheckoutMethod.STRIPE);
    expect(result.groups[0]?.allowed_payment_timings).toEqual(['pay_now']);
  });

  // -------------------------------------------------------------------------
  // Cart delivery availability (Phase 3): multi-merchant cart with one
  // seller group forced unavailable.
  // -------------------------------------------------------------------------
  it('reports per-group and aggregated delivery availability when one seller cannot deliver', async () => {
    const row1 = makeInventoryRow({
      id: 'inv-1',
      businessId: 'biz-available',
      ownerUserId: 'owner-1',
      payAtPickup: true,
    });
    const row2 = makeInventoryRow({
      id: 'inv-2',
      businessId: 'biz-unavailable',
      ownerUserId: 'owner-2',
      payAtPickup: true,
    });
    mockInventory([row1, row2]);

    (deliveryAvailabilityService.evaluate as jest.Mock).mockImplementation(
      (ctx: { businessId: string }) =>
        Promise.resolve(
          ctx.businessId === 'biz-unavailable'
            ? {
                available: false,
                estimatedDeliveryMinutes: null,
                reason: 'NO_ELIGIBLE_AGENT',
                ruleId: 'agent-in-region',
              }
            : {
                available: true,
                estimatedDeliveryMinutes: 45,
                reason: null,
                ruleId: null,
              }
        )
    );

    const dto: CheckoutPreflightDto = {
      items: [
        { business_inventory_id: 'inv-1', quantity: 1 },
        { business_inventory_id: 'inv-2', quantity: 1 },
      ],
      fulfillment_method: 'delivery',
      provisional_country: 'CM',
    };

    const result = await service.resolve(dto, false);

    const availableGroup = result.groups.find(
      (g) => g.business_id === 'biz-available'
    );
    const unavailableGroup = result.groups.find(
      (g) => g.business_id === 'biz-unavailable'
    );
    expect(availableGroup?.delivery_availability?.available).toBe(true);
    expect(
      availableGroup?.delivery_availability?.estimated_delivery_minutes
    ).toBe(45);
    expect(unavailableGroup?.delivery_availability?.available).toBe(false);
    // Reason codes must never leak to clients (reason-blind product rule).
    expect(unavailableGroup?.delivery_availability).not.toHaveProperty(
      'reason'
    );
    expect(availableGroup?.pickup_eligible).toBe(true);
    expect(unavailableGroup?.pickup_eligible).toBe(true);
    expect(result.delivery_availability?.available).toBe(false);
  });

  // -------------------------------------------------------------------------
  // #594 PR 4: dedicated coverage fields (flag on per seller country)
  // -------------------------------------------------------------------------
  describe('#594 dedicated covered slots', () => {
    const NO_AGENT = {
      available: false,
      estimatedDeliveryMinutes: null,
      reason: 'NO_ELIGIBLE_AGENT',
      ruleId: 'agent-in-region',
    };
    const AVAILABLE = { available: true, estimatedDeliveryMinutes: 40, reason: null, ruleId: null };
    const slotEntry = (date: string, key: string, id = `slot-${key}`) => ({
      date,
      slot_id: id,
      slot_key: key,
      start: key === 'afternoon' ? '12:00' : '16:00',
      end: key === 'afternoon' ? '16:00' : '20:00',
      pickup_time: key === 'afternoon' ? '12:30' : '16:30',
    });

    function locatedRow(over: Parameters<typeof makeInventoryRow>[0] & { locationId?: string } = {}) {
      const row = makeInventoryRow({ payAtPickup: true, price: 2500, ...over });
      return {
        ...row,
        business_location: {
          ...row.business_location,
          id: over.locationId ?? 'loc-1',
          address: { country: over.sellerCountry ?? 'CM', state: ' Littoral ' },
        },
      };
    }

    const deliveryDto = (items: Array<[string, number]>): CheckoutPreflightDto => ({
      items: items.map(([id, quantity]) => ({ business_inventory_id: id, quantity })),
      fulfillment_method: 'delivery',
      provisional_country: 'CM',
    });

    function availability(byBusiness: Record<string, unknown>) {
      (deliveryAvailabilityService.evaluate as jest.Mock).mockImplementation(
        (ctx: { businessId: string }) => Promise.resolve(byBusiness[ctx.businessId] ?? AVAILABLE)
      );
    }

    it('no nearby agent + a dedicated agent covers Afternoon -> ASAP unavailable, covered slots listed', async () => {
      mockInventory([locatedRow()]);
      availability({ 'biz-1': NO_AGENT });
      dedicatedCoverage.isEnabled.mockResolvedValue(true);
      dedicatedCoverage.coveredSlots.mockResolvedValue([slotEntry('2026-10-19', 'afternoon')]);

      const result = await service.resolve(deliveryDto([['inv-1', 2]]), false);

      expect(result.groups[0]?.delivery_availability).toEqual({
        available: false,
        estimated_delivery_minutes: null,
        delivery_asap_available: false,
        dedicated_covered_slots: [slotEntry('2026-10-19', 'afternoon')],
      });
      expect(dedicatedCoverage.isEnabled).toHaveBeenCalledWith('CM');
      expect(dedicatedCoverage.coveredSlots).toHaveBeenCalledWith({
        locationId: 'loc-1',
        country: 'CM',
        state: 'Littoral',
        rail: 'mobile_money',
        subtotal: 5000,
        currency: 'XAF',
        verifiedAgentDelivery: false,
      });
      expect(result.delivery_availability).toEqual({
        available: false,
        estimated_delivery_minutes: null,
        delivery_asap_available: false,
        dedicated_covered_slots: [slotEntry('2026-10-19', 'afternoon')],
      });
      // Store-hours ASAP flag is a different thing and stays as it was.
      expect(result.asap_available).toBe(true);
    });

    it('passes the Stripe rail and verified_agent_delivery through', async () => {
      paymentRoutingService.resolveRailForCountry.mockResolvedValue('stripe');
      mockInventory([locatedRow({ sellerCountry: 'CA', currency: 'CAD' })], { stripeCountries: ['CA'] });
      availability({ 'biz-1': NO_AGENT });
      dedicatedCoverage.isEnabled.mockResolvedValue(true);

      await service.resolve(
        { ...deliveryDto([['inv-1', 1]]), provisional_country: 'CA', verified_agent_delivery: true },
        false
      );

      expect(dedicatedCoverage.coveredSlots).toHaveBeenCalledWith(
        expect.objectContaining({ rail: 'stripe', currency: 'CAD', country: 'CA', verifiedAgentDelivery: true })
      );
    });

    it('flag off -> exactly the previous delivery_availability shape, no coverage lookup', async () => {
      mockInventory([locatedRow()]);
      availability({ 'biz-1': NO_AGENT });

      const result = await service.resolve(deliveryDto([['inv-1', 1]]), false);

      expect(result.groups[0]?.delivery_availability).toEqual({
        available: false,
        estimated_delivery_minutes: null,
      });
      expect(result.delivery_availability).toEqual({
        available: false,
        estimated_delivery_minutes: null,
      });
      expect(dedicatedCoverage.coveredSlots).not.toHaveBeenCalled();
    });

    it('flag on and an agent nearby -> delivery_asap_available true, no covered-slot lookup', async () => {
      mockInventory([locatedRow()]);
      availability({ 'biz-1': AVAILABLE });
      dedicatedCoverage.isEnabled.mockResolvedValue(true);

      const result = await service.resolve(deliveryDto([['inv-1', 1]]), false);

      expect(result.groups[0]?.delivery_availability).toEqual({
        available: true,
        estimated_delivery_minutes: 40,
        delivery_asap_available: true,
        dedicated_covered_slots: [],
      });
      expect(result.delivery_availability?.dedicated_covered_slots).toEqual([]);
      expect(dedicatedCoverage.coveredSlots).not.toHaveBeenCalled();
    });

    it('blocked for another reason (service area off) -> no covered slots', async () => {
      mockInventory([locatedRow()]);
      availability({
        'biz-1': { available: false, estimatedDeliveryMinutes: null, reason: 'SERVICE_AREA_DISABLED', ruleId: 'service-area-enabled' },
      });
      dedicatedCoverage.isEnabled.mockResolvedValue(true);

      const result = await service.resolve(deliveryDto([['inv-1', 1]]), false);

      expect(result.groups[0]?.delivery_availability?.dedicated_covered_slots).toEqual([]);
      expect(dedicatedCoverage.coveredSlots).not.toHaveBeenCalled();
    });

    it('cooked-food group (ASAP only) -> no covered slots', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-08-24T13:00:00.000Z'));
      try {
        const food = makeFoodInventoryRow();
        mockInventory([
          { ...food, business_location: { ...food.business_location, id: 'loc-1', address: { country: 'CM', state: 'Littoral' } } },
        ]);
        availability({ 'biz-1': NO_AGENT });
        dedicatedCoverage.isEnabled.mockResolvedValue(true);

        const result = await service.resolve(deliveryDto([['inv-1', 1]]), false);

        expect(result.groups[0]?.schedule_allowed).toBe(false);
        expect(result.groups[0]?.delivery_availability?.dedicated_covered_slots).toEqual([]);
        expect(dedicatedCoverage.coveredSlots).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    describe('multi-seller cart', () => {
      const rowA = () => locatedRow({ id: 'inv-a', businessId: 'biz-a', ownerUserId: 'o-a', locationId: 'loc-a' });
      const rowB = () => locatedRow({ id: 'inv-b', businessId: 'biz-b', ownerUserId: 'o-b', locationId: 'loc-b' });
      const cart = () => deliveryDto([['inv-a', 1], ['inv-b', 1]]);

      beforeEach(() => {
        dedicatedCoverage.isEnabled.mockResolvedValue(true);
      });

      it('a slot only one of two uncovered groups has is absent from the cart list', async () => {
        mockInventory([rowA(), rowB()]);
        availability({ 'biz-a': NO_AGENT, 'biz-b': NO_AGENT });
        dedicatedCoverage.coveredSlots.mockImplementation(async ({ locationId }: { locationId: string }) =>
          locationId === 'loc-a'
            ? [slotEntry('2026-10-19', 'afternoon'), slotEntry('2026-10-19', 'evening')]
            : [slotEntry('2026-10-19', 'afternoon', 'other-state-afternoon')]
        );

        const result = await service.resolve(cart(), false);

        expect(result.delivery_availability?.dedicated_covered_slots).toEqual([slotEntry('2026-10-19', 'afternoon')]);
        expect(result.delivery_availability?.delivery_asap_available).toBe(false);
      });

      it('one group with no coverage at all -> no cart slot', async () => {
        mockInventory([rowA(), rowB()]);
        availability({ 'biz-a': NO_AGENT, 'biz-b': NO_AGENT });
        dedicatedCoverage.coveredSlots.mockImplementation(async ({ locationId }: { locationId: string }) =>
          locationId === 'loc-a' ? [slotEntry('2026-10-19', 'afternoon')] : []
        );

        const result = await service.resolve(cart(), false);

        const groupB = result.groups.find((g) => g.business_id === 'biz-b');
        expect(groupB?.delivery_availability?.dedicated_covered_slots).toEqual([]);
        expect(result.delivery_availability?.dedicated_covered_slots).toEqual([]);
      });

      it('a group that can deliver ASAP does not constrain the slot', async () => {
        mockInventory([rowA(), rowB()]);
        availability({ 'biz-a': AVAILABLE, 'biz-b': NO_AGENT });
        dedicatedCoverage.coveredSlots.mockResolvedValue([slotEntry('2026-10-20', 'evening')]);

        const result = await service.resolve(cart(), false);

        expect(result.delivery_availability).toMatchObject({
          available: false,
          delivery_asap_available: false,
          dedicated_covered_slots: [slotEntry('2026-10-20', 'evening')],
        });
        expect(dedicatedCoverage.coveredSlots).toHaveBeenCalledTimes(1);
      });

      it('a group in a flag-off country has no answer -> no cart slot', async () => {
        dedicatedCoverage.isEnabled.mockImplementation(async () => false);
        dedicatedCoverage.isEnabled.mockResolvedValueOnce(true);
        mockInventory([rowA(), rowB()]);
        availability({ 'biz-a': NO_AGENT, 'biz-b': NO_AGENT });
        dedicatedCoverage.coveredSlots.mockResolvedValue([slotEntry('2026-10-19', 'afternoon')]);

        const result = await service.resolve(cart(), false);

        expect(result.groups.filter((g) => g.delivery_availability?.dedicated_covered_slots)).toHaveLength(1);
        expect(result.delivery_availability?.dedicated_covered_slots).toEqual([]);
      });
    });
  });

  it('evaluates delivery availability for pickup carts so the option can be decided first', async () => {
    mockInventory([makeInventoryRow({ payAtPickup: true })]);

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      fulfillment_method: 'pickup',
      provisional_country: 'CM',
      payment_timing: 'pay_at_pickup',
    };

    const result = await service.resolve(dto, false);

    expect(deliveryAvailabilityService.evaluate).toHaveBeenCalled();
    expect(result.delivery_availability?.available).toBe(true);
    expect(result.groups[0]?.delivery_availability?.available).toBe(true);
    expect(result.groups[0]?.pickup_eligible).toBe(true);
  });

  it('marks groups shipping_eligible when every item supports carrier shipping', async () => {
    mockInventory([
      makeInventoryRow({
        id: 'inv-ship',
        shippingEnabled: true,
        shippingPrice: 1500,
      }),
    ]);

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-ship', quantity: 1 }],
      fulfillment_method: 'delivery',
      provisional_country: 'CM',
    };

    const result = await service.resolve(dto, false);

    expect(result.groups[0]?.shipping_eligible).toBe(true);
  });

  it('is not shipping_eligible when any item lacks shipping_enabled', async () => {
    mockInventory([
      makeInventoryRow({ id: 'inv-1', shippingEnabled: true, shippingPrice: 500 }),
      makeInventoryRow({ id: 'inv-2', shippingEnabled: false }),
    ]);

    const dto: CheckoutPreflightDto = {
      items: [
        { business_inventory_id: 'inv-1', quantity: 1 },
        { business_inventory_id: 'inv-2', quantity: 1 },
      ],
      fulfillment_method: 'delivery',
      provisional_country: 'CM',
    };

    const result = await service.resolve(dto, false);

    expect(result.groups[0]?.shipping_eligible).toBe(false);
  });

  it('is not shipping_eligible when an enabled item has no shipping_price', async () => {
    mockInventory([
      makeInventoryRow({ shippingEnabled: true, shippingPrice: null }),
    ]);

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      fulfillment_method: 'delivery',
      provisional_country: 'CM',
    };

    const result = await service.resolve(dto, false);

    expect(result.groups[0]?.shipping_eligible).toBe(false);
  });

  it('requires a delivery address for carrier shipping payment', async () => {
    mockInventory([
      makeInventoryRow({ shippingEnabled: true, shippingPrice: 1500 }),
    ]);

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      fulfillment_method: 'shipping',
      provisional_country: 'CM',
    };

    const result = await service.resolve(dto, false);

    expect(result.requires_address_for_payment).toBe(true);
  });

  it('blocks shipping when the ship-to country does not match the seller', async () => {
    mockInventory([
      makeInventoryRow({
        sellerCountry: 'CM',
        shippingEnabled: true,
        shippingPrice: 1500,
      }),
    ], { addressCountry: 'CA' });

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      fulfillment_method: 'shipping',
      delivery_address_id: 'addr-canada',
    };

    const result = await service.resolve(dto, false);

    expect(result.can_proceed).toBe(false);
    expect(
      result.blocking_errors.some((e) => e.code === 'DELIVERY_COUNTRY_MISMATCH')
    ).toBe(true);
  });

  it('blocks checkout when merchant cannot accept orders', async () => {
    mockInventory([makeInventoryRow({ canAcceptOrders: false })]);

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      provisional_country: 'CM',
    };

    const result = await service.resolve(dto, false);

    expect(result.can_proceed).toBe(false);
    expect(
      result.blocking_errors.some(
        (e) => e.code === 'MERCHANT_NOT_ACCEPTING_ORDERS'
      )
    ).toBe(true);
  });

  describe('food serving and sold-out blockers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('blocks a cooked dish outside its serving window', async () => {
      jest.setSystemTime(new Date('2026-08-24T08:00:00.000Z'));
      mockInventory([makeFoodInventoryRow()]);

      const result = await service.resolve(
        { items: [{ business_inventory_id: 'inv-1', quantity: 1 }] },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(result.blocking_errors[0]?.code).toBe(FOOD_ITEM_CLOSED_CODE);
    });

    it('blocks a cooked dish marked sold out for the day', async () => {
      mockInventory([
        makeFoodInventoryRow({
          markedUnavailableAt: '2026-08-24T11:00:00.000Z',
        }),
      ]);

      const result = await service.resolve(
        { items: [{ business_inventory_id: 'inv-1', quantity: 1 }] },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(result.blocking_errors[0]?.code).toBe(FOOD_ITEM_SOLD_OUT_CODE);
    });

    it('does not attach food blockers to electronics', async () => {
      mockInventory([
        makeInventoryRow({
          itemName: 'Phone charger',
        }),
      ]);

      const result = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          provisional_country: 'CM',
        },
        false
      );

      expect(
        result.blocking_errors.some(
          (error) =>
            error.code === FOOD_ITEM_CLOSED_CODE ||
            error.code === FOOD_ITEM_SOLD_OUT_CODE
        )
      ).toBe(false);
      expect(result.can_proceed).toBe(true);
    });

    it('blocks a mixed cart when only the food line is closed', async () => {
      jest.setSystemTime(new Date('2026-08-24T08:00:00.000Z'));
      mockInventory([
        makeFoodInventoryRow({ id: 'inv-food' }),
        makeInventoryRow({ id: 'inv-retail', itemName: 'Phone charger' }),
      ]);

      const result = await service.resolve(
        {
          items: [
            { business_inventory_id: 'inv-food', quantity: 1 },
            { business_inventory_id: 'inv-retail', quantity: 1 },
          ],
        },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(result.blocking_errors.map((error) => error.code)).toEqual([
        FOOD_ITEM_CLOSED_CODE,
      ]);
    });

    it('does not block cooked food when the request exceeds the quantity sentinel', async () => {
      mockInventory([makeFoodInventoryRow({ available: 1 })]);

      const result = await service.resolve(
        { items: [{ business_inventory_id: 'inv-1', quantity: 5 }] },
        false
      );

      expect(
        result.blocking_errors.some((error) => error.code === 'INSUFFICIENT_STOCK')
      ).toBe(false);
      expect(result.can_proceed).toBe(true);
    });

    it('still enforces the merchant maximum on cooked food', async () => {
      const food = makeFoodInventoryRow({ available: 1 });
      food.item = { ...food.item, max_order_quantity: 3 };
      mockInventory([food]);

      const result = await service.resolve(
        { items: [{ business_inventory_id: 'inv-1', quantity: 5 }] },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(result.blocking_errors.map((error) => error.code)).toEqual([
        'MAX_ORDER_QUANTITY_EXCEEDED',
      ]);
    });

    it('still blocks retail lines that exceed available stock', async () => {
      mockInventory([
        makeFoodInventoryRow({ id: 'inv-food', available: 1 }),
        makeInventoryRow({
          id: 'inv-retail',
          itemName: 'Phone charger',
          available: 1,
        }),
      ]);

      const result = await service.resolve(
        {
          items: [
            { business_inventory_id: 'inv-food', quantity: 8 },
            { business_inventory_id: 'inv-retail', quantity: 2 },
          ],
        },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(result.blocking_errors.map((error) => error.code)).toEqual([
        'INSUFFICIENT_STOCK',
      ]);
      expect(result.blocking_errors[0]?.message).toContain('Phone charger');
    });

    it('counts a pack of 10 as ten base units against shared stock', async () => {
      const row = makeInventoryRow({ available: 5, itemName: 'Water' });
      row.item = {
        ...row.item,
        item_variants: [{ id: 'pack', name: 'Pack of 10', price: 8000, quantity: 10 }],
      };
      mockInventory([row]);

      const result = await service.resolve(
        {
          items: [
            {
              business_inventory_id: 'inv-1',
              quantity: 1,
              item_variant_id: 'pack',
            },
          ],
        },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(result.blocking_errors.map((error) => error.code)).toEqual([
        'INSUFFICIENT_STOCK',
      ]);
      expect(result.blocking_errors[0]?.message).toContain('requested: 10');
    });

    it('checks a pack against its own stock, not the single option', async () => {
      const row = makeInventoryRow({ available: 12, itemName: 'Water' });
      row.item = {
        ...row.item,
        item_variants: [{ id: 'pack', name: 'Pack of 10', price: 8000, quantity: 10 }],
      };
      mockInventory([row]);

      const result = await service.resolve(
        {
          items: [
            {
              business_inventory_id: 'inv-1',
              quantity: 1,
              item_variant_id: 'pack',
            },
            { business_inventory_id: 'inv-1', quantity: 3 },
          ],
        },
        false
      );

      expect(result.can_proceed).toBe(true);
      expect(result.blocking_errors).toEqual([]);
    });

    it('blocks a pack that fits stock but exceeds the merchant maximum', async () => {
      const row = makeInventoryRow({ available: 20, itemName: 'Water' });
      row.item = {
        ...row.item,
        max_order_quantity: 8,
        item_variants: [{ id: 'pack', name: 'Pack of 10', price: 8000, quantity: 10 }],
      };
      mockInventory([row]);

      const result = await service.resolve(
        {
          items: [
            {
              business_inventory_id: 'inv-1',
              quantity: 1,
              item_variant_id: 'pack',
            },
          ],
        },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(result.blocking_errors.map((error) => error.code)).toEqual([
        'MAX_ORDER_QUANTITY_EXCEEDED',
      ]);
    });

    it('blocks singles plus a pack when together they exceed the maximum', async () => {
      const row = makeInventoryRow({ available: 30, itemName: 'Water' });
      row.item = {
        ...row.item,
        max_order_quantity: 12,
        item_variants: [{ id: 'pack', name: 'Pack of 10', price: 8000, quantity: 10 }],
      };
      mockInventory([row]);

      const result = await service.resolve(
        {
          items: [
            { business_inventory_id: 'inv-1', quantity: 8 },
            {
              business_inventory_id: 'inv-1',
              quantity: 1,
              item_variant_id: 'pack',
            },
          ],
        },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(result.blocking_errors.map((error) => error.code)).toContain(
        'MAX_ORDER_QUANTITY_EXCEEDED'
      );
    });

    it('includes kitchen hours when the store cannot take a cooked-food order', async () => {
      const row = makeFoodInventoryRow();
      (row.business_location as { operating_hours?: unknown }).operating_hours = {
        friday: { open: '10:00', close: '22:00' },
      };
      mockInventory([row]);
      const promise = (service as any).fulfillmentPromiseService;
      promise.timezoneForCountry.mockResolvedValue('Africa/Douala');
      promise.evaluateAsap.mockReturnValue({
        available: false,
        reason: 'closed',
        opensAt: '2026-08-25T10:30:00.000Z',
        estimatedPrepMinutes: 30,
        scheduleRequired: false,
      });

      const result = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          fulfillment_method: 'pickup',
        },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(result.groups[0]?.schedule_allowed).toBe(false);
      const closed = result.blocking_errors.find(
        (error) => error.code === 'COOKED_FOOD_STORE_CLOSED'
      );
      expect(closed?.message).toBe(
        'This kitchen is closed right now. Available: Mon 12:30–16:00. Next opening: Tuesday at 11:30.'
      );
    });

    it('falls back to store hours when a closed kitchen has no serving slots', async () => {
      const row = makeFoodInventoryRow({ slots: [] });
      (row.business_location as { operating_hours?: unknown }).operating_hours = {
        friday: { open: '10:00', close: '22:00' },
      };
      mockInventory([row]);
      const promise = (service as any).fulfillmentPromiseService;
      promise.timezoneForCountry.mockResolvedValue('Africa/Douala');
      promise.evaluateAsap.mockReturnValue({
        available: false,
        reason: 'closed',
        opensAt: '2026-08-25T10:30:00.000Z',
        estimatedPrepMinutes: 30,
        scheduleRequired: false,
      });

      const result = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          fulfillment_method: 'pickup',
        },
        false
      );

      const closed = result.blocking_errors.find(
        (error) => error.code === 'COOKED_FOOD_STORE_CLOSED'
      );
      expect(closed?.message).toBe(
        'This kitchen is closed right now. Available: Fri 10:00–22:00. Next opening: Tuesday at 11:30.'
      );
    });

    it('does not attach the kitchen-closed blocker to retail when the store is closed', async () => {
      mockInventory([makeInventoryRow({ itemName: 'Phone charger' })]);
      (service as any).fulfillmentPromiseService.evaluateAsap.mockReturnValue({
        available: false,
        reason: 'closed',
        opensAt: '2026-08-25T10:30:00.000Z',
        scheduleRequired: true,
      });

      const result = await service.resolve(
        { items: [{ business_inventory_id: 'inv-1', quantity: 1 }] },
        false
      );

      expect(
        result.blocking_errors.some(
          (error) => error.code === 'COOKED_FOOD_STORE_CLOSED'
        )
      ).toBe(false);
    });

    it('keeps an open cooked-food kitchen free of the closed-store blocker', async () => {
      mockInventory([makeFoodInventoryRow()]);

      const result = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          fulfillment_method: 'pickup',
        },
        false
      );

      expect(result.groups[0]?.schedule_allowed).toBe(false);
      expect(result.groups[0]?.asap_available).toBe(true);
      expect(
        result.blocking_errors.some(
          (error) => error.code === 'COOKED_FOOD_STORE_CLOSED'
        )
      ).toBe(false);
    });
  });

  describe('F-M7: moderation gate', () => {
    it.each(['draft', 'pending', 'rejected'])(
      'blocks checkout when the item moderation_status is %s',
      async (moderationStatus) => {
        mockInventory([makeInventoryRow({ itemName: 'Draft item', moderationStatus })]);

        const result = await service.resolve(
          { items: [{ business_inventory_id: 'inv-1', quantity: 1 }], provisional_country: 'CM' },
          false
        );

        expect(result.can_proceed).toBe(false);
        expect(result.blocking_errors.map((error) => error.code)).toContain('ITEM_UNAVAILABLE');
      }
    );

    it('selects item.moderation_status in the inventory query', async () => {
      mockInventory([makeInventoryRow()]);
      await service.resolve(
        { items: [{ business_inventory_id: 'inv-1', quantity: 1 }], provisional_country: 'CM' },
        false
      );
      const queries = (hasuraSystemService.executeQuery as jest.Mock).mock.calls.map((c) => String(c[0]));
      const preflightQuery = queries.find((q) => q.includes('GetInventoryForPreflight'));
      expect(preflightQuery).toContain('moderation_status');
    });
  });

  describe('export-available purchase blockers', () => {
    it('blocks checkout when a line is export_available', async () => {
      mockInventory([
        makeInventoryRow({
          itemName: 'Quote part',
          exportAvailable: true,
        }),
      ]);

      const result = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          provisional_country: 'CM',
        },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(result.blocking_errors.map((error) => error.code)).toEqual([
        'EXPORT_AVAILABLE_ITEM',
      ]);
    });

    it('blocks only the export line in a mixed cart', async () => {
      mockInventory([
        makeInventoryRow({
          id: 'inv-export',
          itemName: 'Quote part',
          exportAvailable: true,
        }),
        makeInventoryRow({
          id: 'inv-retail',
          itemName: 'Phone charger',
        }),
      ]);

      const result = await service.resolve(
        {
          items: [
            { business_inventory_id: 'inv-export', quantity: 1 },
            { business_inventory_id: 'inv-retail', quantity: 1 },
          ],
          provisional_country: 'CM',
        },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(result.blocking_errors.map((error) => error.code)).toEqual([
        'EXPORT_AVAILABLE_ITEM',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // Diaspora checkout: payer abroad, recipient local
  // -------------------------------------------------------------------------
  describe('diaspora checkout', () => {
    function mockDiasporaRail() {
      (paymentRoutingService.resolveOrderRail as jest.Mock).mockResolvedValue({
        rail: 'stripe',
        source: 'payer',
        isDiaspora: true,
      });
    }

    it('routes a CA payer buying from a Gabonese merchant onto Stripe', async () => {
      mockInventory([makeInventoryRow({ sellerCountry: 'GA' })], {
        addressCountry: 'GA',
      });
      mockDiasporaRail();
      (fxEstimateService.estimate as jest.Mock).mockReturnValue({
        currency: 'CAD',
        amount: 32.48,
        rate: 0.00224,
        source: 'indicative_config',
      });

      const result = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          delivery_address_id: 'addr-ga',
          payer_country: 'CA',
          sending_to_someone_else: true,
          recipient: { name: 'Awa Ndong', phone: '077123456' },
        },
        false
      );

      expect(result.can_proceed).toBe(true);
      expect(result.checkout_method).toBe(CheckoutMethod.STRIPE);
      expect(result.diaspora).toEqual(
        expect.objectContaining({
          is_diaspora: true,
          payer_country: 'CA',
          fulfillment_country: 'GA',
          rail_source: 'payer',
          requires_recipient_contact: true,
          payer_charge_estimate: expect.objectContaining({ currency: 'CAD' }),
        })
      );
    });

    it('requires a recipient address for diaspora delivery and not for pickup', async () => {
      mockInventory([makeInventoryRow({ sellerCountry: 'GA' })]);
      mockDiasporaRail();

      const delivery = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          payer_country: 'CA',
          fulfillment_method: 'delivery',
        },
        false
      );
      expect(
        delivery.blocking_errors.some(
          (error) => error.code === 'RECIPIENT_ADDRESS_REQUIRED'
        )
      ).toBe(true);

      const pickup = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          payer_country: 'CA',
          fulfillment_method: 'pickup',
          payment_timing: 'pay_now',
        },
        false
      );
      expect(
        pickup.blocking_errors.some(
          (error) => error.code === 'RECIPIENT_ADDRESS_REQUIRED'
        )
      ).toBe(false);
    });

    it('omits the diaspora block for a purely local order', async () => {
      mockInventory([makeInventoryRow({ sellerCountry: 'CM' })], {
        addressCountry: 'CM',
      });

      const result = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          delivery_address_id: 'addr-cm',
          payer_country: 'CM',
        },
        false
      );

      expect(result.diaspora).toBeNull();
    });

    it('blocks checkout when the recipient toggle has no contact details', async () => {
      mockInventory([makeInventoryRow({ sellerCountry: 'GA' })], {
        addressCountry: 'GA',
      });
      mockDiasporaRail();

      const result = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          delivery_address_id: 'addr-ga',
          payer_country: 'CA',
          sending_to_someone_else: true,
        },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(
        result.blocking_errors.some(
          (e) => e.code === 'RECIPIENT_CONTACT_REQUIRED'
        )
      ).toBe(true);
    });

    it('blocks a recipient phone that is invalid for the delivery country', async () => {
      mockInventory([makeInventoryRow({ sellerCountry: 'GA' })], {
        addressCountry: 'GA',
      });
      mockDiasporaRail();

      const result = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          delivery_address_id: 'addr-ga',
          payer_country: 'CA',
          sending_to_someone_else: true,
          recipient: { name: 'Awa Ndong', phone: '12' },
        },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(
        result.blocking_errors.some(
          (e) => e.code === 'RECIPIENT_PHONE_INVALID_FOR_COUNTRY'
        )
      ).toBe(true);
    });

    it('blocks pay at delivery for a payer abroad', async () => {
      mockInventory(
        [makeInventoryRow({ sellerCountry: 'GA', payOnDelivery: true })],
        { addressCountry: 'GA' }
      );
      mockDiasporaRail();

      const result = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          delivery_address_id: 'addr-ga',
          payer_country: 'CA',
          payment_timing: 'pay_at_delivery',
        },
        false
      );

      expect(result.can_proceed).toBe(false);
      expect(
        result.blocking_errors.some(
          (e) => e.code === 'DIASPORA_REQUIRES_PAY_NOW'
        )
      ).toBe(true);
    });

    it('ignores a spoofed local payer_country when the profile is abroad', async () => {
      mockInventory(
        [makeInventoryRow({ sellerCountry: 'GA', payOnDelivery: true })],
        { addressCountry: 'GA' }
      );
      hasuraUserService.getUser.mockResolvedValue({ id: 'user-ca' } as any);
      paymentRoutingService.getUserCountryCode.mockResolvedValue('CA');
      paymentRoutingService.resolveTrustedPayerCountry.mockResolvedValue('CA');
      mockDiasporaRail();

      const result = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          delivery_address_id: 'addr-ga',
          payer_country: 'GA',
          payment_timing: 'pay_at_delivery',
        },
        true
      );

      expect(paymentRoutingService.resolveTrustedPayerCountry).toHaveBeenCalledWith(
        {
          profileCountry: 'CA',
          requestedCountry: 'GA',
        }
      );
      expect(paymentRoutingService.resolveOrderRail).toHaveBeenCalledWith({
        sellerCountry: 'GA',
        payerCountry: 'CA',
      });
      expect(result.can_proceed).toBe(false);
      expect(
        result.blocking_errors.some(
          (e) => e.code === 'DIASPORA_REQUIRES_PAY_NOW'
        )
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // MoMo deposit quote on preflight
  // -------------------------------------------------------------------------
  describe('per-location pay_at_confirm (flagged non-cooked goods)', () => {
    function flaggedRow(flag: boolean) {
      const row = makeInventoryRow({
        id: 'inv-1',
        sellerCountry: 'CM',
        currency: 'XAF',
        price: 10000,
        payOnDelivery: false,
        payAtPickup: true,
        initialDepositEnabled: true,
        initialDepositPercent: 5,
      });
      (row.business_location as any).pay_at_confirm = flag;
      return row;
    }

    function mockFlags(flags: Record<string, boolean>, rows: any[]) {
      (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
        (query: string, vars: any) => {
          if (query.includes('GetInventoryForPreflight')) {
            return Promise.resolve({ business_inventory: rows });
          }
          if (query.includes('GetMarketFlag')) {
            return Promise.resolve({
              application_configurations: [
                { boolean_value: flags[vars.configKey] === true },
              ],
            });
          }
          if (query.includes('StripeCountries')) {
            return Promise.resolve({
              supported_payment_systems: [{ country: 'CA' }],
            });
          }
          return Promise.resolve({});
        }
      );
    }

    const KILL = 'pay_after_confirm_location_flag_enabled';
    const deliveryDto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      provisional_country: 'CM',
      payment_timing: 'pay_now',
    };

    it('kill switch ON + flagged location: pay-after eligible, ASAP only, no deposit, pay_now advertised where MoMo pay-now delivery is off', async () => {
      mockFlags({ [KILL]: true, momo_pay_now_delivery_enabled: false }, [
        flaggedRow(true),
      ]);
      const result = await service.resolve(deliveryDto, false);

      expect(result.can_proceed).toBe(true);
      const group = result.groups[0];
      expect(group.pay_after_merchant_confirm_eligible).toBe(true);
      // Flagged-location goods are not cooked food → clients use "store" wording.
      expect(group.all_cooked_food).toBe(false);
      expect(group.allowed_payment_timings).toContain('pay_now');
      expect(group.schedule_allowed).toBe(false);
      expect(group.schedule_required).toBe(false);
      expect(group.requires_payment_phone).toBe(true);
      expect(group.deposit_required).toBeUndefined();
      expect(result.pay_after_merchant_confirm_eligible).toBe(true);
      expect(result.schedule_allowed).toBe(false);
    });

    it('flagged ASAP pickup is pay-after with no deposit', async () => {
      mockFlags({ [KILL]: true }, [flaggedRow(true)]);
      const result = await service.resolve(
        { ...deliveryDto, fulfillment_method: 'pickup', payment_timing: 'pay_at_pickup' },
        false
      );
      expect(result.groups[0].pay_after_merchant_confirm_eligible).toBe(true);
      expect(result.groups[0].deposit_required).toBeUndefined();
    });

    it('reads the global kill switch without sending a null country filter (Hasura v2 rejects `_eq: null`)', async () => {
      mockFlags({ [KILL]: true, momo_pay_now_delivery_enabled: false }, [
        flaggedRow(true),
      ]);
      await service.resolve(deliveryDto, false);
      const killCall = (hasuraSystemService.executeQuery as jest.Mock).mock.calls.find(
        ([q, v]: [string, any]) =>
          q.includes('GetMarketFlag') && v?.configKey === KILL
      );
      expect(killCall).toBeDefined();
      expect(killCall[0]).not.toContain('$countryCode');
      expect(killCall[1]).not.toHaveProperty('countryCode');
    });

    it('kill switch OFF: the location column is ignored (today\'s behaviour)', async () => {
      mockFlags({ [KILL]: false, momo_pay_now_delivery_enabled: false }, [
        flaggedRow(true),
      ]);
      const result = await service.resolve(deliveryDto, false);
      const group = result.groups[0];
      expect(group.pay_after_merchant_confirm_eligible).toBe(false);
      expect(group.allowed_payment_timings).not.toContain('pay_now');
      expect(group.schedule_allowed).toBe(true);
    });

    it('unflagged location with kill switch ON is unchanged', async () => {
      mockFlags({ [KILL]: true, momo_pay_now_delivery_enabled: false }, [
        flaggedRow(false),
      ]);
      const result = await service.resolve(deliveryDto, false);
      expect(result.groups[0].pay_after_merchant_confirm_eligible).toBe(false);
      expect(result.groups[0].schedule_allowed).toBe(true);
    });

    it('Stripe-rail seller: the flag is a no-op', async () => {
      const row = makeInventoryRow({
        id: 'inv-1',
        sellerCountry: 'CA',
        currency: 'CAD',
      });
      (row.business_location as any).pay_at_confirm = true;
      mockFlags({ [KILL]: true }, [row]);
      (paymentRoutingService.resolveRailForCountry as jest.Mock).mockResolvedValue('stripe');
      (paymentRoutingService.resolveRailForUser as jest.Mock).mockResolvedValue('stripe');
      const result = await service.resolve(
        { ...deliveryDto, provisional_country: 'CA' },
        false
      );
      expect(result.groups[0].pay_after_merchant_confirm_eligible).toBe(false);
      expect(result.groups[0].schedule_allowed).toBe(true);
    });

    it('carrier shipping is never pay-after', async () => {
      const row = flaggedRow(true);
      (row.item as any).shipping_enabled = true;
      (row.item as any).shipping_price = 500;
      (row.item as any).shipping_currency = 'XAF';
      mockFlags({ [KILL]: true }, [row]);
      const result = await service.resolve(
        { ...deliveryDto, fulfillment_method: 'shipping' } as any,
        false
      );
      expect(result.groups[0].pay_after_merchant_confirm_eligible).toBe(false);
    });

    it('multi-location cart: any flagged location makes whole cart pay-after', async () => {
      const flaggedRow = makeInventoryRow({
        id: 'inv-flagged',
        locationId: 'loc-flagged',
        initialDepositEnabled: false,
      });
      (flaggedRow.business_location as any).pay_at_confirm = true;

      const unflaggedRow = makeInventoryRow({
        id: 'inv-unflagged',
        locationId: 'loc-unflagged',
        initialDepositEnabled: true,
        initialDepositPercent: 10,
      });
      (unflaggedRow.business_location as any).pay_at_confirm = false;

      mockFlags({ [KILL]: true }, [flaggedRow, unflaggedRow]);
      const result = await service.resolve(
        {
          items: [
            { business_inventory_id: 'inv-flagged', quantity: 1 },
            { business_inventory_id: 'inv-unflagged', quantity: 1 },
          ],
          provisional_country: 'CM',
          payment_timing: 'pay_now',
        },
        false
      );

      expect(result.can_proceed).toBe(true);
      expect(result.pay_after_merchant_confirm_eligible).toBe(true);
      const group = result.groups[0];
      expect(group.pay_after_merchant_confirm_eligible).toBe(true);
      expect(group.deposit_required).toBeUndefined();
      expect(group.schedule_allowed).toBe(false);
    });
  });

  describe('delivery is not offered when pay_at_pickup is the only payable method', () => {
    const NO_AGENT = {
      available: false,
      estimatedDeliveryMinutes: null,
      reason: 'NO_ELIGIBLE_AGENT',
      ruleId: 'agent-in-region',
    };
    const AVAILABLE = { available: true, estimatedDeliveryMinutes: 40, reason: null, ruleId: null };
    const COVERED = [
      {
        date: '2026-10-26',
        slot_id: 'slot-morning',
        slot_key: 'morning',
        start: '08:00',
        end: '12:00',
        pickup_time: '08:30',
      },
    ];
    const KILL = 'pay_after_confirm_location_flag_enabled';

    /** Blue-like row: pickup on, pay on delivery off. */
    function blueRow(over: Parameters<typeof makeInventoryRow>[0] = {}) {
      const row = makeInventoryRow({ payAtPickup: true, payOnDelivery: false, ...over });
      return {
        ...row,
        business_location: {
          ...row.business_location,
          id: `loc-${over.businessId ?? 'biz-1'}`,
          address: { country: over.sellerCountry ?? 'CM', state: 'Centre' },
        },
      };
    }

    function mockFlags(flags: Record<string, boolean>, rows: any[]) {
      (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
        (query: string, vars: any) => {
          if (query.includes('GetInventoryForPreflight')) {
            return Promise.resolve({ business_inventory: rows });
          }
          if (query.includes('GetMarketFlag')) {
            return Promise.resolve({
              application_configurations: [
                { boolean_value: flags[vars.configKey] === true },
              ],
            });
          }
          if (query.includes('StripeCountries')) {
            return Promise.resolve({ supported_payment_systems: [{ country: 'CA' }] });
          }
          return Promise.resolve({});
        }
      );
    }

    const deliveryDto = (
      items: Array<[string, number]> = [['inv-1', 1]]
    ): CheckoutPreflightDto => ({
      items: items.map(([id, quantity]) => ({ business_inventory_id: id, quantity })),
      fulfillment_method: 'delivery',
      provisional_country: 'CM',
    });

    function dedicatedOn() {
      dedicatedCoverage.isEnabled.mockResolvedValue(true);
      dedicatedCoverage.coveredSlots.mockResolvedValue(COVERED);
    }

    it('Blue case (MoMo pay-now delivery off, no pay on delivery): no ASAP, no covered slots, pickup still offered', async () => {
      mockFlags({ momo_pay_now_delivery_enabled: false }, [blueRow()]);
      (deliveryAvailabilityService.evaluate as jest.Mock).mockResolvedValue(NO_AGENT);
      dedicatedOn();

      const result = await service.resolve(deliveryDto(), false);

      const group = result.groups[0];
      expect(group.allowed_payment_timings).toEqual(['pay_at_pickup']);
      expect(group.pickup_eligible).toBe(true);
      expect(group.delivery_availability).toEqual({
        available: false,
        estimated_delivery_minutes: null,
        delivery_asap_available: false,
        dedicated_covered_slots: [],
      });
      expect(dedicatedCoverage.coveredSlots).not.toHaveBeenCalled();
      expect(result.delivery_availability).toEqual({
        available: false,
        estimated_delivery_minutes: null,
        delivery_asap_available: false,
        dedicated_covered_slots: [],
      });
    });

    it('also hides ASAP delivery when an agent is nearby (the shopper still cannot pay for it)', async () => {
      mockFlags({ momo_pay_now_delivery_enabled: false }, [blueRow()]);
      (deliveryAvailabilityService.evaluate as jest.Mock).mockResolvedValue(AVAILABLE);
      dedicatedOn();

      const result = await service.resolve(deliveryDto(), false);

      expect(result.groups[0].delivery_availability).toEqual({
        available: false,
        estimated_delivery_minutes: null,
        delivery_asap_available: false,
        dedicated_covered_slots: [],
      });
      expect(result.delivery_availability?.available).toBe(false);
    });

    it('dedicated agents off: plain unavailable shape without the #594 fields', async () => {
      mockFlags({ momo_pay_now_delivery_enabled: false }, [blueRow()]);
      (deliveryAvailabilityService.evaluate as jest.Mock).mockResolvedValue(AVAILABLE);

      const result = await service.resolve(deliveryDto(), false);

      expect(result.groups[0].delivery_availability).toEqual({
        available: false,
        estimated_delivery_minutes: null,
      });
      expect(dedicatedCoverage.coveredSlots).not.toHaveBeenCalled();
    });

    it('a pickup-first preflight (pay_at_pickup requested) hides delivery too', async () => {
      mockFlags({ momo_pay_now_delivery_enabled: false }, [blueRow()]);
      (deliveryAvailabilityService.evaluate as jest.Mock).mockResolvedValue(AVAILABLE);

      const result = await service.resolve(
        {
          ...deliveryDto(),
          fulfillment_method: 'pickup',
          payment_timing: 'pay_at_pickup',
        },
        false
      );

      expect(result.groups[0].pickup_eligible).toBe(true);
      expect(result.groups[0].delivery_availability?.available).toBe(false);
      expect(result.delivery_availability?.available).toBe(false);
    });

    it('MoMo pay-now delivery ON: unchanged, covered slots still listed', async () => {
      mockFlags({ momo_pay_now_delivery_enabled: true }, [blueRow()]);
      (deliveryAvailabilityService.evaluate as jest.Mock).mockResolvedValue(NO_AGENT);
      dedicatedOn();

      const result = await service.resolve(deliveryDto(), false);

      expect(result.groups[0].allowed_payment_timings).toEqual(['pay_now', 'pay_at_pickup']);
      expect(result.groups[0].delivery_availability).toEqual({
        available: false,
        estimated_delivery_minutes: null,
        delivery_asap_available: false,
        dedicated_covered_slots: COVERED,
      });
      expect(dedicatedCoverage.coveredSlots).toHaveBeenCalledTimes(1);
    });

    it('MoMo pay-now delivery ON and an agent nearby: ASAP delivery stays available', async () => {
      mockFlags({ momo_pay_now_delivery_enabled: true }, [blueRow()]);
      (deliveryAvailabilityService.evaluate as jest.Mock).mockResolvedValue(AVAILABLE);

      const result = await service.resolve(deliveryDto(), false);

      expect(result.groups[0].delivery_availability).toEqual({
        available: true,
        estimated_delivery_minutes: 40,
      });
    });

    it('shipping-requested preflight: a pay-after-confirm (flagged) location keeps delivery offered', async () => {
      const row = blueRow({ shippingEnabled: true, shippingPrice: 1000 });
      (row.business_location as any).pay_at_confirm = true;
      mockFlags({ [KILL]: true, momo_pay_now_delivery_enabled: false }, [row]);
      (deliveryAvailabilityService.evaluate as jest.Mock).mockResolvedValue(AVAILABLE);

      const result = await service.resolve(
        { ...deliveryDto(), fulfillment_method: 'shipping' } as any,
        false
      );

      expect(result.groups[0].delivery_availability).toEqual({
        available: true,
        estimated_delivery_minutes: 40,
      });
    });

    it('shipping-requested preflight: an unflagged location still hides delivery', async () => {
      const row = blueRow({ shippingEnabled: true, shippingPrice: 1000 });
      (row.business_location as any).pay_at_confirm = false;
      mockFlags({ [KILL]: true, momo_pay_now_delivery_enabled: false }, [row]);
      (deliveryAvailabilityService.evaluate as jest.Mock).mockResolvedValue(AVAILABLE);

      const result = await service.resolve(
        { ...deliveryDto(), fulfillment_method: 'shipping' } as any,
        false
      );

      expect(result.groups[0].delivery_availability?.available).toBe(false);
    });

    it('pay on delivery enabled on the item (flag off): delivery stays offered', async () => {
      mockFlags({ momo_pay_now_delivery_enabled: false }, [blueRow({ payOnDelivery: true })]);
      (deliveryAvailabilityService.evaluate as jest.Mock).mockResolvedValue(NO_AGENT);
      dedicatedOn();

      const result = await service.resolve(deliveryDto(), false);

      expect(result.groups[0].allowed_payment_timings).toEqual(['pay_at_delivery', 'pay_at_pickup']);
      expect(result.groups[0].delivery_availability?.dedicated_covered_slots).toEqual(COVERED);
    });

    it('flagged pay-at-confirm location (flag off): delivery stays offered', async () => {
      const row = blueRow();
      (row.business_location as any).pay_at_confirm = true;
      mockFlags({ momo_pay_now_delivery_enabled: false, [KILL]: true }, [row]);
      (deliveryAvailabilityService.evaluate as jest.Mock).mockResolvedValue(AVAILABLE);

      const result = await service.resolve(deliveryDto(), false);

      expect(result.groups[0].delivery_availability).toEqual({
        available: true,
        estimated_delivery_minutes: 40,
      });
    });

    it('card (Stripe) rail: unchanged', async () => {
      paymentRoutingService.resolveRailForCountry.mockResolvedValue('stripe');
      mockFlags({ momo_pay_now_delivery_enabled: false }, [
        blueRow({ sellerCountry: 'CA', currency: 'CAD', payAtPickup: false }),
      ]);
      (deliveryAvailabilityService.evaluate as jest.Mock).mockResolvedValue(AVAILABLE);

      const result = await service.resolve(
        { ...deliveryDto(), provisional_country: 'CA' },
        false
      );

      expect(result.groups[0].allowed_payment_timings).toEqual(['pay_now']);
      expect(result.groups[0].delivery_availability?.available).toBe(true);
    });

    it('cooked food keeps its own pay-after path and is never suppressed', async () => {
      // Monday 13:00 UTC: inside the kitchen's Monday lunch slot.
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-08-24T13:00:00.000Z'));
      try {
        const food = makeFoodInventoryRow();
        mockFlags({ momo_pay_now_delivery_enabled: false }, [food]);
        (deliveryAvailabilityService.evaluate as jest.Mock).mockResolvedValue(AVAILABLE);

        const result = await service.resolve(deliveryDto(), false);

        expect(result.groups[0].delivery_availability?.available).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });

    it('two sellers: one cannot be paid for delivery, so the cart has no delivery and no shared slots', async () => {
      const payable = blueRow({ businessId: 'biz-1', id: 'inv-1', payOnDelivery: true });
      const unpayable = blueRow({ businessId: 'biz-2', id: 'inv-2', payOnDelivery: false });
      mockFlags({ momo_pay_now_delivery_enabled: false }, [payable, unpayable]);
      (deliveryAvailabilityService.evaluate as jest.Mock).mockResolvedValue(NO_AGENT);
      dedicatedOn();

      const result = await service.resolve(
        deliveryDto([
          ['inv-1', 1],
          ['inv-2', 1],
        ]),
        false
      );

      const byBiz = Object.fromEntries(
        result.groups.map((g) => [g.business_id, g.delivery_availability])
      );
      expect(byBiz['biz-1']?.dedicated_covered_slots).toEqual(COVERED);
      expect(byBiz['biz-2']).toEqual({
        available: false,
        estimated_delivery_minutes: null,
        delivery_asap_available: false,
        dedicated_covered_slots: [],
      });
      expect(result.delivery_availability).toEqual({
        available: false,
        estimated_delivery_minutes: null,
        delivery_asap_available: false,
        dedicated_covered_slots: [],
      });
    });
  });

  describe('MoMo deposit quote', () => {
    beforeEach(() => {
      // Mock the market flag query for deposit tests
      (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
        (query: string) => {
          if (query.includes('GetInventoryForPreflight')) {
            return Promise.resolve({
              business_inventory: [
                makeInventoryRow({
                  id: 'inv-1',
                  sellerCountry: 'CM',
                  currency: 'XAF',
                  price: 10000,
                  payOnDelivery: true,
                  payAtPickup: true,
                  initialDepositEnabled: true,
                  initialDepositPercent: 5,
                }),
              ],
            });
          }
          if (query.includes('GetMarketFlag')) {
            return Promise.resolve({
              application_configurations: [{ boolean_value: true }],
            });
          }
          if (query.includes('StripeCountries')) {
            return Promise.resolve({
              supported_payment_systems: [{ country: 'CA' }],
            });
          }
          return Promise.resolve({});
        }
      );
    });

    it('calculates deposit for MoMo + XAF + pay_at_delivery', async () => {
      const dto: CheckoutPreflightDto = {
        items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
        provisional_country: 'CM',
        payment_timing: 'pay_at_delivery',
      };

      const result = await service.resolve(dto, false);

      expect(result.can_proceed).toBe(true);
      expect(result.groups[0]?.deposit_required).toBe(true);
      expect(result.groups[0]?.deposit_amount).toBe(500); // 5% of the 10000 item
      expect(result.groups[0]?.deposit_percent).toBe(5);
      expect(result.groups[0]?.deposit_minimum_applied).toBe(false);
      expect(result.groups[0]?.amount_due).toBe(9500);
      expect(result.deposit_required).toBe(true);
      expect(result.deposit_amount).toBe(500);
      expect(result.deposit_percent).toBe(5);
      expect(result.amount_due).toBe(9500);
    });

    it('calculates deposit for MoMo + XAF + pay_at_pickup', async () => {
      const dto: CheckoutPreflightDto = {
        items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
        provisional_country: 'CM',
        fulfillment_method: 'pickup',
        payment_timing: 'pay_at_pickup',
      };

      const result = await service.resolve(dto, false);

      expect(result.can_proceed).toBe(true);
      expect(result.groups[0]?.deposit_required).toBe(true);
      expect(result.groups[0]?.deposit_amount).toBe(500); // 5% of the 10000 item
      expect(result.groups[0]?.amount_due).toBe(9500);
    });

    it('skips deposit for cooked-food MoMo pickup (pay-after-confirm)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
      try {
        const row = makeFoodInventoryRow({ id: 'inv-1', itemName: 'Griot' });
        row.selling_price = 10000;
        row.item = {
          ...row.item,
          pay_at_pickup_enabled: true,
          is_cooked_food: true,
          currency: 'XAF',
        };
        mockInventory([row]);
        paymentRoutingService.resolveRailForUser.mockResolvedValue({
          rail: 'mobile_money',
          source: 'seller',
        } as any);

        const result = await service.resolve(
          {
            items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
            provisional_country: 'CM',
            fulfillment_method: 'pickup',
            payment_timing: 'pay_at_pickup',
          },
          false
        );

        expect(result.can_proceed).toBe(true);
        expect(result.groups[0]?.deposit_required).toBeUndefined();
        expect(result.groups[0]?.deposit_amount).toBeUndefined();
      } finally {
        jest.useRealTimers();
      }
    });

    it('does NOT calculate deposit for pay_now timing', async () => {
      const dto: CheckoutPreflightDto = {
        items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
        provisional_country: 'CM',
        payment_timing: 'pay_now',
      };

      const result = await service.resolve(dto, false);

      expect(result.can_proceed).toBe(true);
      expect(result.groups[0]?.deposit_required).toBeUndefined();
      expect(result.groups[0]?.deposit_amount).toBeUndefined();
    });

    it('does not charge a deposit when the item has not opted in', async () => {
      (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
        (query: string) => {
          if (query.includes('GetInventoryForPreflight')) {
            return Promise.resolve({
              business_inventory: [
                makeInventoryRow({
                  id: 'inv-1',
                  sellerCountry: 'CM',
                  currency: 'XAF',
                  price: 10000,
                  payOnDelivery: true,
                }),
              ],
            });
          }
          if (query.includes('GetMarketFlag')) {
            return Promise.resolve({
              application_configurations: [{ boolean_value: true }],
            });
          }
          return Promise.resolve({});
        }
      );

      const result = await service.resolve(
        {
          items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
          provisional_country: 'CM',
          payment_timing: 'pay_at_delivery',
        },
        false
      );

      expect(result.can_proceed).toBe(true);
      expect(result.groups[0]?.deposit_required).toBeUndefined();
      expect(result.deposit_required).toBeUndefined();
    });

    it('charges the merchant percent instead of a platform rate', async () => {
      (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
        (query: string) => {
          if (query.includes('GetInventoryForPreflight')) {
            return Promise.resolve({
              business_inventory: [
                makeInventoryRow({
                  id: 'inv-1',
                  sellerCountry: 'CM',
                  currency: 'XAF',
                  price: 6000,
                  payOnDelivery: true,
                  initialDepositEnabled: true,
                  initialDepositPercent: 10,
                }),
              ],
            });
          }
          if (query.includes('GetMarketFlag')) {
            return Promise.resolve({
              application_configurations: [{ boolean_value: true }],
            });
          }
          if (query.includes('StripeCountries')) {
            return Promise.resolve({
              supported_payment_systems: [{ country: 'CA' }],
            });
          }
          return Promise.resolve({});
        }
      );

      const dto: CheckoutPreflightDto = {
        items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
        provisional_country: 'CM',
        payment_timing: 'pay_at_delivery',
      };

      const result = await service.resolve(dto, false);

      expect(result.groups[0]?.deposit_required).toBe(true);
      expect(result.groups[0]?.deposit_amount).toBe(600); // 10% of the 6000 item
      expect(result.groups[0]?.deposit_percent).toBe(10);
    });

    it('enforces 150 XAF floor on small orders', async () => {
      (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
        (query: string) => {
          if (query.includes('GetInventoryForPreflight')) {
            return Promise.resolve({
              business_inventory: [
                makeInventoryRow({
                  id: 'inv-1',
                  sellerCountry: 'CM',
                  currency: 'XAF',
                  price: 1000,
                  payOnDelivery: true,
                  initialDepositEnabled: true,
                  initialDepositPercent: 10,
                }),
              ],
            });
          }
          if (query.includes('GetMarketFlag')) {
            return Promise.resolve({
              application_configurations: [{ boolean_value: true }],
            });
          }
          if (query.includes('StripeCountries')) {
            return Promise.resolve({
              supported_payment_systems: [{ country: 'CA' }],
            });
          }
          return Promise.resolve({});
        }
      );

      const dto: CheckoutPreflightDto = {
        items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
        provisional_country: 'CM',
        payment_timing: 'pay_at_delivery',
      };

      const result = await service.resolve(dto, false);

      expect(result.groups[0]?.deposit_required).toBe(true);
      expect(result.groups[0]?.deposit_amount).toBe(150);
      expect(result.groups[0]?.deposit_minimum_applied).toBe(true);
      expect(result.deposit_minimum_applied).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // MoMo pay_now filtering based on momo_pay_now_delivery_enabled
  // -------------------------------------------------------------------------
  describe('momo_pay_now_delivery_enabled flag', () => {
    it('includes pay_now for MoMo + delivery when flag is enabled', async () => {
      mockInventory([
        makeInventoryRow({
          sellerCountry: 'CM',
          payOnDelivery: true,
        }),
      ]);

      (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
        (query: string) => {
          if (query.includes('GetInventoryForPreflight')) {
            return Promise.resolve({
              business_inventory: [
                makeInventoryRow({
                  sellerCountry: 'CM',
                  payOnDelivery: true,
                }),
              ],
            });
          }
          if (query.includes('GetMarketFlag')) {
            return Promise.resolve({
              application_configurations: [{ boolean_value: true }],
            });
          }
          if (query.includes('StripeCountries')) {
            return Promise.resolve({
              supported_payment_systems: [{ country: 'CA' }],
            });
          }
          return Promise.resolve({});
        }
      );

      const dto: CheckoutPreflightDto = {
        items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
        provisional_country: 'CM',
        fulfillment_method: 'delivery',
      };

      const result = await service.resolve(dto, false);

      expect(result.groups[0]?.allowed_payment_timings).toContain('pay_now');
      expect(result.groups[0]?.allowed_payment_timings).toContain('pay_at_delivery');
      expect(result.groups[0]?.momo_pay_now_delivery_enabled).toBe(true);
    });

    it('excludes pay_now for MoMo + delivery when flag is disabled', async () => {
      mockInventory([
        makeInventoryRow({
          sellerCountry: 'CM',
          payOnDelivery: true,
        }),
      ]);

      (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
        (query: string) => {
          if (query.includes('GetInventoryForPreflight')) {
            return Promise.resolve({
              business_inventory: [
                makeInventoryRow({
                  sellerCountry: 'CM',
                  payOnDelivery: true,
                }),
              ],
            });
          }
          if (query.includes('GetMarketFlag')) {
            return Promise.resolve({
              application_configurations: [{ boolean_value: false }],
            });
          }
          if (query.includes('StripeCountries')) {
            return Promise.resolve({
              supported_payment_systems: [{ country: 'CA' }],
            });
          }
          return Promise.resolve({});
        }
      );

      const dto: CheckoutPreflightDto = {
        items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
        provisional_country: 'CM',
        fulfillment_method: 'delivery',
      };

      const result = await service.resolve(dto, false);

      expect(result.groups[0]?.allowed_payment_timings).not.toContain('pay_now');
      expect(result.groups[0]?.allowed_payment_timings).toContain('pay_at_delivery');
      expect(result.groups[0]?.momo_pay_now_delivery_enabled).toBe(false);
    });

    it('always includes pay_now for MoMo + pickup regardless of flag', async () => {
      mockInventory([
        makeInventoryRow({
          sellerCountry: 'CM',
          payAtPickup: true,
        }),
      ]);

      (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
        (query: string) => {
          if (query.includes('GetInventoryForPreflight')) {
            return Promise.resolve({
              business_inventory: [
                makeInventoryRow({
                  sellerCountry: 'CM',
                  payAtPickup: true,
                }),
              ],
            });
          }
          if (query.includes('GetMarketFlag')) {
            return Promise.resolve({
              application_configurations: [{ boolean_value: false }],
            });
          }
          if (query.includes('StripeCountries')) {
            return Promise.resolve({
              supported_payment_systems: [{ country: 'CA' }],
            });
          }
          return Promise.resolve({});
        }
      );

      const dto: CheckoutPreflightDto = {
        items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
        provisional_country: 'CM',
        fulfillment_method: 'pickup',
      };

      const result = await service.resolve(dto, false);

      expect(result.groups[0]?.allowed_payment_timings).toContain('pay_now');
      expect(result.groups[0]?.allowed_payment_timings).toContain('pay_at_pickup');
      expect(result.groups[0]?.momo_pay_now_delivery_enabled).toBeUndefined();
    });

    it('always includes pay_now for Stripe regardless of MoMo flag', async () => {
      mockInventory([
        makeInventoryRow({
          sellerCountry: 'CA',
        }),
      ]);
      (paymentRoutingService.resolveRailForCountry as jest.Mock).mockResolvedValue('stripe');

      (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
        (query: string) => {
          if (query.includes('GetInventoryForPreflight')) {
            return Promise.resolve({
              business_inventory: [
                makeInventoryRow({
                  sellerCountry: 'CA',
                }),
              ],
            });
          }
          if (query.includes('GetMarketFlag')) {
            return Promise.resolve({
              application_configurations: [{ boolean_value: false }],
            });
          }
          if (query.includes('StripeCountries')) {
            return Promise.resolve({
              supported_payment_systems: [{ country: 'CA' }],
            });
          }
          return Promise.resolve({});
        }
      );

      const dto: CheckoutPreflightDto = {
        items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
        provisional_country: 'CA',
        fulfillment_method: 'delivery',
      };

      const result = await service.resolve(dto, false);

      expect(result.groups[0]?.allowed_payment_timings).toContain('pay_now');
      expect(result.groups[0]?.payment_rail).toBe('stripe');
    });
  });

  describe('walletCoversDue and purchase credit preview', () => {
    it('returns false for pay-later timings even when the wallet is large', () => {
      expect((service as any).walletCoversDue('pay_at_delivery', 99999, 1000, 0, 0)).toBe(false);
      expect((service as any).walletCoversDue('pay_at_pickup', 99999, 1000, 0, 0)).toBe(false);
    });

    it('treats wallet as covering the due after discount and capped credits', () => {
      expect((service as any).walletCoversDue('pay_now', 400, 1000, 100, 500)).toBe(true);
      expect((service as any).walletCoversDue('pay_now', 399, 1000, 100, 500)).toBe(false);
      expect((service as any).walletCoversDue('pay_now', 0, 1000, 0, 2000)).toBe(true);
    });

    it('returns a purchase credit preview only when a user and positive lines exist', async () => {
      const plan = jest.fn().mockResolvedValue({
        total: 300,
        allocations: [{ amount: 300, applicability: 'any_store', businessId: null }],
      });
      (service as any).purchaseCreditsService = { plan };

      await expect((service as any).previewPurchaseCredits(null, [])).resolves.toBeNull();
      await expect(
        (service as any).previewPurchaseCredits('user-1', [{ business_id: 'b1', subtotal: 0 }])
      ).resolves.toBeNull();

      await expect(
        (service as any).previewPurchaseCredits('user-1', [
          { business_id: 'b1', subtotal: 800, currency: 'XAF' },
        ])
      ).resolves.toEqual({
        total: 300,
        currency: 'XAF',
        allocations: [{ amount: 300, applicability: 'any_store', businessId: null }],
      });
      expect(plan).toHaveBeenCalledWith({
        userId: 'user-1',
        currency: 'XAF',
        lines: [{ businessId: 'b1', subtotal: 800 }],
        maxTotal: 800,
      });
    });
  });
});

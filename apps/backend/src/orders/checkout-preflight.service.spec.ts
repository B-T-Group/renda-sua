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
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { DeliveryAvailabilityService } from '../delivery-availability/delivery-availability.service';
import { CheckoutPreflightService } from './checkout-preflight.service';
import { StripeTaxCheckoutBuilderService } from '../stripe-tax/stripe-tax-checkout-builder.service';
import {
  CheckoutMethod,
  CheckoutPreflightDto,
  VerificationMethod,
} from './dto/checkout-preflight.dto';

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
  available?: number;
  price?: number;
  itemName?: string;
  canAcceptOrders?: boolean;
} = {}) {
  return {
    id: overrides.id ?? 'inv-1',
    selling_price: overrides.price ?? 1000,
    computed_available_quantity: overrides.available ?? 10,
    is_active: true,
    business_location: {
      business_id: overrides.businessId ?? 'biz-1',
      business: {
        id: overrides.businessId ?? 'biz-1',
        name: overrides.businessName ?? 'Test Business',
        can_accept_orders: overrides.canAcceptOrders ?? true,
        user: { id: overrides.ownerUserId ?? 'owner-1' },
      },
      address: { country: overrides.sellerCountry ?? 'CM' },
    },
    item: {
      id: 'item-1',
      name: overrides.itemName ?? 'Test Item',
      currency: overrides.currency ?? 'XAF',
      weight: 0,
      max_order_quantity: null,
      pay_on_delivery_enabled: overrides.payOnDelivery ?? false,
      pay_at_pickup_enabled: overrides.payAtPickup ?? false,
      item_variants: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CheckoutPreflightService', () => {
  let service: CheckoutPreflightService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let hasuraUserService: jest.Mocked<HasuraUserService>;
  let paymentRoutingService: jest.Mocked<PaymentRoutingService>;
  let mobilePaymentsService: jest.Mocked<MobilePaymentsService>;
  let loyaltyService: jest.Mocked<LoyaltyService>;
  let deliveryAvailabilityService: jest.Mocked<DeliveryAvailabilityService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutPreflightService,
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
          },
        },
        {
          provide: MobilePaymentsService,
          useValue: {
            getProvider: jest.fn().mockReturnValue('freemopay'),
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
      ],
    }).compile();

    service = module.get<CheckoutPreflightService>(CheckoutPreflightService);
    hasuraSystemService = module.get(HasuraSystemService);
    hasuraUserService = module.get(HasuraUserService);
    paymentRoutingService = module.get(PaymentRoutingService);
    mobilePaymentsService = module.get(MobilePaymentsService);
    loyaltyService = module.get(LoyaltyService);
    deliveryAvailabilityService = module.get(DeliveryAvailabilityService);
  });

  function mockInventory(rows: ReturnType<typeof makeInventoryRow>[]) {
    (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
      (query: string) => {
        if (query.includes('GetInventoryForPreflight')) {
          return Promise.resolve({ business_inventory: rows });
        }
        if (query.includes('GetAddressCountry')) {
          return Promise.resolve({ addresses_by_pk: null });
        }
        return Promise.resolve({});
      }
    );
  }

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
    mockInventory([makeInventoryRow({ sellerCountry: 'CM' })]);
    (hasuraSystemService.executeQuery as jest.Mock).mockImplementation(
      (query: string) => {
        if (query.includes('GetInventoryForPreflight')) {
          return Promise.resolve({ business_inventory: [makeInventoryRow({ sellerCountry: 'CM' })] });
        }
        if (query.includes('GetAddressCountry')) {
          return Promise.resolve({ addresses_by_pk: { country: 'CA' } });
        }
        return Promise.resolve({});
      }
    );

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

  // -------------------------------------------------------------------------
  // 6. Blocks mixed-country carts
  // -------------------------------------------------------------------------
  it('blocks checkout for mixed-country carts', async () => {
    const row1 = makeInventoryRow({ id: 'inv-1', businessId: 'biz-1', sellerCountry: 'CM', ownerUserId: 'owner-1' });
    const row2 = makeInventoryRow({ id: 'inv-2', businessId: 'biz-2', sellerCountry: 'CA', ownerUserId: 'owner-2' });
    (hasuraSystemService.executeQuery as jest.Mock).mockResolvedValue({
      business_inventory: [row1, row2],
    });

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
    (hasuraSystemService.executeQuery as jest.Mock).mockResolvedValue({
      business_inventory: [row],
    });
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
    (hasuraSystemService.executeQuery as jest.Mock).mockResolvedValue({
      business_inventory: [row],
    });
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

  it('skips delivery availability evaluation for pickup carts', async () => {
    mockInventory([makeInventoryRow({ payAtPickup: true })]);

    const dto: CheckoutPreflightDto = {
      items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
      fulfillment_method: 'pickup',
      provisional_country: 'CM',
      payment_timing: 'pay_at_pickup',
    };

    const result = await service.resolve(dto, false);

    expect(deliveryAvailabilityService.evaluate).not.toHaveBeenCalled();
    expect(result.delivery_availability).toBeNull();
    expect(result.groups[0]?.delivery_availability).toBeNull();
    expect(result.groups[0]?.pickup_eligible).toBe(true);
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
});

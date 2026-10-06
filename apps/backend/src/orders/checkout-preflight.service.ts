/**
 * Checkout Preflight Service
 *
 * Authoritative pre-order checkout resolver. Determines payment rail,
 * verification method, payment timing eligibility, fee estimates, and
 * blocking errors without creating any orders or transactions.
 *
 * All business rules here must stay aligned with OrdersService.createOrder.
 * If you change a rule in one, change it in both.
 */
import {
  anyLocationPayAtConfirm,
  PAY_AFTER_CONFIRM_LOCATION_FLAG_KEY,
  resolvePayAfterConfirm,
} from '../food/pay-after-confirm.util';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { FulfillmentPromiseService } from './fulfillment-promise.service';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { buildDeliveryAvailabilityContext } from '../delivery-availability/build-delivery-availability-context';
import { DeliveryAvailabilityService } from '../delivery-availability/delivery-availability.service';
import { toPublicDeliveryAvailability } from '../delivery-availability/delivery-availability.types';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PurchaseCreditsService } from '../payment-programs/purchase-credits.service';
import { MetaConversionsService } from '../meta-conversions/meta-conversions.service';
import { MobilePaymentsService } from '../mobile-payments/mobile-payments.service';
import { MobilePaymentPhonesService } from '../mobile-payment-phones/mobile-payment-phones.service';
import { StripeConfig, Configuration } from '../config/configuration';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { StripeTaxCheckoutBuilderService } from '../stripe-tax/stripe-tax-checkout-builder.service';
import {
  CheckoutBlockerDto,
  CheckoutDiasporaDto,
  CheckoutDiscountPreviewDto,
  CheckoutGroupDto,
  CheckoutItemLineDto,
  CheckoutMethod,
  CheckoutPreflightDto,
  CheckoutPreflightResponseDto,
  DeliveryAvailabilityDto,
  VerificationMethod,
} from './dto/checkout-preflight.dto';
import { FxEstimateService } from '../diaspora/fx-estimate.service';
import { DepositCalculationService } from './deposit-calculation.service';
import {
  DIASPORA_ERROR_CODES,
  normalizeCountryCode,
  normalizeRecipientPhone,
} from '../diaspora/diaspora-order.util';
import {
  resolveEffectiveUnitPrice,
  sumBaseUnitsForItem,
  sumStockUnitsByInventory,
} from '../item-variants/variant-pricing.util';
import {
  resolveShopperVariant,
  ShopperVariantResolveException,
} from './resolve-shopper-variant.util';
import {
  fetchStripeEnabledCountries,
  isLocationPaymentsEnabled,
} from '../inventory-items/inventory-catalog-eligibility.util';
import { checkFoodOrderable } from '../food/food-order-guard.util';
import {
  buildCookedFoodStoreClosedDetails,
  buildCookedFoodStoreClosedMessage,
  collectCookedFoodSlots,
} from '../food/cooked-food-closed-message.util';
import type { FoodAvailabilitySlot } from '../food/food-availability.util';
import { cookedFoodIgnoresStock } from '../food/food-inventory-quantity.util';
import {
  anyLineIsCookedFood,
  isCookedFoodFulfillmentOrder,
  lineIsCookedFood,
} from '../food/cooked-food-flag.util';
import type { DepositLineInput } from './deposit-calculation.service';
import { resolveItemCountry } from '../mobile-payments/item-country.util';
import { validatePhoneNumber } from '../mobile-payments/phone-validation.util';
import { VariantInventoryService } from '../item-variants/variant-inventory.service';

const BUSINESS_INVENTORY_PREFLIGHT_QUERY = `
  query GetInventoryForPreflight($ids: [uuid!]!) {
    business_inventory(where: { id: { _in: $ids }, is_active: { _eq: true } }) {
      id
      selling_price
      computed_available_quantity
      is_active
      item_variant_id
      variant_price_overrides {
        id
        item_variant_id
        selling_price
      }
      business_location {
        id
        business_id
        is_active
        pay_at_confirm
        operating_hours
        mobile_payment_phone {
          is_verified
        }
        business {
          id
          name
          can_accept_orders
          default_estimated_prep_minutes
          user { id country }
        }
        address { country state city latitude longitude }
      }
      food_settings {
        marked_unavailable_at
        availability_slots(order_by: [{ day_of_week: asc }, { start_time: asc }]) {
          day_of_week
          start_time
          end_time
        }
      }
      item {
        id
        name
        currency
        weight
        max_order_quantity
        preparation_minutes
        pay_on_delivery_enabled
        export_available
        pay_at_pickup_enabled
        shipping_enabled
        shipping_price
        shipping_currency
        is_cooked_food
        initial_deposit_enabled
        initial_deposit_percent
        item_sub_category {
          item_category { name }
        }
        item_variants(where: { is_active: { _eq: true } }, order_by: { sort_order: asc }) {
          id
          name
          price
          quantity
          weight
          is_default
        }
      }
        item_variant {
        id
        name
        price
        quantity
      }
    }
  }
`;

const ADDRESS_COUNTRY_QUERY = `
  query GetAddressCountry($addressId: uuid!) {
    addresses_by_pk(id: $addressId) {
      country
      state
      latitude
      longitude
    }
  }
`;

@Injectable()
export class CheckoutPreflightService {
  private readonly logger = new Logger(CheckoutPreflightService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly mobilePaymentPhonesService: MobilePaymentPhonesService,
    private readonly loyaltyService: LoyaltyService,
    private readonly configService: ConfigService,
    private readonly taxCheckoutBuilder: StripeTaxCheckoutBuilderService,
    private readonly deliveryAvailabilityService: DeliveryAvailabilityService,
    private readonly metaConversionsService: MetaConversionsService,
    private readonly fulfillmentPromiseService: FulfillmentPromiseService,
    private readonly fxEstimateService: FxEstimateService,
    private readonly depositCalculationService: DepositCalculationService,
    private readonly variantInventory: VariantInventoryService,
    @Optional()
    private readonly purchaseCreditsService?: PurchaseCreditsService
  ) {}

  private async safeUserId(): Promise<string | null> {
    try {
      const user = await this.hasuraUserService.getUser();
      return user?.id ?? null;
    } catch {
      return null;
    }
  }

  private async previewPurchaseCredits(
    userId: string | null,
    groups: Array<{ business_id: string; subtotal: number; currency?: string }>
  ): Promise<{
    total: number;
    currency: string;
    allocations: Array<{
      amount: number;
      applicability: string;
      businessId: string | null;
    }>;
  } | null> {
    if (!userId || !this.purchaseCreditsService || groups.length === 0) return null;
    const currency = groups[0].currency;
    if (!currency) return null;
    const lines = groups.map((group) => ({
      businessId: group.business_id,
      subtotal: Number(group.subtotal || 0),
    }));
    const maxTotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
    if (maxTotal <= 0) return null;
    const plan = await this.purchaseCreditsService.plan({
      userId,
      currency,
      lines,
      maxTotal,
    });
    return {
      total: plan.total,
      currency,
      allocations: plan.allocations.map((row) => ({
        amount: row.amount,
        applicability: row.applicability,
        businessId: row.businessId,
      })),
    };
  }

  private walletCoversDue(
    paymentTiming: string | undefined,
    walletBalance: number,
    gross: number,
    discount: number,
    credits: number
  ): boolean {
    if (paymentTiming === 'pay_at_delivery' || paymentTiming === 'pay_at_pickup') {
      return false;
    }
    const payable = Math.max(0, Number((gross - discount).toFixed(2)));
    const applied = Math.min(Math.max(0, credits), payable);
    const due = Math.max(0, Number((payable - applied).toFixed(2)));
    return walletBalance >= due;
  }

  async resolve(
    dto: CheckoutPreflightDto,
    isAuthenticated: boolean,
    meta?: {
      externalId?: string;
      clientIpAddress?: string;
      clientUserAgent?: string;
      actionSource?: 'website' | 'app' | 'other';
      allowUserEnrichment?: boolean;
    }
  ): Promise<CheckoutPreflightResponseDto> {
    const blockers: CheckoutBlockerDto[] = [];

    const fulfillment: 'delivery' | 'pickup' | 'shipping' =
      dto.fulfillment_method === 'shipping'
        ? 'shipping'
        : dto.fulfillment_method === 'pickup' ||
            dto.payment_timing === 'pay_at_pickup'
          ? 'pickup'
          : 'delivery';

    // -----------------------------------------------------------------------
    // 1. Load inventory
    // -----------------------------------------------------------------------
    const ids = dto.items.map((i) => i.business_inventory_id);
    let inventories: any[] = [];
    try {
      const result = await this.hasuraSystemService.executeQuery(
        BUSINESS_INVENTORY_PREFLIGHT_QUERY,
        { ids }
      );
      inventories = result.business_inventory ?? [];
    } catch (err: any) {
      this.logger.error('Preflight inventory fetch failed', err?.message);
      blockers.push({
        code: 'INVENTORY_FETCH_FAILED',
        message: 'Could not load product information. Please try again.',
      });
      return this.earlyExit(blockers, dto);
    }

    if (inventories.length === 0) {
      blockers.push({
        code: 'INVENTORY_NOT_FOUND',
        message: 'One or more items are not available.',
      });
      return this.earlyExit(blockers, dto);
    }

    // -----------------------------------------------------------------------
    // 2. Build a map for quick lookup & derive seller countries
    // -----------------------------------------------------------------------
    const inventoryById = new Map<string, any>(
      inventories.map((inv: any) => [inv.id, inv])
    );

    const stripeCountries = await fetchStripeEnabledCountries(
      this.hasuraSystemService
    );

    // Check all requested items are found and active
    for (const line of dto.items) {
      const inv = inventoryById.get(line.business_inventory_id);
      if (!inv) {
        blockers.push({
          code: 'ITEM_NOT_FOUND',
          message: `Item ${line.business_inventory_id} was not found or is unavailable.`,
        });
      } else if (!inv.is_active) {
        blockers.push({
          code: 'ITEM_UNAVAILABLE',
          message: `${inv.item?.name ?? 'An item'} is not currently available.`,
        });
      } else if (inv.item?.export_available === true) {
        blockers.push({
          code: 'EXPORT_AVAILABLE_ITEM',
          message: `${inv.item?.name ?? 'An item'} cannot be purchased. Submit interest instead.`,
        });
      } else if (inv.business_location?.is_active !== true) {
        blockers.push({
          code: 'ITEM_UNAVAILABLE',
          message: `${inv.item?.name ?? 'An item'} is not currently available.`,
        });
      } else if (
        !isLocationPaymentsEnabled(inv.business_location, stripeCountries)
      ) {
        blockers.push({
          code: 'LOCATION_PAYMENTS_COMING_SOON',
          message: `${inv.item?.name ?? 'An item'} is not available for purchase yet. Payments at this location are coming soon.`,
        });
      } else {
        const foodBlock = checkFoodOrderable(inv);
        if (foodBlock) blockers.push(foodBlock);
      }
    }

    if (blockers.length > 0) return this.earlyExit(blockers, dto);

    await this.variantInventory.retargetLines(dto.items, inventoryById);

    // -----------------------------------------------------------------------
    // 3. Derive per-business groups
    // -----------------------------------------------------------------------
    const businessMap = new Map<
      string,
      {
        businessId: string;
        ownerId: string;
        sellerCountry: string;
        sellerState: string;
        businessLocationId: string;
        businessName: string;
        items: typeof dto.items;
        inventoryRows: any[];
      }
    >();

    for (const line of dto.items) {
      const inv = inventoryById.get(line.business_inventory_id)!;
      const businessId: string = inv.business_location?.business_id;
      const ownerId: string = inv.business_location?.business?.user?.id ?? '';
      // Item country is the listing location; owner country is only a fallback.
      const sellerCountry: string =
        resolveItemCountry(
          inv.business_location?.address?.country,
          inv.business_location?.business?.user?.country
        ) ?? '';
      const sellerState: string = (
        inv.business_location?.address?.state ?? ''
      ).trim();
      const businessLocationId: string = inv.business_location?.id ?? '';
      const businessName: string = inv.business_location?.business?.name ?? '';

      if (!businessMap.has(businessId)) {
        businessMap.set(businessId, {
          businessId,
          ownerId,
          sellerCountry,
          sellerState,
          businessLocationId,
          businessName,
          items: [],
          inventoryRows: [],
        });
      }
      businessMap.get(businessId)!.items.push(line);
      businessMap.get(businessId)!.inventoryRows.push(inv);
    }

    for (const [, group] of businessMap) {
      const checkoutGateEnabled =
        this.configService.get<Configuration['merchantLifecycle']>(
          'merchantLifecycle'
        )?.checkoutGateEnabled !== false;
      if (!checkoutGateEnabled) continue;

      const canAccept =
        group.inventoryRows[0]?.business_location?.business?.can_accept_orders ===
        true;
      if (!canAccept) {
        const label = group.businessName || 'This merchant';
        blockers.push({
          code: 'MERCHANT_NOT_ACCEPTING_ORDERS',
          message: `${label} is currently completing account setup and is not yet accepting orders.`,
        });
      }
    }

    if (blockers.length > 0) return this.earlyExit(blockers, dto);

    // -----------------------------------------------------------------------
    // 4. Country mismatch: seller vs guest shopping country
    // -----------------------------------------------------------------------
    const sellerCountries = [
      ...new Set([...businessMap.values()].map((g) => g.sellerCountry).filter(Boolean)),
    ];

    const guestCountry = (dto.provisional_country ?? '').trim().toUpperCase();

    if (guestCountry && sellerCountries.length > 0) {
      const mismatchedCountries = sellerCountries.filter((c) => c !== guestCountry);
      if (mismatchedCountries.length > 0) {
        const countryNames = mismatchedCountries.join(', ');
        blockers.push({
          code: 'UNSUPPORTED_COUNTRY_COMBINATION',
          message: `The selected items are only available for delivery within ${countryNames}. Your shopping country is ${guestCountry}.`,
        });
      }
    }

    // Mixed-country cart
    if (sellerCountries.length > 1) {
      blockers.push({
        code: 'MIXED_COUNTRY_CART',
        message:
          'Your cart contains items from different countries. Please check out items from one country at a time.',
      });
    }

    // -----------------------------------------------------------------------
    // 5. Delivery country validation
    // -----------------------------------------------------------------------
    const dropOff = await this.loadDropOff(dto.delivery_address_id);
    let deliveryCountry: string | null = null;

    if (dropOff.country && this.needsShipToAddress(fulfillment)) {
      deliveryCountry = dropOff.country;
      this.pushCountryMismatch(blockers, deliveryCountry, sellerCountries);
    }

    // -----------------------------------------------------------------------
    // 6. Resolve payment rail per seller group
    // -----------------------------------------------------------------------
    const payerCountry = await this.resolvePayerCountry(dto, isAuthenticated);
    const fulfillmentCountry =
      deliveryCountry ??
      normalizeCountryCode(guestCountry) ??
      normalizeCountryCode(sellerCountries[0]);

    const groupRails = new Map<string, 'stripe' | 'mobile_money'>();
    let diasporaRailSource: 'seller' | 'payer' = 'seller';
    for (const [businessId, group] of businessMap) {
      // Resolve rail from the seller's country (already on the inventory row),
      // not via a user-level address lookup which can miss records. A payer
      // billing from a Stripe country can also unlock Stripe for a
      // mobile-money merchant — see PaymentRoutingService.resolveOrderRail.
      const resolution = await this.paymentRoutingService.resolveOrderRail({
        sellerCountry: group.sellerCountry || null,
        payerCountry,
      });
      if (resolution.isDiaspora) diasporaRailSource = 'payer';
      groupRails.set(businessId, resolution.rail);
    }
    const isDiaspora = diasporaRailSource === 'payer';

    this.collectRecipientBlockers(dto, fulfillmentCountry, blockers);
    if (isDiaspora && (dto.payment_timing ?? 'pay_now') !== 'pay_now') {
      blockers.push({
        code: DIASPORA_ERROR_CODES.requiresPayNow,
        message:
          'Orders paid from abroad must be paid online at checkout. Pay at delivery and pay at pickup are not available.',
      });
    }

    // Determine overall checkout method (all groups must agree, or we pick dominant)
    const rails = [...groupRails.values()];
    const allStripe = rails.every((r) => r === 'stripe');
    const anyStripe = rails.some((r) => r === 'stripe');
    const anyMoMo = rails.some((r) => r === 'mobile_money');

    if (anyStripe && anyMoMo) {
      // Mixed-rail cart is only a blocker if there are multiple groups; single-group carts always have a single rail
      if (businessMap.size > 1) {
        blockers.push({
          code: 'MIXED_PAYMENT_RAILS',
          message:
            'Your cart contains items from sellers that use different payment methods. Please check out items from one seller at a time.',
        });
      }
    }

    const checkoutMethod: CheckoutMethod = allStripe
      ? CheckoutMethod.STRIPE
      : CheckoutMethod.MOBILE_MONEY;

    const verificationMethod: VerificationMethod =
      checkoutMethod === CheckoutMethod.STRIPE
        ? VerificationMethod.EMAIL
        : VerificationMethod.PHONE;

    // -----------------------------------------------------------------------
    // 7. Delivery availability per seller group (rule-based, reason-blind)
    // -----------------------------------------------------------------------
    const availabilityByBusiness =
      await this.evaluateGroupsDeliveryAvailability(
        businessMap,
        dto,
        dropOff.coords,
        dropOff.country
      );

    // -----------------------------------------------------------------------
    // 8. Build per-group summaries
    // -----------------------------------------------------------------------
    const groups: CheckoutGroupDto[] = [];
    let requiresPaymentPhoneOverall = false;
    const cookedFoodClosedMeta = new Map<
      string,
      {
        timezone: string;
        operatingHours: unknown;
        foodSlots: FoodAvailabilitySlot[];
      }
    >();

    for (const [businessId, group] of businessMap) {
      const rail = groupRails.get(businessId) ?? 'mobile_money';
      const requiresPhone =
        rail === 'mobile_money' ||
        dto.payment_timing === 'pay_at_delivery' ||
        dto.payment_timing === 'pay_at_pickup';

      if (requiresPhone) requiresPaymentPhoneOverall = true;

      const currency: string = group.inventoryRows[0]?.item?.currency ?? 'XAF';

      // Payment timings allowed
      const allPayOnDelivery = group.inventoryRows.every(
        (inv: any) => inv.item?.pay_on_delivery_enabled === true
      );
      const allPayAtPickup = group.inventoryRows.every(
        (inv: any) => inv.item?.pay_at_pickup_enabled === true
      );
      const allShippingEnabled = group.inventoryRows.every(
        (inv: any) =>
          inv.item?.shipping_enabled === true &&
          this.isValidShippingPrice(inv.item?.shipping_price)
      );
      
      // Check momo_pay_now_delivery_enabled flag for this fulfillment country
      const momoPayNowDeliveryEnabled = await this.isMarketFlagEnabled(
        'momo_pay_now_delivery_enabled',
        fulfillmentCountry
      );
      
      // Per-location pay-at-confirm (kill switch on, any line's location flagged):
      // MoMo pay-before-delivery is allowed even where the market flag is off.
      const locationPayAfter =
        rail === 'mobile_money' &&
        !isDiaspora &&
        fulfillment !== 'shipping' &&
        anyLocationPayAtConfirm(group.inventoryRows) &&
        (await this.isMarketFlagEnabled(
          PAY_AFTER_CONFIRM_LOCATION_FLAG_KEY,
          null
        ));

      const allowedPaymentTimings: Array<'pay_now' | 'pay_at_delivery' | 'pay_at_pickup'> = [];
      
      // Add pay_now if:
      // - Rail is Stripe (always allowed), OR
      // - Rail is MoMo AND (fulfillment is NOT delivery OR flag is enabled)
      if (
        rail === 'stripe' ||
        (rail === 'mobile_money' &&
          (fulfillment !== 'delivery' ||
            momoPayNowDeliveryEnabled ||
            locationPayAfter))
      ) {
        allowedPaymentTimings.push('pay_now');
      }
      
      if (allPayOnDelivery && rail !== 'stripe') allowedPaymentTimings.push('pay_at_delivery');
      if (allPayAtPickup && rail !== 'stripe') allowedPaymentTimings.push('pay_at_pickup');

      // Safety: If no payment timings available (shouldn't happen in valid config), block checkout
      if (allowedPaymentTimings.length === 0) {
        blockers.push({
          code: 'NO_PAYMENT_TIMING_AVAILABLE',
          message: `No payment options are available for items from ${group.businessName || businessId}. Please contact support.`,
        });
      }

      // Validate requested payment timing
      // When omitted, prefer PAD/pickup over pay_now if those are available
      const requestedTiming =
        dto.payment_timing ??
        (allowedPaymentTimings.includes('pay_at_delivery')
          ? 'pay_at_delivery'
          : allowedPaymentTimings.includes('pay_at_pickup')
            ? 'pay_at_pickup'
            : 'pay_now');
      if (requestedTiming === 'pay_at_delivery' && !allPayOnDelivery) {
        blockers.push({
          code: 'PAY_AT_DELIVERY_UNAVAILABLE',
          message: `Pay at delivery is not available for all items from ${group.businessName || businessId}.`,
        });
      }
      if (requestedTiming === 'pay_at_pickup' && !allPayAtPickup) {
        blockers.push({
          code: 'PAY_AT_PICKUP_UNAVAILABLE',
          message: `Pay at pickup is not available for all items from ${group.businessName || businessId}.`,
        });
      }
      if (requestedTiming === 'pay_at_delivery' && rail === 'stripe') {
        blockers.push({
          code: 'PAY_AT_DELIVERY_STRIPE_NOT_SUPPORTED',
          message: `Pay at delivery is not supported for card payment sellers.`,
        });
      }
      if (requestedTiming === 'pay_at_pickup' && rail === 'stripe') {
        blockers.push({
          code: 'PAY_AT_PICKUP_STRIPE_NOT_SUPPORTED',
          message: `Pay at pickup is not supported for card payment sellers. Pay online when placing your order.`,
        });
      }
      if (fulfillment === 'pickup' && !allPayAtPickup) {
        blockers.push({
          code: 'PICKUP_UNAVAILABLE',
          message: `Store pickup is not available for all items from ${group.businessName || businessId}.`,
        });
      }
      if (fulfillment === 'shipping' && !allShippingEnabled) {
        blockers.push({
          code: 'SHIPPING_UNAVAILABLE',
          message: `Carrier shipping is not available for all items from ${group.businessName || businessId}.`,
        });
      }
      if (fulfillment === 'shipping' && requestedTiming !== 'pay_now') {
        blockers.push({
          code: 'SHIPPING_REQUIRES_PAY_NOW',
          message: `Carrier shipping requires payment at checkout (pay online).`,
        });
      }

      // Stock validation
      const quantityByInv = sumStockUnitsByInventory(
        group.items,
        inventoryById
      );
      for (const inv of group.inventoryRows) {
        const requested = quantityByInv.get(inv.id) ?? 0;
        if (
          !cookedFoodIgnoresStock(
            inv.item?.item_sub_category?.item_category?.name,
            inv.item?.is_cooked_food
          ) &&
          requested > inv.computed_available_quantity
        ) {
          blockers.push({
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for ${inv.item?.name ?? inv.id}. Available: ${inv.computed_available_quantity}, requested: ${requested}.`,
          });
        }
      }
      this.pushMaxOrderBlockers(group.inventoryRows, quantityByInv, blockers);

      let mobileMoneyProvider: string | null = null;
      if (rail === 'mobile_money') {
        mobileMoneyProvider = this.mobilePaymentsService.getProviderForCountry(
          group.sellerCountry
        );
      }

      if (rail === 'mobile_money' && dto.phone_number?.trim() && group.sellerCountry) {
        const phoneOk = validatePhoneNumber(
          dto.phone_number.trim(),
          group.sellerCountry
        ).isValid;
        if (!phoneOk) {
          blockers.push({
            code: 'MOBILE_MONEY_PHONE_UNSUPPORTED',
            message: `The phone number provided is not supported for Mobile Money payments in ${group.sellerCountry}.`,
          });
        }
      }

      // Build item lines
      const itemLines: CheckoutItemLineDto[] = [];
      for (const line of group.items) {
        const inv = inventoryById.get(line.business_inventory_id)!;
        try {
          const variant = this.resolveVariantForOrderParity(
            line.item_variant_id,
            inv
          );
          const unitPrice = resolveEffectiveUnitPrice({
            inventorySellingPrice: inv.selling_price,
            variant,
            overrides: inv.variant_price_overrides ?? [],
          });
          itemLines.push({
            business_inventory_id: line.business_inventory_id,
            quantity: line.quantity,
            item_variant_id: line.item_variant_id ?? variant?.id,
            unit_price: unitPrice,
            line_total: unitPrice * line.quantity,
            item_name: inv.item?.name,
            seller_country: group.sellerCountry,
          });
        } catch (error: any) {
          blockers.push({
            code: error?.response?.error || error?.error || 'ITEM_VARIANT_INVALID',
            message:
              error?.response?.message ||
              error?.message ||
              'Selected variant is invalid for this product.',
          });
        }
      }
      if (itemLines.length === 0 && group.items.length > 0) {
        continue;
      }

      const subtotal = itemLines.reduce((s, l) => s + l.line_total, 0);

      // Delivery/shipping fee estimate
      let deliveryFee: number | null = null;
      let shippingFee: number | null = null;
      let isFirstOrderClient: boolean | undefined = undefined;
      
      if (fulfillment === 'shipping') {
        // Calculate shipping fee: sum of all item shipping prices * quantities
        shippingFee = 0;
        for (const line of group.items) {
          const inv = inventoryById.get(line.business_inventory_id)!;
          const itemShippingPrice = inv.item?.shipping_price ?? 0;
          shippingFee += itemShippingPrice * line.quantity;
        }
      } else if (dto.delivery_address_id && fulfillment === 'delivery' && isAuthenticated) {
        try {
          const feeResult = await this.hasuraSystemService.executeQuery(
            `query GetDeliveryFeeForPreflight($inventoryId: uuid!, $addressId: uuid!) {
              orders_aggregate(where: { 
                order_items: { business_inventory_id: { _eq: $inventoryId } }
                current_status: { _in: ["pending", "confirmed", "completed", "delivered"] }
              }) { aggregate { count } }
            }`,
            { inventoryId: group.items[0].business_inventory_id, addressId: dto.delivery_address_id }
          );
          isFirstOrderClient = (feeResult.orders_aggregate?.aggregate?.count ?? 1) === 0;
          deliveryFee = null; // Fee requires full calculation; mark as requiring a separate call
        } catch {
          deliveryFee = null;
        }
      }

      const totalFee = shippingFee ?? deliveryFee ?? 0;
      const grandTotal = subtotal + totalFee;

      const requestedOrAvailableTiming = dto.payment_timing ?? 
        (allowedPaymentTimings.includes('pay_at_delivery') ? 'pay_at_delivery' :
         allowedPaymentTimings.includes('pay_at_pickup') ? 'pay_at_pickup' : 'pay_now');

      // Cooked-food delivery/pickup: no reservation deposit (pay after confirm or full MoMo later).
      const groupIsCookedFood =
        isCookedFoodFulfillmentOrder({
          fulfillmentMethod: fulfillment,
          itemFlags: group.inventoryRows.map(
            (row: {
              item?: {
                is_cooked_food?: boolean | null;
                item_sub_category?: {
                  item_category?: { name?: string | null } | null;
                } | null;
              };
            }) => row.item
          ),
        });

      // Same predicate as createOrder. The preflight does not know the wallet balance
      // or the order total here, so wallet/zero are passed as false (unchanged behaviour).
      const groupIsCookedFoodPayAfter = resolvePayAfterConfirm({
        lines: group.inventoryRows.map((row: { item?: any }) => row.item),
        fulfillment,
        rail,
        canPayWithWallet: false,
        isZeroOrder: false,
        isDiaspora,
        locationPayAtConfirm: locationPayAfter,
      });

      const depositQuote = this.quoteMomoItemDeposit({
        rail,
        // Pay-after (cooked or flagged location) never takes a reservation deposit.
        groupIsCookedFood: groupIsCookedFood || groupIsCookedFoodPayAfter,
        timing: requestedOrAvailableTiming,
        currency,
        orderTotal: grandTotal,
        lines: this.depositLinesForGroup(itemLines, inventoryById),
      });
      const depositRequired = (depositQuote?.depositAmount ?? 0) > 0;

      const location = group.inventoryRows[0]?.business_location;
      const configuredPrep =
        this.configService.get<Configuration['order']>('order')
          ?.defaultEstimatedPrepMinutes ?? 30;
      const prepMinutes =
        typeof location?.business?.default_estimated_prep_minutes === 'number' &&
        location.business.default_estimated_prep_minutes > 0
          ? location.business.default_estimated_prep_minutes
          : configuredPrep;
      const timezone = await this.fulfillmentPromiseService.timezoneForCountry(
        group.sellerCountry
      );
      const groupHasCookedFood = anyLineIsCookedFood(
        group.inventoryRows.map((row: { item?: unknown }) => row.item as any)
      );
      const foodSlots = groupHasCookedFood
        ? collectCookedFoodSlots(group.inventoryRows)
        : [];
      const asap = this.fulfillmentPromiseService.evaluateAsap({
        operatingHours: location?.operating_hours,
        foodSlots: foodSlots.length > 0 ? foodSlots : undefined,
        prepMinutes,
        fulfillmentMethod: fulfillment,
        timezone,
        isFastDelivery: dto.requires_fast_delivery === true,
      });
      if (groupHasCookedFood) {
        cookedFoodClosedMeta.set(businessId, {
          timezone,
          operatingHours: location?.operating_hours,
          foodSlots,
        });
      }

      groups.push({
        business_id: businessId,
        business_name: group.businessName || undefined,
        currency,
        payment_rail: rail,
        allowed_payment_timings: allowedPaymentTimings,
        requires_payment_phone: requiresPhone,
        seller_country: group.sellerCountry,
        seller_state: group.sellerState || undefined,
        business_location_id: group.businessLocationId || undefined,
        subtotal,
        delivery_fee: deliveryFee ?? shippingFee,
        is_first_order_client: isFirstOrderClient,
        total: grandTotal,
        deposit_required: depositRequired || undefined,
        deposit_amount: depositRequired ? depositQuote?.depositAmount : undefined,
        amount_due: depositRequired ? depositQuote?.amountDue : undefined,
        deposit_minimum_applied: depositRequired
          ? depositQuote?.minimumApplied
          : undefined,
        deposit_percent: depositRequired ? depositQuote?.percent : undefined,
        momo_pay_now_delivery_enabled: rail === 'mobile_money' && fulfillment === 'delivery' 
          ? momoPayNowDeliveryEnabled 
          : undefined,
        mobile_money_provider: mobileMoneyProvider,
        delivery_availability: availabilityByBusiness.get(businessId) ?? null,
        pickup_eligible: allPayAtPickup,
        shipping_eligible: allShippingEnabled,
        items: itemLines,
        asap_available: asap.available,
        asap_disabled_reason: asap.reason,
        opens_at: asap.opensAt ?? null,
        estimated_prep_minutes: asap.estimatedPrepMinutes,
        estimated_ready_at: asap.estimatedReadyAt,
        estimated_fulfill_by: asap.estimatedFulfillBy,
        // Cooked food cannot be scheduled; never force a future slot.
        schedule_required:
          groupHasCookedFood || groupIsCookedFoodPayAfter
            ? false
            : asap.scheduleRequired,
        // ASAP only for cooked food and for pay-after-confirm groups (v1).
        schedule_allowed: !groupHasCookedFood && !groupIsCookedFoodPayAfter,
        pay_after_merchant_confirm_eligible: groupIsCookedFoodPayAfter,
        all_cooked_food: groupIsCookedFood,
      });
    }

    // -----------------------------------------------------------------------
    // 9. Discount pre-validation (authenticated only, best-effort)
    // -----------------------------------------------------------------------
    let discountPreview: CheckoutDiscountPreviewDto | null = null;
    if (dto.discount_code?.trim() && isAuthenticated) {
      try {
        const validation = await this.loyaltyService.validateDiscountCode(
          dto.discount_code.trim()
        );
        if (validation.valid && validation.percentage) {
          const totalBeforeDiscount = groups.reduce((s, g) => s + g.total, 0);
          const discountAmount = Number(
            ((totalBeforeDiscount * validation.percentage) / 100).toFixed(2)
          );
          discountPreview = {
            valid: true,
            percentage: validation.percentage,
            discount_amount: discountAmount,
            message: 'Discount code is valid',
          };
        } else {
          discountPreview = { valid: false, message: 'Invalid or already used discount code' };
        }
      } catch {
        discountPreview = { valid: false, message: 'Could not validate discount code' };
      }
    }

    // -----------------------------------------------------------------------
    // 10. Wallet & buyer rail (authenticated only)
    // -----------------------------------------------------------------------
    let buyerRail: 'stripe' | 'mobile_money' | null = null;
    let canPayWithWallet: boolean | null = null;
    let walletBalance: number | null = null;

    if (isAuthenticated) {
      try {
        const user = await this.hasuraUserService.getUser();
        if (user?.id) {
          buyerRail = await this.paymentRoutingService.resolveRailForUser(user.id);
          if (groups.length === 1 && groups[0].currency) {
            const account = await this.hasuraSystemService.getAccount(
              user.id,
              groups[0].currency
            );
            walletBalance = Number(account?.available_balance ?? 0);
            canPayWithWallet =
              dto.payment_timing !== 'pay_at_delivery' &&
              dto.payment_timing !== 'pay_at_pickup' &&
              walletBalance >= groups.reduce((s, g) => s + g.total, 0) &&
              groups.reduce((s, g) => s + g.total, 0) > 0;
          }
        }
      } catch (err: any) {
        this.logger.warn('Preflight buyer rail/wallet fetch failed', err?.message);
      }
    }

    const purchaseCredits = await this.previewPurchaseCredits(
      isAuthenticated ? await this.safeUserId() : null,
      groups
    );
    if (walletBalance != null && canPayWithWallet != null) {
      const gross = groups.reduce((sum, group) => sum + Number(group.total || 0), 0);
      const discount = discountPreview?.valid
        ? Number(discountPreview.discount_amount || 0)
        : 0;
      canPayWithWallet =
        gross > 0 &&
        this.walletCoversDue(
          dto.payment_timing,
          walletBalance,
          gross,
          discount,
          purchaseCredits?.total ?? 0
        );
    }

    // -----------------------------------------------------------------------
    // 11. Assemble response
    // -----------------------------------------------------------------------
    const asapGroups = groups.filter((g) => fulfillment !== 'shipping');
    const scheduleAllowed = asapGroups.every(
      (g) => g.schedule_allowed !== false
    );
    const scheduleRequired =
      scheduleAllowed && asapGroups.some((g) => g.schedule_required);
    const asapAvailable =
      fulfillment !== 'shipping' &&
      asapGroups.length > 0 &&
      asapGroups.every((g) => g.asap_available);
    const firstBlocked = asapGroups.find((g) => !g.asap_available);

    for (const group of asapGroups) {
      if (group.schedule_allowed === false && group.asap_available === false) {
        const meta = cookedFoodClosedMeta.get(group.business_id);
        const closedParams = {
          opensAt: group.opens_at,
          timezone: meta?.timezone ?? 'UTC',
          operatingHours: meta?.operatingHours,
          foodSlots: meta?.foodSlots,
        };
        blockers.push({
          code: 'COOKED_FOOD_STORE_CLOSED',
          message: buildCookedFoodStoreClosedMessage(closedParams),
          details: buildCookedFoodStoreClosedDetails(closedParams),
        });
        break;
      }
    }

    const canProceed = blockers.length === 0;
    const stripeManualCapture =
      this.configService.get<StripeConfig>('stripe')?.manualCaptureEnabled ?? false;

    const taxCountry =
      deliveryCountry ?? guestCountry ?? sellerCountries[0] ?? null;
    const taxNotice =
      checkoutMethod === 'STRIPE' &&
      this.taxCheckoutBuilder.isTaxEnabledForCountry(
        this.taxCheckoutBuilder.normalizeCountryCode(taxCountry)
      )
        ? ('calculated_at_checkout' as const)
        : null;

    if (canProceed) {
      this.scheduleInitiateCheckout(dto, groups, meta);
    }

    const paymentPhoneHint = await this.resolveSuggestedPaymentPhone(
      dto,
      isAuthenticated,
      requiresPaymentPhoneOverall
    );

    return {
      success: true,
      can_proceed: canProceed,
      blocking_errors: blockers,
      checkout_method: checkoutMethod,
      verification_method: verificationMethod,
      item_countries: sellerCountries,
      delivery_country: deliveryCountry,
      groups,
      discount: discountPreview,
      buyer_rail: buyerRail,
      can_pay_with_wallet: canPayWithWallet,
      wallet_balance: walletBalance,
      purchase_credits: purchaseCredits,
      requires_address_for_payment: this.needsShipToAddress(fulfillment),
      requires_payment_phone: requiresPaymentPhoneOverall,
      suggested_payment_phone: paymentPhoneHint.suggested_payment_phone,
      suggested_payment_phone_id: paymentPhoneHint.suggested_payment_phone_id,
      payment_phone_source: paymentPhoneHint.payment_phone_source,
      stripe_retry_unsupported: checkoutMethod !== CheckoutMethod.STRIPE,
      stripe_manual_capture: stripeManualCapture,
      tax_notice: taxNotice,
      delivery_availability: this.aggregateDeliveryAvailability(groups),
      asap_available: asapAvailable,
      asap_disabled_reason: firstBlocked?.asap_disabled_reason,
      opens_at: firstBlocked?.opens_at ?? asapGroups[0]?.opens_at ?? null,
      estimated_prep_minutes: asapGroups[0]?.estimated_prep_minutes,
      estimated_ready_at: asapGroups[0]?.estimated_ready_at,
      estimated_fulfill_by: asapGroups[0]?.estimated_fulfill_by,
      schedule_required: scheduleRequired,
      schedule_allowed: scheduleAllowed,
      pay_after_merchant_confirm_eligible:
        groups.length > 0 &&
        groups.every((g) => g.pay_after_merchant_confirm_eligible === true),
      diaspora: this.buildDiasporaBlock({
        dto,
        isDiaspora,
        railSource: diasporaRailSource,
        payerCountry,
        fulfillmentCountry,
        groups,
      }),
      // Hoist first-group deposit fields for single-seller checkout UIs
      deposit_required: groups[0]?.deposit_required,
      deposit_amount: groups[0]?.deposit_amount,
      amount_due: groups[0]?.amount_due,
      deposit_minimum_applied: groups[0]?.deposit_minimum_applied,
      deposit_percent: groups[0]?.deposit_percent,
      momo_pay_now_delivery_enabled: groups[0]?.momo_pay_now_delivery_enabled,
    };
  }

  /**
   * Billing country of the payer: the explicit checkout selection first, then
   * the authenticated profile country. Never the delivery country.
   */
  private async resolvePayerCountry(
    dto: CheckoutPreflightDto,
    isAuthenticated: boolean
  ): Promise<string | null> {
    const requested = normalizeCountryCode(dto.payer_country);
    if (!isAuthenticated) return requested;
    try {
      const user = await this.hasuraUserService.getUser();
      if (!user?.id) return requested;
      const profile = normalizeCountryCode(
        await this.paymentRoutingService.getUserCountryCode(user.id)
      );
      return this.paymentRoutingService.resolveTrustedPayerCountry({
        profileCountry: profile,
        requestedCountry: requested,
      });
    } catch (err: any) {
      this.logger.warn('Preflight payer country lookup failed', err?.message);
      return requested;
    }
  }

  /** Validates the recipient block so checkout fails before the card is charged. */
  private collectRecipientBlockers(
    dto: CheckoutPreflightDto,
    fulfillmentCountry: string | null,
    blockers: CheckoutBlockerDto[]
  ): void {
    const name = dto.recipient?.name?.trim();
    const phone = dto.recipient?.phone?.trim();
    const wantsThirdParty =
      dto.sending_to_someone_else === true || Boolean(name || phone);
    if (!wantsThirdParty) return;

    if (!name || !phone) {
      blockers.push({
        code: DIASPORA_ERROR_CODES.recipientContactRequired,
        message:
          'A recipient name and phone number are required when sending to someone else.',
      });
      return;
    }
    if (!normalizeRecipientPhone(phone, fulfillmentCountry)) {
      blockers.push({
        code: DIASPORA_ERROR_CODES.recipientPhoneInvalid,
        message: `The recipient phone number is not a valid number for ${
          fulfillmentCountry ?? 'the delivery country'
        }.`,
      });
    }
  }

  /**
   * Payer-vs-recipient context for the checkout banner and FX line. Returned
   * whenever the shopper is buying for someone else or paying from abroad, so
   * the UI has one place to read both facts from.
   */
  private buildDiasporaBlock(params: {
    dto: CheckoutPreflightDto;
    isDiaspora: boolean;
    railSource: 'seller' | 'payer';
    payerCountry: string | null;
    fulfillmentCountry: string | null;
    groups: CheckoutGroupDto[];
  }): CheckoutDiasporaDto | null {
    const requiresRecipientContact =
      params.dto.sending_to_someone_else === true;
    const crossBorder =
      !!params.payerCountry &&
      !!params.fulfillmentCountry &&
      params.payerCountry !== params.fulfillmentCountry;
    if (!params.isDiaspora && !crossBorder && !requiresRecipientContact) {
      return null;
    }

    const total = params.groups.reduce((sum, g) => sum + (g.total || 0), 0);
    const merchantCurrency = params.groups[0]?.currency ?? '';
    return {
      is_diaspora: params.isDiaspora,
      payer_country: params.payerCountry,
      fulfillment_country: params.fulfillmentCountry,
      rail_source: params.railSource,
      payer_charge_estimate: this.fxEstimateService.estimate({
        amount: total,
        merchantCurrency,
        payerCountry: params.payerCountry,
      }),
      requires_recipient_contact: requiresRecipientContact,
    };
  }

  private async loadDropOff(addressId?: string): Promise<{
    country: string | null;
    coords: { lat: number; lon: number } | null;
  }> {
    if (!addressId) return { country: null, coords: null };
    try {
      const addrResult = await this.hasuraSystemService.executeQuery(
        ADDRESS_COUNTRY_QUERY,
        { addressId }
      );
      return this.dropOffFromAddress(addrResult.addresses_by_pk);
    } catch (err: any) {
      this.logger.warn('Preflight address fetch failed', err?.message);
      return { country: null, coords: null };
    }
  }

  private dropOffFromAddress(addr: any): {
    country: string | null;
    coords: { lat: number; lon: number } | null;
  } {
    const country = (addr?.country ?? '').trim().toUpperCase() || null;
    if (addr?.latitude == null || addr?.longitude == null) {
      return { country, coords: null };
    }
    return {
      country,
      coords: { lat: Number(addr.latitude), lon: Number(addr.longitude) },
    };
  }

  private pushCountryMismatch(
    blockers: CheckoutBlockerDto[],
    deliveryCountry: string,
    sellerCountries: string[]
  ): void {
    const mismatch = sellerCountries.find((c) => c !== deliveryCountry);
    if (!mismatch) return;
    blockers.push({
      code: 'DELIVERY_COUNTRY_MISMATCH',
      message: `Your delivery address is in ${deliveryCountry}, but the items are only available for delivery within ${mismatch}. Please use an address in ${mismatch} or change the items in your cart.`,
    });
  }

  private needsShipToAddress(
    fulfillment: 'delivery' | 'pickup' | 'shipping'
  ): boolean {
    return fulfillment === 'delivery' || fulfillment === 'shipping';
  }

  private scheduleInitiateCheckout(
    dto: CheckoutPreflightDto,
    groups: CheckoutGroupDto[],
    meta?: {
      externalId?: string;
      clientIpAddress?: string;
      clientUserAgent?: string;
      actionSource?: 'website' | 'app' | 'other';
      allowUserEnrichment?: boolean;
    }
  ): void {
    // Skip early/catalog preflights; require address, phone, or explicit eventId.
    const intentional =
      !!dto.eventId?.trim() ||
      !!dto.delivery_address_id ||
      !!dto.phone_number?.trim();
    if (!intentional) return;

    const contentIds = dto.items.map((i) => i.business_inventory_id);
    const value = groups.reduce((s, g) => s + (g.total || 0), 0);
    const currency = groups[0]?.currency;
    const numItems = dto.items.reduce((s, i) => s + (i.quantity || 0), 0);
    void this.metaConversionsService.trackInitiateCheckoutSafe({
      eventId: this.resolveCheckoutEventId(dto),
      actionSource: meta?.actionSource ?? 'website',
      contentIds,
      contents: dto.items.map((i) => ({
        id: i.business_inventory_id,
        quantity: i.quantity,
      })),
      value: value > 0 ? value : undefined,
      currency,
      numItems,
      externalId: meta?.externalId,
      clientIpAddress: meta?.clientIpAddress,
      clientUserAgent: meta?.clientUserAgent,
      fbc: dto.fbc,
      fbp: dto.fbp,
      eventSourceUrl: dto.eventSourceUrl,
      allowUserEnrichment: meta?.allowUserEnrichment === true,
    });
  }

  /** Stable id so repeated preflights for the same cart dedupe in Meta. */
  private resolveCheckoutEventId(dto: CheckoutPreflightDto): string {
    if (dto.eventId?.trim()) return dto.eventId.trim();
    const key = dto.items
      .map(
        (i) =>
          `${i.business_inventory_id}:${i.quantity}:${i.item_variant_id ?? ''}`
      )
      .sort()
      .join('|');
    const digest = createHash('sha256').update(key, 'utf8').digest('hex');
    return `checkout-${digest.slice(0, 32)}`;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Evaluates delivery availability for every seller group, including when
   * the shopper has not chosen delivery yet.
   */
  private async evaluateGroupsDeliveryAvailability(
    businessMap: Map<string, any>,
    dto: CheckoutPreflightDto,
    deliveryCoords: { lat: number; lon: number } | null,
    deliveryCountry: string | null
  ): Promise<Map<string, DeliveryAvailabilityDto>> {
    const map = new Map<string, DeliveryAvailabilityDto>();
    await Promise.all(
      [...businessMap.entries()].map(async ([businessId, group]) => {
        map.set(
          businessId,
          toPublicDeliveryAvailability(
            await this.deliveryAvailabilityService.evaluate(
              this.groupAvailabilityContext(
                businessId,
                group,
                dto,
                deliveryCoords,
                deliveryCountry
              )
            )
          )
        );
      })
    );
    return map;
  }

  private groupAvailabilityContext(
    businessId: string,
    group: { inventoryRows: any[]; sellerCountry?: string },
    dto: CheckoutPreflightDto,
    deliveryCoords: { lat: number; lon: number } | null,
    deliveryCountry: string | null
  ) {
    const address = group.inventoryRows[0]?.business_location?.address;
    return buildDeliveryAvailabilityContext({
      businessId,
      businessLocationId: group.inventoryRows[0]?.business_location?.id,
      sellerCountry: group.sellerCountry,
      sellerState: address?.state,
      sellerCity: address?.city,
      pickupLat: address?.latitude,
      pickupLon: address?.longitude,
      deliveryAddressId: dto.delivery_address_id,
      deliveryLat: deliveryCoords?.lat,
      deliveryLon: deliveryCoords?.lon,
      deliveryCountry,
      itemIds: group.inventoryRows.map((inv: any) => inv?.item?.id),
      inventoryIds: group.inventoryRows.map((inv: any) => inv?.id),
      requiresFastDelivery: dto.requires_fast_delivery === true,
      verifiedAgentDelivery: dto.verified_agent_delivery === true,
      stage: 'preflight',
    });
  }

  /** Delivery is available overall only when every seller group can deliver. */
  private aggregateDeliveryAvailability(
    groups: CheckoutGroupDto[]
  ): DeliveryAvailabilityDto {
    const perGroup = groups.map((g) => g.delivery_availability);
    const available =
      perGroup.length > 0 && perGroup.every((a) => a?.available === true);
    const estimates = perGroup
      .map((a) => a?.estimated_delivery_minutes)
      .filter((v): v is number => v != null);
    return {
      available,
      estimated_delivery_minutes:
        available && estimates.length > 0 ? Math.max(...estimates) : null,
    };
  }

  private earlyExit(
    blockers: CheckoutBlockerDto[],
    dto: CheckoutPreflightDto
  ): CheckoutPreflightResponseDto {
    return {
      success: true,
      can_proceed: false,
      blocking_errors: blockers,
      checkout_method: CheckoutMethod.MOBILE_MONEY,
      verification_method: VerificationMethod.PHONE,
      item_countries: [],
      delivery_country: null,
      groups: [],
      discount: null,
      buyer_rail: null,
      can_pay_with_wallet: null,
      wallet_balance: null,
      purchase_credits: null,
      requires_address_for_payment: dto.fulfillment_method !== 'pickup',
      requires_payment_phone: false,
      suggested_payment_phone: null,
      suggested_payment_phone_id: null,
      payment_phone_source: 'none',
      stripe_retry_unsupported: true,
      stripe_manual_capture: false,
      delivery_availability: null,
    };
  }

  private async resolveSuggestedPaymentPhone(
    dto: CheckoutPreflightDto,
    isAuthenticated: boolean,
    requiresPaymentPhone: boolean
  ): Promise<{
    suggested_payment_phone: string | null;
    suggested_payment_phone_id: string | null;
    payment_phone_source: 'registry' | 'profile' | 'none';
  }> {
    const empty = {
      suggested_payment_phone: null as string | null,
      suggested_payment_phone_id: null as string | null,
      payment_phone_source: 'none' as const,
    };
    if (!requiresPaymentPhone || !isAuthenticated) return empty;
    try {
      const user = await this.hasuraUserService.getUser();
      if (!user?.id) return empty;
      const profileCountry =
        await this.paymentRoutingService.getUserCountryCode(user.id);
      const resolved =
        await this.mobilePaymentPhonesService.resolveCheckoutPaymentPhone({
          userId: user.id,
          mobilePaymentPhoneId: dto.mobile_payment_phone_id,
          profilePhone: user.phone_number,
          profileCountry,
          linkProfileIfNeeded: false,
        });
      return {
        suggested_payment_phone: resolved.phoneE164,
        suggested_payment_phone_id: resolved.phoneId,
        payment_phone_source: resolved.source,
      };
    } catch (error: any) {
      this.logger.warn(
        `resolveSuggestedPaymentPhone: ${error?.message ?? String(error)}`
      );
      return empty;
    }
  }

  /**
   * Mirrors OrdersService.resolveVariantForOrderLine for checkout parity.
   */
  private resolveVariantForOrderParity(
    requestedVariantId: string | undefined,
    inventoryRow: any
  ): any | null {
    try {
      return resolveShopperVariant({
        requestedVariantId,
        inventoryRow,
      });
    } catch (error: any) {
      if (error instanceof ShopperVariantResolveException) {
        throw {
          error: error.code,
          message: error.message,
        };
      }
      throw error;
    }
  }

  private isValidShippingPrice(price: unknown): boolean {
    if (price === null || price === undefined || price === '') return false;
    const n = Number(price);
    return Number.isFinite(n) && n >= 0;
  }

  /**
   * Check if a market flag is enabled via application_configurations.
   * Prefers country-specific config, falls back to NULL country default.
   */
  private async isMarketFlagEnabled(
    configKey: string,
    countryCode?: string | null
  ): Promise<boolean> {
    try {
      const query = `
        query GetMarketFlag($configKey: String!${countryCode ? ', $countryCode: String!' : ''}) {
          application_configurations(
            where: {
              config_key: { _eq: $configKey }
              _or: [
                ${countryCode ? '{ country_code: { _eq: $countryCode } }' : ''}
                { country_code: { _is_null: true } }
              ]
            }
            order_by: { country_code: desc_nulls_last }
            limit: 1
          ) {
            boolean_value
          }
        }
      `;
      // Never send `_eq: null` (Hasura v2 rejects it, which would make a global-only flag
      // such as the pay_at_confirm kill switch always read as off): omit the country filter.
      const result = await this.hasuraSystemService.executeQuery(
        query,
        countryCode ? { configKey, countryCode } : { configKey }
      );
      const configs = (result as any).application_configurations || [];
      if (configs.length === 0) {
        return false;
      }
      return configs[0].boolean_value === true;
    } catch (error: any) {
      this.logger.warn(
        `Failed to fetch market flag ${configKey} for country ${countryCode}`,
        error?.message
      );
      return false;
    }
  }

  private depositLinesForGroup(
    itemLines: CheckoutItemLineDto[],
    inventoryById: Map<string, any>
  ): DepositLineInput[] {
    return itemLines.map((line) => {
      const item = inventoryById.get(line.business_inventory_id)?.item as
        | DepositLineSource
        | undefined;
      return {
        unitPrice: line.unit_price,
        quantity: line.quantity,
        initialDepositEnabled: item?.initial_deposit_enabled === true,
        initialDepositPercent: item?.initial_deposit_percent ?? null,
        isCookedFood: lineIsCookedFood(item),
      };
    });
  }

  private quoteMomoItemDeposit(input: {
    rail: string;
    groupIsCookedFood: boolean;
    timing: string;
    currency: string;
    orderTotal: number;
    lines: DepositLineInput[];
  }) {
    if (!this.momoPayLaterDeposit(input)) return null;
    return this.depositCalculationService.calculateItemDeposit({
      lines: input.lines,
      currency: input.currency,
      orderTotal: input.orderTotal,
    });
  }

  private momoPayLaterDeposit(input: {
    rail: string;
    groupIsCookedFood: boolean;
    timing: string;
  }): boolean {
    if (input.rail !== 'mobile_money' || input.groupIsCookedFood) return false;
    return input.timing === 'pay_at_delivery' || input.timing === 'pay_at_pickup';
  }

  private pushMaxOrderBlockers(
    rows: Array<{
      id: string;
      item?: { id?: string; name?: string; max_order_quantity?: number | null };
    }>,
    unitsByInventory: Map<string, number>,
    blockers: CheckoutBlockerDto[]
  ): void {
    const seen = new Set<string>();
    for (const row of rows) this.pushMaxOrderBlocker(row, rows, unitsByInventory, seen, blockers);
  }

  private pushMaxOrderBlocker(
    row: { item?: { id?: string; name?: string; max_order_quantity?: number | null } },
    rows: Array<{ id?: string | null; item?: { id?: string | null } | null }>,
    unitsByInventory: Map<string, number>,
    seen: Set<string>,
    blockers: CheckoutBlockerDto[]
  ): void {
    const itemId = row.item?.id;
    const maxQty = row.item?.max_order_quantity;
    if (!itemId || maxQty == null || seen.has(itemId)) return;
    seen.add(itemId);
    const requested = sumBaseUnitsForItem(rows, itemId, unitsByInventory);
    if (requested <= maxQty) return;
    blockers.push({
      code: 'MAX_ORDER_QUANTITY_EXCEEDED',
      message: `${row.item?.name ?? itemId} has a maximum order quantity of ${maxQty}.`,
    });
  }
}

type DepositLineSource = {
  is_cooked_food?: boolean | null;
  initial_deposit_enabled?: boolean | null;
  initial_deposit_percent?: number | null;
  item_sub_category?: {
    item_category?: { name?: string | null } | null;
  } | null;
};

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
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MobilePaymentsService } from '../mobile-payments/mobile-payments.service';
import { StripeConfig } from '../config/configuration';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import {
  CheckoutBlockerDto,
  CheckoutDiscountPreviewDto,
  CheckoutGroupDto,
  CheckoutItemLineDto,
  CheckoutMethod,
  CheckoutPreflightDto,
  CheckoutPreflightResponseDto,
  VerificationMethod,
} from './dto/checkout-preflight.dto';

const BUSINESS_INVENTORY_PREFLIGHT_QUERY = `
  query GetInventoryForPreflight($ids: [uuid!]!) {
    business_inventory(where: { id: { _in: $ids }, is_active: { _eq: true } }) {
      id
      selling_price
      computed_available_quantity
      is_active
      business_location {
        business_id
        business {
          id
          name
          user { id }
        }
        address { country }
      }
      item {
        id
        name
        currency
        weight
        max_order_quantity
        pay_on_delivery_enabled
        pay_at_pickup_enabled
        item_variants(where: { is_active: { _eq: true } }, order_by: { sort_order: asc }) {
          id
          name
          price
          weight
          is_default
        }
      }
    }
  }
`;

const ADDRESS_COUNTRY_QUERY = `
  query GetAddressCountry($addressId: uuid!) {
    addresses_by_pk(id: $addressId) {
      country
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
    private readonly loyaltyService: LoyaltyService,
    private readonly configService: ConfigService
  ) {}

  async resolve(
    dto: CheckoutPreflightDto,
    isAuthenticated: boolean
  ): Promise<CheckoutPreflightResponseDto> {
    const blockers: CheckoutBlockerDto[] = [];

    const fulfillment: 'delivery' | 'pickup' =
      dto.fulfillment_method === 'pickup' ||
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
      }
    }

    if (blockers.length > 0) return this.earlyExit(blockers, dto);

    // -----------------------------------------------------------------------
    // 3. Derive per-business groups
    // -----------------------------------------------------------------------
    const businessMap = new Map<
      string,
      { businessId: string; ownerId: string; sellerCountry: string; businessName: string; items: typeof dto.items; inventoryRows: any[] }
    >();

    for (const line of dto.items) {
      const inv = inventoryById.get(line.business_inventory_id)!;
      const businessId: string = inv.business_location?.business_id;
      const ownerId: string = inv.business_location?.business?.user?.id ?? '';
      const sellerCountry: string =
        (inv.business_location?.address?.country ?? '').trim().toUpperCase();
      const businessName: string = inv.business_location?.business?.name ?? '';

      if (!businessMap.has(businessId)) {
        businessMap.set(businessId, {
          businessId,
          ownerId,
          sellerCountry,
          businessName,
          items: [],
          inventoryRows: [],
        });
      }
      businessMap.get(businessId)!.items.push(line);
      businessMap.get(businessId)!.inventoryRows.push(inv);
    }

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
    let deliveryCountry: string | null = null;

    if (dto.delivery_address_id && fulfillment === 'delivery') {
      try {
        const addrResult = await this.hasuraSystemService.executeQuery(
          ADDRESS_COUNTRY_QUERY,
          { addressId: dto.delivery_address_id }
        );
        deliveryCountry =
          (addrResult.addresses_by_pk?.country ?? '').trim().toUpperCase() || null;
      } catch (err: any) {
        this.logger.warn('Preflight address fetch failed', err?.message);
      }

      if (deliveryCountry && sellerCountries.length > 0) {
        const mismatch = sellerCountries.find((c) => c !== deliveryCountry);
        if (mismatch) {
          blockers.push({
            code: 'DELIVERY_COUNTRY_MISMATCH',
            message: `Your delivery address is in ${deliveryCountry}, but the items are only available for delivery within ${mismatch}. Please use an address in ${mismatch} or change the items in your cart.`,
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // 6. Resolve payment rail per seller group
    // -----------------------------------------------------------------------
    const groupRails = new Map<string, 'stripe' | 'mobile_money'>();
    for (const [businessId, group] of businessMap) {
      // Resolve rail from the seller's country (already on the inventory row),
      // not via a user-level address lookup which can miss records.
      const rail = group.sellerCountry
        ? await this.paymentRoutingService.resolveRailForCountry(group.sellerCountry)
        : 'mobile_money';
      groupRails.set(businessId, rail);
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
    // 7. Build per-group summaries
    // -----------------------------------------------------------------------
    const groups: CheckoutGroupDto[] = [];
    let requiresPaymentPhoneOverall = false;

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
      const allowedPaymentTimings: Array<'pay_now' | 'pay_at_delivery' | 'pay_at_pickup'> = ['pay_now'];
      if (allPayOnDelivery && rail !== 'stripe') allowedPaymentTimings.push('pay_at_delivery');
      if (allPayAtPickup && rail !== 'stripe') allowedPaymentTimings.push('pay_at_pickup');

      // Validate requested payment timing
      const requestedTiming = dto.payment_timing ?? 'pay_now';
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

      // Stock validation
      const quantityByInv = new Map<string, number>();
      for (const line of group.items) {
        quantityByInv.set(
          line.business_inventory_id,
          (quantityByInv.get(line.business_inventory_id) ?? 0) + line.quantity
        );
      }
      for (const inv of group.inventoryRows) {
        const requested = quantityByInv.get(inv.id) ?? 0;
        if (requested > inv.computed_available_quantity) {
          blockers.push({
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for ${inv.item?.name ?? inv.id}. Available: ${inv.computed_available_quantity}, requested: ${requested}.`,
          });
        }
        const maxQty = inv.item?.max_order_quantity;
        if (maxQty != null && requested > maxQty) {
          blockers.push({
            code: 'MAX_ORDER_QUANTITY_EXCEEDED',
            message: `${inv.item?.name ?? inv.id} has a maximum order quantity of ${maxQty}.`,
          });
        }
      }

      // Mobile money provider
      let mobileMoneyProvider: string | null = null;
      if (rail === 'mobile_money' && dto.phone_number?.trim()) {
        try {
          mobileMoneyProvider = this.mobilePaymentsService.getProvider(dto.phone_number.trim());
        } catch {
          mobileMoneyProvider = null;
        }
      }

      // Phone country alignment for Mobile Money
      if (rail === 'mobile_money' && dto.phone_number?.trim() && group.sellerCountry) {
        if (!mobileMoneyProvider) {
          blockers.push({
            code: 'MOBILE_MONEY_PHONE_UNSUPPORTED',
            message: `The phone number provided is not supported for Mobile Money payments in ${group.sellerCountry}.`,
          });
        }
      }

      // Build item lines
      const itemLines: CheckoutItemLineDto[] = group.items.map((line) => {
        const inv = inventoryById.get(line.business_inventory_id)!;
        const variant = this.resolveVariant(line.item_variant_id, inv);
        const unitPrice =
          variant?.price != null && variant.price !== ''
            ? Number(variant.price)
            : Number(inv.selling_price ?? 0);
        return {
          business_inventory_id: line.business_inventory_id,
          quantity: line.quantity,
          item_variant_id: line.item_variant_id,
          unit_price: unitPrice,
          line_total: unitPrice * line.quantity,
          item_name: inv.item?.name,
          seller_country: group.sellerCountry,
        };
      });

      const subtotal = itemLines.reduce((s, l) => s + l.line_total, 0);

      // Delivery fee estimate (only for authenticated address)
      let deliveryFee: number | null = null;
      let isFirstOrderClient: boolean | undefined = undefined;
      if (dto.delivery_address_id && fulfillment === 'delivery' && isAuthenticated) {
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

      groups.push({
        business_id: businessId,
        business_name: group.businessName || undefined,
        currency,
        payment_rail: rail,
        allowed_payment_timings: allowedPaymentTimings,
        requires_payment_phone: requiresPhone,
        seller_country: group.sellerCountry,
        subtotal,
        delivery_fee: deliveryFee,
        is_first_order_client: isFirstOrderClient,
        total: subtotal + (deliveryFee ?? 0),
        mobile_money_provider: mobileMoneyProvider,
        items: itemLines,
      });
    }

    // -----------------------------------------------------------------------
    // 8. Discount pre-validation (authenticated only, best-effort)
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
    // 9. Wallet & buyer rail (authenticated only)
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

    // -----------------------------------------------------------------------
    // 10. Assemble response
    // -----------------------------------------------------------------------
    const canProceed = blockers.length === 0;
    const stripeManualCapture =
      this.configService.get<StripeConfig>('stripe')?.manualCaptureEnabled ?? false;

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
      requires_address_for_payment: fulfillment === 'delivery',
      requires_payment_phone: requiresPaymentPhoneOverall,
      stripe_retry_unsupported: !stripeManualCapture,
      stripe_manual_capture: stripeManualCapture,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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
      requires_address_for_payment: dto.fulfillment_method !== 'pickup',
      requires_payment_phone: false,
      stripe_retry_unsupported: true,
      stripe_manual_capture: false,
    };
  }

  private resolveVariant(variantId: string | undefined, inv: any): any | null {
    const variants: any[] = inv.item?.item_variants ?? [];
    if (variants.length === 0) return null;
    if (variants.length === 1) return variants[0];
    if (!variantId) return null;
    return variants.find((v: any) => v?.id === variantId) ?? null;
  }
}

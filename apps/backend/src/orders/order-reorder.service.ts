import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DeliveryAvailabilityService } from '../delivery-availability/delivery-availability.service';
import { checkFoodOrderable } from '../food/food-order-guard.util';
import { cookedFoodIgnoresStock } from '../food/food-inventory-quantity.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  fetchStripeEnabledCountries,
  isLocationPaymentsEnabled,
} from '../inventory-items/inventory-catalog-eligibility.util';
import { resolveEffectiveUnitPrice } from '../item-variants/variant-pricing.util';
import {
  resolveActivePersonaWithDefault,
  type UserPersonaShape,
} from '../users/persona.util';
import { OrderAcceptanceService } from './order-acceptance.service';
import {
  ShopperVariantResolveException,
  resolveShopperVariant,
} from './resolve-shopper-variant.util';
import type {
  ReorderFulfillmentType,
  ReorderLineDto,
  ReorderNavigationHint,
  ReorderOrderResponseDto,
  ReorderSkipReason,
  ReorderSkippedDto,
} from './dto/reorder-order.dto';

const REORDER_ELIGIBLE_STATUSES = new Set(['complete', 'delivered']);

const ORDER_FOR_REORDER_QUERY = `
  query GetOrderForReorder($orderId: uuid!) {
    orders_by_pk(id: $orderId) {
      id
      current_status
      business_id
      business_location_id
      delivery_address_id
      fulfillment_method
      client { id user_id }
      business_location {
        id
        is_active
        address { country state latitude longitude }
        business { id name }
      }
      delivery_address {
        id
        country
        state
        latitude
        longitude
      }
      order_items {
        id
        business_inventory_id
        item_id
        item_variant_id
        item_name
        variant_name
        quantity
      }
    }
  }
`;

/** Same stock fields as checkout preflight; includes inactive rows for skip reasons. */
const INVENTORY_FOR_REORDER_QUERY = `
  query GetInventoryForReorder($ids: [uuid!]!) {
    business_inventory(where: { id: { _in: $ids } }) {
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
        mobile_payment_phone { is_verified }
        business {
          id
          name
          can_accept_orders
          user { id country }
        }
        address { country state latitude longitude }
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
        max_order_quantity
        min_order_quantity
        pay_on_delivery_enabled
        export_available
        is_cooked_food
        item_sub_category {
          item_category { name }
        }
        item_images(order_by: { display_order: asc }, limit: 1) {
          image_url
        }
        item_variants(where: { is_active: { _eq: true } }, order_by: { sort_order: asc }) {
          id
          name
          price
          is_default
        }
      }
      item_variant { id name price }
    }
  }
`;

type ReorderOrderRow = {
  id: string;
  current_status: string;
  business_id: string;
  business_location_id: string;
  delivery_address_id?: string | null;
  fulfillment_method?: string | null;
  client?: { id: string; user_id: string } | null;
  business_location?: {
    id: string;
    is_active?: boolean | null;
    address?: {
      country?: string | null;
      state?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    } | null;
    business?: { id: string; name?: string | null } | null;
  } | null;
  delivery_address?: {
    id: string;
    country?: string | null;
    state?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  order_items: Array<{
    id: string;
    business_inventory_id: string;
    item_id?: string | null;
    item_variant_id?: string | null;
    item_name?: string | null;
    variant_name?: string | null;
    quantity: number;
  }>;
};

type LineResolveResult =
  | { ok: true; line: ReorderLineDto }
  | { ok: false; skipped: ReorderSkippedDto };

@Injectable()
export class OrderReorderService {
  private readonly logger = new Logger(OrderReorderService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly orderAcceptanceService: OrderAcceptanceService,
    private readonly deliveryAvailabilityService: DeliveryAvailabilityService
  ) {}

  async reorder(orderId: string): Promise<ReorderOrderResponseDto> {
    const user = await this.hasuraUserService.getUser();
    this.requireClientPersona(user);
    const order = await this.loadOrder(orderId);
    this.assertOrderOwner(order, user.id);
    this.assertEligibleStatus(order.current_status);

    const accepting =
      await this.orderAcceptanceService.isBusinessAcceptingOrders(
        order.business_id
      );
    const { lines, skipped } = await this.buildLines(order, accepting);
    const fulfillmentType = this.resolveFulfillmentType(
      order.fulfillment_method
    );
    const addressValid = await this.resolveAddressValid(order, fulfillmentType);

    return {
      business_id: order.business_id,
      lines,
      skipped,
      fulfillment: {
        type: fulfillmentType,
        address_id: order.delivery_address_id ?? null,
        address_valid: addressValid,
        business_accepting_orders: accepting,
      },
      navigation_hint: this.resolveNavigationHint({
        lineCount: lines.length,
        originalCount: order.order_items?.length ?? 0,
        accepting,
        addressValid,
        fulfillmentType,
      }),
    };
  }

  private requireClientPersona(user: UserPersonaShape): void {
    const active = resolveActivePersonaWithDefault(
      user,
      this.hasuraUserService.sessionPersonaContext()
    );
    if (active !== 'client') {
      throw new HttpException(
        'Only clients can reorder an order',
        HttpStatus.FORBIDDEN
      );
    }
    if (!(user as { client?: { id?: string } }).client?.id) {
      throw new HttpException(
        'Client profile is missing',
        HttpStatus.FORBIDDEN
      );
    }
  }

  private async loadOrder(orderId: string): Promise<ReorderOrderRow> {
    const result = await this.hasuraSystemService.executeQuery<{
      orders_by_pk: ReorderOrderRow | null;
    }>(ORDER_FOR_REORDER_QUERY, { orderId });
    const order = result.orders_by_pk;
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    return order;
  }

  private assertOrderOwner(order: ReorderOrderRow, userId: string): void {
    if (order.client?.user_id !== userId) {
      throw new HttpException(
        'Unauthorized to reorder this order',
        HttpStatus.FORBIDDEN
      );
    }
  }

  private assertEligibleStatus(status: string): void {
    if (!REORDER_ELIGIBLE_STATUSES.has(status)) {
      throw new HttpException(
        'Reorder is only available for completed orders',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private resolveFulfillmentType(
    method?: string | null
  ): ReorderFulfillmentType {
    if (method === 'pickup' || method === 'shipping') return method;
    return 'delivery';
  }

  private resolveNavigationHint(input: {
    lineCount: number;
    originalCount: number;
    accepting: boolean;
    addressValid: boolean;
    fulfillmentType: ReorderFulfillmentType;
  }): ReorderNavigationHint {
    if (input.lineCount === 0) return 'none';
    if (input.fulfillmentType === 'shipping') return 'cart';
    if (input.lineCount < input.originalCount) return 'cart';
    if (!input.accepting || !input.addressValid) return 'cart';
    return 'checkout';
  }

  private async resolveAddressValid(
    order: ReorderOrderRow,
    type: ReorderFulfillmentType
  ): Promise<boolean> {
    if (type === 'pickup') {
      return order.business_location?.is_active === true;
    }
    if (type === 'shipping') {
      return true;
    }
    return this.isDeliveryAddressValid(order);
  }

  private async isDeliveryAddressValid(order: ReorderOrderRow): Promise<boolean> {
    const address = order.delivery_address;
    if (!address?.id) return false;
    const locAddress = order.business_location?.address;
    try {
      const result = await this.deliveryAvailabilityService.evaluate({
        businessId: order.business_id,
        businessLocationId: order.business_location_id,
        sellerCountry: (locAddress?.country ?? '').trim(),
        sellerState: (locAddress?.state ?? '').trim(),
        pickupLat:
          locAddress?.latitude != null ? Number(locAddress.latitude) : null,
        pickupLon:
          locAddress?.longitude != null ? Number(locAddress.longitude) : null,
        deliveryAddressId: address.id,
        deliveryLat: address.latitude != null ? Number(address.latitude) : null,
        deliveryLon:
          address.longitude != null ? Number(address.longitude) : null,
        deliveryCountry: address.country ?? undefined,
        deliveryState: address.state ?? undefined,
        clientId: order.client?.id,
        evaluatedAt: new Date(),
      });
      return result.available === true;
    } catch (error: any) {
      this.logger.warn(
        `Delivery availability check failed for reorder ${order.id}: ${error?.message}`
      );
      return false;
    }
  }

  private async buildLines(
    order: ReorderOrderRow,
    accepting: boolean
  ): Promise<{ lines: ReorderLineDto[]; skipped: ReorderSkippedDto[] }> {
    const items = order.order_items ?? [];
    if (items.length === 0) return { lines: [], skipped: [] };

    const ids = [...new Set(items.map((i) => i.business_inventory_id))];
    const inventoryById = await this.loadInventoryMap(ids);
    const stripeCountries = await fetchStripeEnabledCountries(
      this.hasuraSystemService
    );

    const lines: ReorderLineDto[] = [];
    const skipped: ReorderSkippedDto[] = [];
    for (const item of items) {
      const result = this.resolveLine(
        item,
        inventoryById.get(item.business_inventory_id),
        stripeCountries,
        accepting
      );
      if (result.ok) lines.push(result.line);
      else skipped.push(result.skipped);
    }
    return { lines, skipped };
  }

  private async loadInventoryMap(
    ids: string[]
  ): Promise<Map<string, any>> {
    const result = await this.hasuraSystemService.executeQuery<{
      business_inventory: any[];
    }>(INVENTORY_FOR_REORDER_QUERY, { ids });
    return new Map(
      (result.business_inventory ?? []).map((row) => [row.id, row])
    );
  }

  private resolveLine(
    item: ReorderOrderRow['order_items'][number],
    inv: any | undefined,
    stripeCountries: string[],
    accepting: boolean
  ): LineResolveResult {
    const name = item.item_name || inv?.item?.name || 'Item';
    const skip = this.skipReason(inv, stripeCountries, name);
    if (skip) return { ok: false, skipped: { name, reason: skip } };

    try {
      const resolved = resolveShopperVariant({
        requestedVariantId: item.item_variant_id,
        inventoryRow: inv,
      }) as { id?: string; name?: string; price?: number } | null;
      const variant =
        resolved?.id != null
          ? { id: resolved.id, name: resolved.name, price: resolved.price }
          : null;
      return {
        ok: true,
        line: this.toReorderLine(item, inv, variant, accepting),
      };
    } catch (error: any) {
      if (error instanceof ShopperVariantResolveException) {
        return {
          ok: false,
          skipped: { name, reason: 'variant_unavailable' },
        };
      }
      throw error;
    }
  }

  private skipReason(
    inv: any | undefined,
    stripeCountries: string[],
    _name: string
  ): ReorderSkipReason | null {
    if (!inv || !inv.is_active || inv.business_location?.is_active !== true) {
      return 'unavailable';
    }
    if (inv.item?.export_available === true) return 'not_orderable';
    if (!isLocationPaymentsEnabled(inv.business_location, stripeCountries)) {
      return 'unavailable';
    }
    const foodBlock = checkFoodOrderable(inv);
    if (foodBlock) return 'not_orderable';
    const ignoresStock = cookedFoodIgnoresStock(
      inv.item?.item_sub_category?.item_category?.name,
      inv.item?.is_cooked_food
    );
    if (!ignoresStock) {
      const available = Number(inv.computed_available_quantity ?? 0);
      if (available <= 0) return 'out_of_stock';
    }
    return null;
  }

  private toReorderLine(
    item: ReorderOrderRow['order_items'][number],
    inv: any,
    variant: { id: string; name?: string; price?: number } | null,
    accepting: boolean
  ): ReorderLineDto {
    const ordered = Math.max(1, Number(item.quantity) || 1);
    const ignoresStock = cookedFoodIgnoresStock(
      inv.item?.item_sub_category?.item_category?.name,
      inv.item?.is_cooked_food
    );
    const stock = ignoresStock
      ? ordered
      : Number(inv.computed_available_quantity ?? 0);
    const maxQty = inv.item?.max_order_quantity
      ? Number(inv.item.max_order_quantity)
      : ignoresStock
        ? ordered
        : stock;
    const quantity = Math.max(
      1,
      Math.min(ordered, ignoresStock ? ordered : stock, maxQty)
    );
    const unitPrice = resolveEffectiveUnitPrice({
      inventorySellingPrice: inv.selling_price,
      variant,
      overrides: inv.variant_price_overrides ?? [],
    });
    const imageUrl = inv.item?.item_images?.[0]?.image_url ?? null;
    const sellerCountry =
      inv.business_location?.address?.country?.trim()?.toUpperCase() || null;

    return {
      business_inventory_id: inv.id,
      item_id: inv.item?.id ?? item.item_id,
      item_variant_id: variant?.id ?? item.item_variant_id ?? null,
      quantity,
      ordered_quantity: ordered,
      variant_name: variant?.name ?? item.variant_name ?? null,
      business_location_id: inv.business_location?.id,
      item_data: {
        name: inv.item?.name ?? item.item_name ?? 'Item',
        price: unitPrice,
        currency: inv.item?.currency ?? 'XAF',
        image_url: imageUrl,
        max_order_quantity: inv.item?.max_order_quantity ?? null,
        min_order_quantity: inv.item?.min_order_quantity ?? null,
        pay_on_delivery_enabled: inv.item?.pay_on_delivery_enabled ?? null,
        business_name: inv.business_location?.business?.name ?? null,
        seller_country: sellerCountry,
        merchant_can_accept_orders: accepting,
      },
    };
  }
}

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { DateTime } from 'luxon';
import { AccountsService } from '../accounts/accounts.service';
import { AddressesService } from '../addresses/addresses.service';
import { AgentHoldService } from '../agents/agent-hold.service';
import { CommissionsService } from '../commissions/commissions.service';
import type { Configuration } from '../config/configuration';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { DeliveryWindowsService } from '../delivery/delivery-windows.service';
import {
  Addresses,
  Business_Inventory,
  Delivery_Time_Windows,
  Order_Holds,
  Order_Items,
  Orders,
} from '../generated/graphql';
import { GoogleDistanceService } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService, OrderItem } from '../hasura/hasura-user.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MobilePaymentsDatabaseService } from '../mobile-payments/mobile-payments-database.service';
import {
  MobilePaymentIntegrationProvider,
  MobilePaymentsService,
} from '../mobile-payments/mobile-payments.service';
import {
  NotificationData,
  NotificationsService,
} from '../notifications/notifications.service';
import { PdfService } from '../pdf/pdf.service';
import type { PersonaId } from '../users/persona.types';
import {
  isActivePersona,
  resolveActivePersona,
  resolveActivePersonaWithDefault,
} from '../users/persona.util';
import {
  DEFAULT_USER_TIMEZONE,
  isValidIanaTimezone,
  parseCalendarDatePartsFromPreferredDate,
  timezoneFromAddressCountryCode,
} from '../users/user-timezone.util';
import { DeliveryPinService } from './delivery-pin.service';
import { OrderQueueService } from './order-queue.service';
import { OrderRefundsService } from './order-refunds.service';
import { OrderStatusService } from './order-status.service';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

export interface OrderStatusChangeRequest {
  orderId: string;
  notes?: string;
  failure_reason_id?: string; // Required for fail_delivery endpoint
}

export interface BatchOrderStatusChangeRequest {
  orderIds: string[];
  notes?: string;
  failure_reason_id?: string;
}

export interface BatchOrderStatusChangeItemResult {
  orderId: string;
  success: boolean;
  message: string;
  // The updated order object (shape depends on the underlying operation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order?: any;
}

export interface BatchOrderStatusChangeResult {
  success: boolean;
  results: BatchOrderStatusChangeItemResult[];
}

export interface ConfirmOrderRequest {
  orderId: string;
  notes?: string;
  // Optional: either provide existing window ID or create new window
  delivery_time_window_id?: string;
  delivery_window_details?: {
    slot_id: string;
    preferred_date: string;
    special_instructions?: string;
  };
}

export interface GetOrderRequest {
  orderId: string;
  phone_number?: string;
}

export interface ClaimAvailabilityResponse {
  success: boolean;
  orderOpenStatus: boolean;
  hasEnoughFundsForHold: boolean;
  needsTopUpToClaim: boolean;
  holdAmount: number;
  message: string;
}

export interface CompleteDeliveryRequest {
  orderId: string;
  pin?: string;
  overwriteCode?: string;
}

/** order_holds row including settlement timestamps (GraphQL schema after migration). */
type OrderHoldWithSettlement = Order_Holds & {
  item_settlement_completed_at?: string | null;
  delivery_settlement_completed_at?: string | null;
};

// Custom interface for complex order data with all relationships
export interface OrderWithDetails {
  id: string;
  order_number: string;
  client_id: string;
  business_id: string;
  business_location_id: string;
  assigned_agent_id?: string;
  delivery_address_id: string;
  subtotal: number;
  base_delivery_fee: number;
  per_km_delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  current_status: string;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  special_instructions?: string;
  preferred_delivery_time?: string;
  payment_method?: string;
  payment_status?: string;
  verified_agent_delivery?: boolean;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  access_reason: string;
  client?: {
    id: string;
    user_id: string;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone_number: string;
    };
  };
  business?: {
    id: string;
    user_id: string;
    name: string;
    is_admin: boolean;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone_number: string;
    };
  };
  business_location?: {
    id: string;
    name: string;
    location_type: string;
    address: {
      id: string;
      address_line_1: string;
      address_line_2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
      latitude?: number;
      longitude?: number;
    };
  };
  delivery_address?: {
    id: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    latitude?: number;
    longitude?: number;
  };
  assigned_agent?: {
    id: string;
    user_id: string;
    is_verified: boolean;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone_number: string;
    };
  };
  order_items?: Array<{
    id: string;
    business_inventory_id: string;
    item_id: string;
    item_name: string;
    item_description?: string;
    unit_price: number;
    quantity: number;
    total_price: number;
    special_instructions?: string;
    item?: {
      id: string;
      sku: string;
      name: string;
      description?: string;
      currency: string;
      model?: string;
      color?: string;
      weight?: number;
      weight_unit?: string;
      dimensions?: string;
      brand?: {
        id: string;
        name: string;
        description?: string;
      };
      item_sub_category?: {
        id: string;
        name: string;
        description?: string;
        item_category: {
          id: string;
          name: string;
          description?: string;
        };
      };
      item_images?: Array<{
        id: string;
        image_url: string;
        alt_text?: string;
        display_order: number;
      }>;
    };
  }>;
  order_status_history?: Array<{
    id: string;
    order_id: string;
    status: string;
    previous_status?: string;
    notes?: string;
    changed_by_type: string;
    changed_by_user_id: string;
    created_at: string;
    changed_by_user: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      agent?: {
        id: string;
        user: {
          first_name: string;
          last_name: string;
          email: string;
        };
      };
      business?: {
        id: string;
        name: string;
        user: {
          first_name: string;
          last_name: string;
          email: string;
        };
      };
      client?: {
        id: string;
        user: {
          first_name: string;
          last_name: string;
          email: string;
        };
      };
    };
  }>;
  order_holds?: Array<{
    id: string;
    client_id: string;
    agent_id: string;
    client_hold_amount: number;
    agent_hold_amount: number;
    delivery_fees: number;
    currency: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  delivery_time_windows?: Array<Delivery_Time_Windows>;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly accountsService: AccountsService,
    private readonly configService: ConfigService<Configuration>,
    private readonly orderStatusService: OrderStatusService,
    private readonly googleDistanceService: GoogleDistanceService,
    private readonly addressesService: AddressesService,
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly mobilePaymentsDatabaseService: MobilePaymentsDatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly deliveryConfigService: DeliveryConfigService,
    private readonly deliveryWindowsService: DeliveryWindowsService,
    private readonly commissionsService: CommissionsService,
    private readonly agentHoldService: AgentHoldService,
    private readonly pdfService: PdfService,
    private readonly orderQueueService: OrderQueueService,
    private readonly waitAndExecuteScheduleService: WaitAndExecuteScheduleService,
    private readonly deliveryPinService: DeliveryPinService,
    private readonly orderRefundsService: OrderRefundsService,
    private readonly loyaltyService: LoyaltyService
  ) {}

  private requireActivePersona(
    user: any,
    persona: PersonaId,
    message: string
  ): void {
    const active = resolveActivePersonaWithDefault(
      user,
      this.hasuraUserService.getActivePersonaHeader()
    );
    if (active !== persona) {
      throw new HttpException(message, HttpStatus.FORBIDDEN);
    }
  }

  private requireAgentRecord(user: any) {
    if (!user.agent?.id) {
      throw new HttpException(
        'Agent profile is missing',
        HttpStatus.FORBIDDEN
      );
    }
    return user.agent;
  }

  private requireClientRecord(user: any) {
    if (!user.client?.id) {
      throw new HttpException(
        'Client profile is missing',
        HttpStatus.FORBIDDEN
      );
    }
    return user.client;
  }

  async getCurrentClientId(): Promise<string> {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(user, 'client', 'Only clients can validate discount codes');
    const client = this.requireClientRecord(user);
    return client.id;
  }

  private requireBusinessRecord(user: any) {
    if (!user.business?.id) {
      throw new HttpException(
        'Business profile is missing',
        HttpStatus.FORBIDDEN
      );
    }
    return user.business;
  }

  private computeUnitPriceFromInventory(
    businessInventory: any,
    deal?: { discount_type: string; discount_value: number }
  ): number {
    const base = businessInventory.selling_price;
    if (!deal) {
      return base;
    }
    if (deal.discount_type === 'percentage') {
      const discounted = base - (base * deal.discount_value) / 100;
      return discounted > 0 ? discounted : 0;
    }
    if (deal.discount_type === 'fixed') {
      const discounted = base - deal.discount_value;
      return discounted > 0 ? discounted : 0;
    }
    return base;
  }

  private async getActiveDealsByBusinessInventoryIds(
    inventoryItemIds: string[],
    now: string
  ): Promise<
    Record<
      string,
      { discount_type: string; discount_value: number; end_at: string }
    >
  > {
    if (!inventoryItemIds.length) {
      return {};
    }

    const query = `
      query GetActiveItemDeals($inventoryItemIds: [uuid!]!, $now: timestamptz!) {
        item_deals(
          where: {
            inventory_item_id: { _in: $inventoryItemIds }
            is_active: { _eq: true }
            start_at: { _lte: $now }
            end_at: { _gte: $now }
          }
        ) {
          inventory_item_id
          discount_type
          discount_value
          end_at
        }
      }
    `;

    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        inventoryItemIds,
        now,
      });
      const deals =
        (response.item_deals as Array<{
          inventory_item_id: string;
          discount_type: string;
          discount_value: number;
          end_at: string;
        }>) ?? [];

      const result: Record<
        string,
        { discount_type: string; discount_value: number; end_at: string }
      > = {};

      deals.forEach((deal) => {
        if (!result[deal.inventory_item_id]) {
          result[deal.inventory_item_id] = {
            discount_type: deal.discount_type,
            discount_value: deal.discount_value,
            end_at: deal.end_at,
          };
        }
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to fetch item deals for order pricing:', error);
      return {};
    }
  }

  private async processBatch(
    request: BatchOrderStatusChangeRequest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (orderId: string) => Promise<{ order: any; message: string }>
  ): Promise<BatchOrderStatusChangeResult> {
    if (!request.orderIds?.length) {
      throw new HttpException(
        'At least one orderId is required',
        HttpStatus.BAD_REQUEST
      );
    }

    const results: BatchOrderStatusChangeItemResult[] = [];

    for (const orderId of request.orderIds) {
      try {
        const response = await handler(orderId);
        results.push({
          orderId,
          success: true,
          message: response.message,
          order: response.order,
        });
      } catch (error: any) {
        const message =
          error?.response?.data?.error || error.message || 'Unknown error';
        results.push({ orderId, success: false, message });
      }
    }

    return {
      success: results.some((result) => result.success),
      results,
    };
  }

  /**
   * Transform order delivery fees to show agent commission amounts (optimized version)
   */
  transformOrderForAgentSync(
    order: any,
    isAgentVerified: boolean,
    commissionConfig: any,
    holdPercentage: number
  ): any {
    try {
      // Calculate agent commissions using synchronous method
      const earnings = this.commissionsService.calculateAgentEarningsSync(
        {
          id: order.id,
          base_delivery_fee: order.base_delivery_fee,
          per_km_delivery_fee: order.per_km_delivery_fee,
          currency: order.currency,
          first_order_delivery_fee_promo: order.first_order_delivery_fee_promo,
        },
        isAgentVerified,
        commissionConfig
      );

      // Calculate agent hold amount (needed to claim the order)
      // Note: We need subtotal for this calculation, but it will be removed from the response
      const agentHoldAmount =
        order.subtotal !== undefined
          ? (order.subtotal * holdPercentage) / 100
          : 0;

      // Remove financial fields and order_holds, add delivery_commission and agent_hold_amount
      const {
        base_delivery_fee: _base_delivery_fee,
        per_km_delivery_fee: _per_km_delivery_fee,
        subtotal: _subtotal,
        total_amount: _total_amount,
        order_holds: _order_holds,
        ...restOrder
      } = order;

      // Restrict order_items to agent-allowed fields only (no name, image, brand)
      const orderItems = restOrder.order_items?.map((item: any) => {
        const {
          unit_price: _unit_price,
          total_price: _total_price,
          item_name: _item_name,
          item_description: _item_description,
          ...restItem
        } = item;
        const it = restItem.item;
        const restrictedItem =
          it == null
            ? undefined
            : {
                weight: it.weight,
                weight_unit: it.weight_unit,
                dimensions: it.dimensions,
                is_fragile: it.is_fragile,
                is_perishable: it.is_perishable,
                item_sub_category: it.item_sub_category
                  ? {
                      name: it.item_sub_category.name,
                      item_category: it.item_sub_category.item_category
                        ? { name: it.item_sub_category.item_category.name }
                        : undefined,
                    }
                  : undefined,
              };
        return { ...restItem, item: restrictedItem };
      });

      return {
        ...restOrder,
        delivery_commission: earnings.totalEarnings,
        agent_hold_amount: agentHoldAmount,
        order_items: orderItems,
      };
    } catch (error: any) {
      this.logger.warn(
        `Failed to transform order ${order.id} for agent: ${error.message}`
      );
      // Return original order if transformation fails
      return order;
    }
  }

  /**
   * Transform order delivery fees to show agent commission amounts
   */
  async transformOrderForAgent(
    order: any,
    isAgentVerified: boolean
  ): Promise<any> {
    try {
      // Calculate agent commissions
      const earnings = await this.commissionsService.calculateAgentEarnings(
        order.id,
        isAgentVerified
      );

      // Replace delivery fees with agent commission amounts
      return {
        ...order,
        base_delivery_fee: earnings.baseDeliveryCommission,
        per_km_delivery_fee: earnings.perKmDeliveryCommission,
      };
    } catch (error: any) {
      this.logger.warn(
        `Failed to transform order ${order.id} for agent: ${error.message}`
      );
      // Return original order if transformation fails
      return order;
    }
  }

  /**
   * Transform multiple orders to show agent commission amounts (optimized version)
   */
  transformOrdersForAgentSync(
    orders: any[],
    isAgentVerified: boolean,
    commissionConfig: any,
    holdPercentage: number
  ): any[] {
    try {
      return orders.map((order) =>
        this.transformOrderForAgentSync(
          order,
          isAgentVerified,
          commissionConfig,
          holdPercentage
        )
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to transform orders for agent: ${error.message}`
      );
      // Return original orders if transformation fails
      return orders;
    }
  }

  private extractOrderCurrencies(orders: any[]): string[] {
    const currencies = orders
      .map((order) => order.currency)
      .filter((currency): currency is string => Boolean(currency));
    return Array.from(new Set(currencies));
  }

  private async getAgentCautionByCurrencies(
    userId: string,
    currencies: string[]
  ): Promise<Map<string, number>> {
    if (currencies.length === 0) {
      return new Map();
    }

    const cautionEntries = await Promise.all(
      currencies.map(async (currency) => {
        const account = await this.hasuraSystemService.getAccount(userId, currency);
        return [currency, Number(account?.available_balance ?? 0)] as const;
      })
    );

    return new Map(cautionEntries);
  }

  private async attachAgentCautionAmounts(
    userId: string,
    orders: any[]
  ): Promise<any[]> {
    if (!orders.length) {
      return orders;
    }

    const currencies = this.extractOrderCurrencies(orders);
    const cautionByCurrency = await this.getAgentCautionByCurrencies(
      userId,
      currencies
    );

    return orders.map((order) => ({
      ...order,
      agent_caution_amount: cautionByCurrency.get(order.currency) ?? 0,
    }));
  }

  /**
   * Transform multiple orders to show agent commission amounts
   */
  async transformOrdersForAgent(
    orders: any[],
    isAgentVerified: boolean
  ): Promise<any[]> {
    try {
      return Promise.all(
        orders.map((order) =>
          this.transformOrderForAgent(order, isAgentVerified)
        )
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to transform orders for agent: ${error.message}`
      );
      // Return original orders if transformation fails
      return orders;
    }
  }

  /**
   * Check if current user is an agent and get verification status
   */
  private async getAgentInfo(): Promise<{
    isAgent: boolean;
    isVerified: boolean;
  } | null> {
    try {
      const user = await this.hasuraUserService.getUser();
      if (!isActivePersona(user, 'agent') || !user.agent) {
        return { isAgent: false, isVerified: false };
      }

      return {
        isAgent: true,
        isVerified: user.agent.is_verified || false,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to get agent info: ${error.message}`);
      return null;
    }
  }

  private async confirmExistingDeliveryWindow(
    windowId: string,
    orderId: string,
    confirmedBy: string,
    timezone: string
  ): Promise<string> {
    // Verify the delivery window exists and belongs to this order
    const query = `
      query GetDeliveryWindow($windowId: uuid!) {
        delivery_time_windows_by_pk(id: $windowId) {
          id
          order_id
          is_confirmed
          preferred_date
          time_slot_start
          time_slot_end
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      windowId,
    });

    const window = result.delivery_time_windows_by_pk;
    if (!window) {
      throw new HttpException(
        'Delivery time window not found',
        HttpStatus.NOT_FOUND
      );
    }

    if (window.order_id !== orderId) {
      throw new HttpException(
        'Delivery time window does not belong to this order',
        HttpStatus.BAD_REQUEST
      );
    }

    if (window.is_confirmed) {
      throw new HttpException(
        'Delivery time window is already confirmed',
        HttpStatus.BAD_REQUEST
      );
    }

    const now = this.getCurrentTimeInTimezone(timezone);
    const [startHours, startMinutes] = window.time_slot_start
      .split(':')
      .map(Number);
    const windowDateTime = this.createDateTimeInTimezone(
      window.preferred_date,
      startHours,
      startMinutes,
      timezone
    );

    if (windowDateTime < now) {
      throw new HttpException(
        'Delivery time window is in the past. Please create a new time window. Current time is ' +
          now.toISOString() +
          ' and window time is ' +
          windowDateTime.toISOString(),
        HttpStatus.BAD_REQUEST
      );
    }

    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    if (windowDateTime < twoHoursFromNow) {
      throw new HttpException(
        'Delivery time window must be at least 2 hours from now. Please create a new time window. Current time is ' +
          now.toISOString() +
          ' and window time is ' +
          windowDateTime.toISOString(),
        HttpStatus.BAD_REQUEST
      );
    }

    // Update the delivery window to confirmed
    const updateQuery = `
      mutation UpdateDeliveryWindow($windowId: uuid!, $confirmedBy: uuid!) {
        update_delivery_time_windows_by_pk(
          pk_columns: { id: $windowId }
          _set: {
            is_confirmed: true
            confirmed_at: "now()"
            confirmed_by: $confirmedBy
          }
        ) {
          id
        }
      }
    `;

    await this.hasuraSystemService.executeQuery(updateQuery, {
      windowId,
      confirmedBy,
    });

    return windowId;
  }

  private async createConfirmedDeliveryWindow(
    details: {
      slot_id: string;
      preferred_date: string;
      special_instructions?: string;
    },
    orderId: string,
    confirmedBy: string,
    timezone: string
  ): Promise<string> {
    // First, get the slot details to extract time_slot_start and time_slot_end
    const slotQuery = `
      query GetSlot($slotId: uuid!) {
        delivery_time_slots_by_pk(id: $slotId) {
          id
          start_time
          end_time
          is_active
        }
      }
    `;

    const slotResult = await this.hasuraSystemService.executeQuery(slotQuery, {
      slotId: details.slot_id,
    });

    const slot = slotResult.delivery_time_slots_by_pk;
    if (!slot) {
      throw new HttpException(
        'Delivery time slot not found',
        HttpStatus.NOT_FOUND
      );
    }

    if (!slot.is_active) {
      throw new HttpException(
        'Delivery time slot is not active',
        HttpStatus.BAD_REQUEST
      );
    }

    const now = this.getCurrentTimeInTimezone(timezone);
    const [startHours, startMinutes] = slot.start_time.split(':').map(Number);
    const windowDateTime = this.createDateTimeInTimezone(
      details.preferred_date,
      startHours,
      startMinutes,
      timezone
    );

    if (windowDateTime < now) {
      throw new HttpException(
        'Delivery time window is in the past. Please select a time that is at least 2 hours from now. Current time is ' +
          now.toISOString() +
          ' and window time is ' +
          windowDateTime.toISOString(),
        HttpStatus.BAD_REQUEST
      );
    }

    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    if (windowDateTime < twoHoursFromNow) {
      throw new HttpException(
        'Delivery time window must be at least 2 hours from now. Please select a later time. Current time is ' +
          now.toISOString() +
          ' and window time is ' +
          windowDateTime.toISOString(),
        HttpStatus.BAD_REQUEST
      );
    }

    // Check if a delivery window already exists for this order
    const checkQuery = `
      query GetExistingWindow($orderId: uuid!) {
        delivery_time_windows(where: { order_id: { _eq: $orderId } }) {
          id
          is_confirmed
        }
      }
    `;

    const checkResult = await this.hasuraSystemService.executeQuery(
      checkQuery,
      {
        orderId,
      }
    );

    const existingWindow = checkResult.delivery_time_windows?.[0];

    if (existingWindow) {
      // Update existing delivery window
      const updateQuery = `
        mutation UpdateDeliveryWindow(
          $windowId: uuid!
          $slotId: uuid!
          $preferredDate: date!
          $timeSlotStart: time!
          $timeSlotEnd: time!
          $confirmedBy: uuid!
          $specialInstructions: String
        ) {
          update_delivery_time_windows_by_pk(
            pk_columns: { id: $windowId }
            _set: {
              slot_id: $slotId
              preferred_date: $preferredDate
              time_slot_start: $timeSlotStart
              time_slot_end: $timeSlotEnd
              is_confirmed: true
              confirmed_at: "now()"
              confirmed_by: $confirmedBy
              special_instructions: $specialInstructions
            }
          ) {
            id
          }
        }
      `;

      const updateResult = await this.hasuraSystemService.executeQuery(
        updateQuery,
        {
          windowId: existingWindow.id,
          slotId: details.slot_id,
          preferredDate: details.preferred_date,
          timeSlotStart: slot.start_time,
          timeSlotEnd: slot.end_time,
          confirmedBy,
          specialInstructions: details.special_instructions || null,
        }
      );

      return updateResult.update_delivery_time_windows_by_pk.id;
    } else {
      // Create new delivery window
      const createQuery = `
        mutation CreateDeliveryWindow($data: delivery_time_windows_insert_input!) {
          insert_delivery_time_windows_one(object: $data) {
            id
          }
        }
      `;

      const result = await this.hasuraSystemService.executeQuery(createQuery, {
        data: {
          order_id: orderId,
          slot_id: details.slot_id,
          preferred_date: details.preferred_date,
          time_slot_start: slot.start_time,
          time_slot_end: slot.end_time,
          is_confirmed: true,
          confirmed_at: 'now()',
          confirmed_by: confirmedBy,
          special_instructions: details.special_instructions,
        },
      });

      return result.insert_delivery_time_windows_one.id;
    }
  }

  private async updateOrderDeliveryWindow(
    orderId: string,
    windowId: string
  ): Promise<void> {
    const query = `
      mutation UpdateOrderDeliveryWindow($orderId: uuid!, $windowId: uuid!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { delivery_time_window_id: $windowId }
        ) {
          id
        }
      }
    `;

    await this.hasuraSystemService.executeQuery(query, {
      orderId,
      windowId,
    });
  }

  async confirmOrder(request: ConfirmOrderRequest) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'business',
      'Only business users can confirm orders'
    );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.business.user_id !== user.id)
      throw new HttpException(
        'Unauthorized to confirm this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'pending')
      throw new HttpException(
        `Cannot confirm order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    // Validate that delivery window is provided
    if (!request.delivery_time_window_id && !request.delivery_window_details) {
      throw new HttpException(
        'Delivery time window must be provided to confirm order',
        HttpStatus.BAD_REQUEST
      );
    }

    // Validate that only one option is provided
    if (request.delivery_time_window_id && request.delivery_window_details) {
      throw new HttpException(
        'Cannot provide both delivery_time_window_id and delivery_window_details',
        HttpStatus.BAD_REQUEST
      );
    }

    let confirmedWindowId: string;

    const countryCode = order.delivery_address?.country || 'GA';
    const deliveryTimezone = await this.resolveOrderDeliveryTimezone(
      order,
      countryCode
    );

    if (request.delivery_time_window_id) {
      confirmedWindowId = await this.confirmExistingDeliveryWindow(
        request.delivery_time_window_id,
        request.orderId,
        user.id,
        deliveryTimezone
      );
    } else if (request.delivery_window_details) {
      confirmedWindowId = await this.createConfirmedDeliveryWindow(
        request.delivery_window_details,
        request.orderId,
        user.id,
        deliveryTimezone
      );
    } else {
      throw new HttpException(
        'No delivery window provided',
        HttpStatus.BAD_REQUEST
      );
    }

    // Update order with confirmed delivery window and status
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'confirmed'
    );

    // Update order's delivery_time_window_id
    await this.updateOrderDeliveryWindow(request.orderId, confirmedWindowId);

    await this.createStatusHistoryEntry(
      request.orderId,
      'confirmed',
      'Order confirmed by business',
      'business',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order confirmed successfully',
    };
  }

  async completePreparation(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'business',
      'Only business users can complete order preparation'
    );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.business.user_id !== user.id)
      throw new HttpException(
        'Unauthorized to complete preparation for this order',
        HttpStatus.FORBIDDEN
      );
    if (!['confirmed', 'preparing'].includes(order.current_status))
      throw new HttpException(
        `Cannot complete preparation for order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'ready_for_pickup'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'ready_for_pickup',
      'Order preparation completed, ready for pickup',
      'business',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order preparation completed successfully',
    };
  }

  async completePreparationBatch(
    request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResult> {
    return this.processBatch(request, (orderId) =>
      this.completePreparation({ orderId, notes: request.notes })
    );
  }

  async claimOrder(request: GetOrderRequest) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agent users can get orders'
    );
    const agent = this.requireAgentRecord(user);
    const agentStatus = await this.getAgentStatus(agent.id);
    if (agentStatus === 'suspended') {
      throw new HttpException(
        'Your account is suspended. You cannot claim orders. Contact support.',
        HttpStatus.FORBIDDEN
      );
    }
    const order = await this.getOrderWithItems(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.current_status !== 'ready_for_pickup')
      throw new HttpException(
        `Cannot get order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    // Check if order requires internal agent (high-value orders)
    if (order.verified_agent_delivery && !agent.is_internal) {
      throw new HttpException(
        'This order requires an internal agent. Contact support to become an internal agent.',
        HttpStatus.FORBIDDEN
      );
    }
    const holdPercentage =
      await this.agentHoldService.getHoldPercentageForAgent();
    const holdAmount = (order.subtotal * holdPercentage) / 100;
    const agentAccount = await this.hasuraSystemService.getAccount(
      user.id,
      order.currency
    );
    if (!agentAccount)
      throw new HttpException(
        `No account found for currency ${order.currency}`,
        HttpStatus.BAD_REQUEST
      );

    // When hold is 0 (e.g. internal agent), skip balance checks
    if (holdAmount > 0) {
      if (Number(agentAccount.available_balance) < 0) {
        throw new HttpException(
          `Account balance is negative. Please top up your account before claiming orders. Current balance: ${agentAccount.available_balance} ${order.currency}`,
          HttpStatus.FORBIDDEN
        );
      }
      if (Number(agentAccount.available_balance) < holdAmount)
        throw new HttpException(
          `Insufficient balance. Required: ${holdAmount} ${order.currency}, Available: ${agentAccount.available_balance} ${order.currency}`,
          HttpStatus.FORBIDDEN
        );
    }

    // Block if another agent has a pending claim (claim-with-topup) on this order
    const hasPendingClaim =
      await this.mobilePaymentsDatabaseService.hasPendingClaimOrderForOrderNumber(
        order.order_number
      );
    if (hasPendingClaim) {
      throw new HttpException(
        {
          message:
            'This order has a pending claim. Another agent may be completing payment. Please choose another order.',
          error: 'PENDING_CLAIM',
        },
        HttpStatus.CONFLICT
      );
    }

    const orderHold = await this.getOrCreateOrderHold(order.id);

    await this.updateOrderHold(orderHold.id, {
      agent_hold_amount: holdAmount,
      agent_id: agent.id,
    });

    if (holdAmount > 0) {
      await this.accountsService.registerTransaction({
        accountId: agentAccount.id,
        amount: holdAmount,
        transactionType: 'hold',
        memo: `Hold for order ${order.order_number}`,
        referenceId: order.id,
      });
    }

    const updatedOrder = await this.assignOrderToAgent(
      request.orderId,
      agent.id,
      'assigned_to_agent'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'assigned_to_agent',
      `Order assigned to agent ${user.first_name} ${user.last_name}`,
      'agent',
      user.id
    );
    return {
      success: true,
      order: updatedOrder,
      holdAmount,
      message: 'Order assigned successfully',
    };
  }

  async claimOrderWithTopup(request: GetOrderRequest) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agent users can claim orders'
    );
    const agent = this.requireAgentRecord(user);
    const agentStatus = await this.getAgentStatus(agent.id);
    if (agentStatus === 'suspended') {
      throw new HttpException(
        'Your account is suspended. You cannot claim orders. Contact support.',
        HttpStatus.FORBIDDEN
      );
    }

    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4);
    const reference = `C${timestamp}${random}`;

    const order = await this.getOrderWithItems(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.current_status !== 'ready_for_pickup')
      throw new HttpException(
        `Cannot claim order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    // Check if order requires internal agent (high-value orders)
    if (order.verified_agent_delivery && !agent.is_internal) {
      throw new HttpException(
        'This order requires an internal agent. Contact support to become an internal agent.',
        HttpStatus.FORBIDDEN
      );
    }

    // Get hold percentage and calculate required amount
    const holdPercentage =
      await this.agentHoldService.getHoldPercentageForAgent();
    const holdAmount = (order.subtotal * holdPercentage) / 100;

    // When hold is 0 (e.g. internal agent), skip payment and assign directly
    if (holdAmount === 0) {
      const orderHold = await this.getOrCreateOrderHold(order.id);
      await this.updateOrderHold(orderHold.id, {
        agent_hold_amount: 0,
        agent_id: agent.id,
      });
      const updatedOrder = await this.assignOrderToAgent(
        request.orderId,
        agent.id,
        'assigned_to_agent'
      );
      await this.createStatusHistoryEntry(
        request.orderId,
        'assigned_to_agent',
        `Order assigned to agent ${user.first_name} ${user.last_name}`,
        'agent',
        user.id
      );
      return {
        success: true,
        order: updatedOrder,
        holdAmount: 0,
        message: 'Order assigned successfully',
      };
    }

    // Block if another agent has a pending claim (claim-with-topup) on this order
    const hasPendingClaim =
      await this.mobilePaymentsDatabaseService.hasPendingClaimOrderForOrderNumber(
        order.order_number
      );
    if (hasPendingClaim) {
      throw new HttpException(
        {
          message:
            'This order has a pending claim. Another agent may be completing payment. Please choose another order.',
          error: 'PENDING_CLAIM',
        },
        HttpStatus.CONFLICT
      );
    }

    // Get or create agent account
    const agentAccount = await this.hasuraSystemService.getAccount(
      user.id,
      order.currency
    );

    // Get payment provider based on phone number (use provided phone_number or fallback to user's phone_number)
    const phoneNumber = request.phone_number || user.phone_number || '';
    const provider = this.getProvider(phoneNumber);

    // Create transaction record before initiating payment
    let paymentTransaction = null;
    let transaction = null;
    try {
      // Create transaction record in database
      transaction = await this.mobilePaymentsDatabaseService.createTransaction({
        reference: reference,
        amount: holdAmount,
        currency: order.currency,
        description: `Claim order ${order.order_number}`,
        provider: provider,
        payment_method: 'mobile_money',
        customer_phone: phoneNumber,
        customer_email: user.email,
        account_id: agentAccount.id,
        transaction_type: 'PAYMENT',
        payment_entity: 'claim_order' as const,
        entity_id: order.order_number,
      });

      const paymentRequest = {
        amount: holdAmount,
        currency: order.currency,
        description: `claim ${order.order_number}`,
        customerPhone: phoneNumber,
        provider: provider,
        ownerCharge: 'CUSTOMER' as const,
        transactionType: 'PAYMENT' as const,
        payment_entity: 'claim_order' as const,
      };

      paymentTransaction = await this.mobilePaymentsService.initiatePayment(
        paymentRequest,
        reference,
        user.id
      );

      if (!paymentTransaction.success) {
        // Update transaction status to failed
        await this.mobilePaymentsDatabaseService.updateTransaction(
          transaction.id,
          {
            status: 'failed',
            error_message: paymentTransaction.message,
            error_code: paymentTransaction.errorCode,
          }
        );

        throw new HttpException(
          {
            success: false,
            message: 'Failed to initiate payment',
            error: 'PAYMENT_INITIATION_FAILED',
            data: {
              orderNumber: order.order_number,
              error: paymentTransaction.message,
              errorCode: paymentTransaction.errorCode,
            },
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Update transaction with provider response
      if (paymentTransaction.success && paymentTransaction.transactionId) {
        await this.mobilePaymentsDatabaseService.updateTransaction(
          transaction.id,
          {
            transaction_id: paymentTransaction.transactionId,
          }
        );
      }

      this.logger.log(
        `Payment initiated successfully for claim order ${order.order_number}, transaction ID: ${paymentTransaction.transactionId}`
      );

      // Schedule payment timeout (wait-and-execute state machine)
      try {
        await this.waitAndExecuteScheduleService.schedulePaymentTimeout(
          'order.claim_initiated',
          { order_id: order.id, transaction_id: transaction.id }
        );
      } catch (scheduleError: any) {
        this.logger.error(
          `Failed to schedule payment timeout for claim order ${order.order_number}: ${scheduleError?.message ?? scheduleError}`
        );
      }

      return {
        success: true,
        paymentTransaction: {
          transactionId: paymentTransaction.transactionId,
          success: paymentTransaction.success,
        },
        holdAmount,
        phoneNumber,
        message: 'Order claimed with topup payment initiated successfully',
      };
    } catch (error: any) {
      // If it's already an HttpException, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }

      // Log the error and throw a generic error
      this.logger.error(
        `Failed to claim order with topup: ${error.message}`,
        error.stack
      );

      throw new HttpException(
        {
          success: false,
          message: 'Failed to claim order with topup',
          error: 'CLAIM_ORDER_TOPUP_FAILED',
          data: {
            orderId: request.orderId,
            error: error.message,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async cancelClaimRequest(request: GetOrderRequest) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agent users can cancel claim requests'
    );
    const agent = this.requireAgentRecord(user);

    const order = await this.getOrderWithItems(request.orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    if (order.current_status !== 'ready_for_pickup') {
      throw new HttpException(
        `Cannot cancel claim request for order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    }

    if (order.assigned_agent_id && order.assigned_agent_id !== agent.id) {
      throw new HttpException(
        'You are not authorized to cancel this claim request',
        HttpStatus.FORBIDDEN
      );
    }

    const pendingClaimTransaction =
      await this.mobilePaymentsDatabaseService.getPendingClaimOrderTransactionByCustomerEmailAndOrderNumber(
        user.email,
        order.order_number
      );

    if (!pendingClaimTransaction) {
      throw new HttpException(
        'No pending claim request found for this order',
        HttpStatus.NOT_FOUND
      );
    }

    if (pendingClaimTransaction.transaction_id) {
      try {
        const cancelledAtProvider =
          await this.mobilePaymentsService.cancelTransaction(
            pendingClaimTransaction.transaction_id,
            pendingClaimTransaction.provider
          );

        if (!cancelledAtProvider) {
          this.logger.warn(
            `Provider cancellation failed for pending claim transaction ${pendingClaimTransaction.transaction_id}. Marking local transaction as cancelled.`
          );
        }
      } catch (providerError: any) {
        this.logger.warn(
          `Provider cancellation threw for pending claim transaction ${pendingClaimTransaction.transaction_id}: ${providerError?.message ?? providerError}`
        );
      }
    }

    await this.mobilePaymentsDatabaseService.updateTransaction(
      pendingClaimTransaction.id,
      {
        status: 'cancelled',
        error_message: 'Cancelled by agent',
        error_code: 'CLAIM_REQUEST_CANCELLED',
      }
    );

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      message: 'Claim request cancelled successfully',
    };
  }

  async pickUpOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agent users can pick up orders'
    );
    const agent = this.requireAgentRecord(user);
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== agent.id)
      throw new HttpException(
        'Only the assigned agent can pick up this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'assigned_to_agent')
      throw new HttpException(
        `Cannot pick up order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    const paymentTiming = (order as any).payment_timing as
      | 'pay_now'
      | 'pay_at_delivery'
      | undefined;
    if (paymentTiming !== 'pay_at_delivery') {
      await this.processOrderPayment(request.orderId);
    }
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'picked_up'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'picked_up',
      'Order picked up by agent',
      'agent',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order picked up successfully',
    };
  }

  async pickUpOrderBatch(
    request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResult> {
    return this.processBatch(request, (orderId) =>
      this.pickUpOrder({ orderId, notes: request.notes })
    );
  }

  async startTransit(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agent users can start transit'
    );
    const agent = this.requireAgentRecord(user);
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== agent.id)
      throw new HttpException(
        'Only the assigned agent can start transit for this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'picked_up')
      throw new HttpException(
        `Cannot start transit for order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'in_transit'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'in_transit',
      'Order in transit to customer',
      'agent',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order transit started successfully',
    };
  }

  async startTransitBatch(
    request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResult> {
    return this.processBatch(request, (orderId) =>
      this.startTransit({ orderId, notes: request.notes })
    );
  }

  async outForDelivery(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agent users can mark orders as out for delivery'
    );
    const agent = this.requireAgentRecord(user);
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== agent.id)
      throw new HttpException(
        'Only the assigned agent can mark this order as out for delivery',
        HttpStatus.FORBIDDEN
      );
    if (
      order.current_status !== 'in_transit' &&
      order.current_status !== 'picked_up'
    )
      throw new HttpException(
        `Cannot mark order as out for delivery in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'out_for_delivery'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'out_for_delivery',
      'Agent out for delivery to customer',
      'agent',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order marked as out for delivery successfully',
    };
  }

  async outForDeliveryBatch(
    request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResult> {
    return this.processBatch(request, (orderId) =>
      this.outForDelivery({ orderId, notes: request.notes })
    );
  }

  async deliverOrder(
    request: OrderStatusChangeRequest
  ): Promise<{ order: any; message: string }> {
    throw new HttpException(
      'This endpoint is deprecated. Use POST /orders/complete-delivery with the delivery PIN or overwrite code to complete the order.',
      HttpStatus.GONE
    );
  }

  async deliverOrderBatch(
    request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResult> {
    return this.processBatch(request, (orderId) =>
      this.deliverOrder({ orderId, notes: request.notes })
    );
  }

  async completeOrder(_request: OrderStatusChangeRequest) {
    throw new HttpException(
      'Order completion is now done by the delivery agent using the PIN. Please share your delivery PIN with the agent at delivery.',
      HttpStatus.GONE
    );
  }

  /**
   * Complete delivery with PIN or overwrite code (agent only). One-step out_for_delivery -> complete.
   * On 3 wrong PIN attempts: record one strike; suspend agent only if 3 strikes in current month.
   */
  async completeDelivery(request: CompleteDeliveryRequest) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agent users can complete delivery'
    );
    const agent = this.requireAgentRecord(user);
    const hasPin = !!request.pin?.trim();
    const hasOverwrite = !!request.overwriteCode?.trim();
    if (!hasPin && !hasOverwrite) {
      throw new HttpException(
        'Either pin or overwriteCode is required',
        HttpStatus.BAD_REQUEST
      );
    }
    if (hasPin && hasOverwrite) {
      throw new HttpException(
        'Provide either pin or overwriteCode, not both',
        HttpStatus.BAD_REQUEST
      );
    }

    const order = await this.getOrderDetails(request.orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (order.assigned_agent_id !== agent.id) {
      throw new HttpException(
        'Only the assigned agent can complete this delivery',
        HttpStatus.FORBIDDEN
      );
    }
    if (order.current_status !== 'out_for_delivery') {
      throw new HttpException(
        `Cannot complete delivery in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    }

    const agentStatus = (order as any).assigned_agent?.status;
    if (agentStatus === 'suspended') {
      throw new HttpException(
        'Your account is suspended. You cannot complete deliveries. Contact support.',
        HttpStatus.FORBIDDEN
      );
    }

    const attempts = (order as any).delivery_pin_attempts ?? 0;
    if (attempts >= this.deliveryPinService.getMaxPinAttempts()) {
      if (hasPin) {
        throw new HttpException(
          'Maximum PIN attempts reached for this order. Use an overwrite code from the business if available.',
          HttpStatus.FORBIDDEN
        );
      }
    }

    if (hasPin) {
      const hash = (order as any).delivery_pin_hash;
      if (!hash) {
        throw new HttpException(
          'This order has no delivery PIN set.',
          HttpStatus.BAD_REQUEST
        );
      }
      const valid = this.deliveryPinService.verifyPin(
        request.orderId,
        request.pin!,
        hash
      );
      if (!valid) {
        const newAttempts = attempts + 1;
        await this.incrementOrderDeliveryPinAttempts(request.orderId);
        if (newAttempts >= this.deliveryPinService.getMaxPinAttempts()) {
          await this.recordPinFailedStrikeAndMaybeSuspend(
            agent.id,
            request.orderId
          );
          throw new HttpException(
            'Maximum PIN attempts reached. A strike has been recorded. Use an overwrite code from the business if available.',
            HttpStatus.FORBIDDEN
          );
        }
        throw new HttpException('Invalid PIN', HttpStatus.FORBIDDEN);
      }
    } else {
      const overwriteHash = (order as any).delivery_overwrite_code_hash;
      if (!overwriteHash) {
        throw new HttpException(
          'No overwrite code has been set for this order. Ask the business to generate one.',
          HttpStatus.BAD_REQUEST
        );
      }
      const valid = this.deliveryPinService.verifyOverwriteCode(
        request.orderId,
        request.overwriteCode!,
        overwriteHash
      );
      if (!valid) {
        throw new HttpException('Invalid overwrite code', HttpStatus.FORBIDDEN);
      }
      await this.setOrderDeliveryOverwriteUsedAt(request.orderId);
    }

    await this.processOrderDeliveryPayment(request.orderId);

    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'complete'
    );
    await this.setOrderCompletedAt(request.orderId);
    await this.createStatusHistoryEntry(
      request.orderId,
      'complete',
      hasPin
        ? 'Order completed by agent (PIN verified)'
        : 'Order completed by agent (overwrite code used)',
      'agent',
      user.id
    );

    try {
      const orderItems = order.order_items || [];
      await this.updateInventoryOnCompletion(orderItems);
    } catch (error: any) {
      this.logger.error(
        `Failed to update inventory after completion: ${error.message}`
      );
    }
    try {
      await this.pdfService.generateReceipt(order.id, order.client.user_id);
    } catch (error: any) {
      this.logger.error(`Failed to generate receipt: ${error.message}`);
    }
    try {
      await this.orderQueueService.sendOrderCompletedMessage(order.id);
    } catch (error: any) {
      this.logger.error(
        `Failed to send order.completed message: ${error.message}`
      );
    }
    try {
      await this.handleOrderCompletionRewards(order.id);
    } catch (error: any) {
      this.logger.error(
        `Failed to handle loyalty rewards after completion: ${error.message}`
      );
    }

    this.deliveryPinService.clearPinForOrder(order.id);

    return {
      success: true,
      order: updatedOrder,
      message: 'Delivery completed successfully',
    };
  }

  private async setOrderCompletedAt(orderId: string): Promise<void> {
    const at = new Date().toISOString();
    const mutation = `
      mutation SetOrderCompletedAt($orderId: uuid!, $at: timestamptz!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { completed_at: $at, updated_at: "now()" }
        ) {
          id
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      at,
    });
  }

  private async handleOrderCompletionRewards(orderId: string): Promise<void> {
    try {
      const order = await this.getOrderForLoyalty(orderId);
      if (!order || order.current_status !== 'complete') return;

      await this.maybeCreateFirstOrderCodeAndEmail(order);
      await this.maybeRewardDiscountCodeOwner(order);
    } catch (error: any) {
      this.logger.error(
        `Failed to handle loyalty rewards for order ${orderId}: ${error.message}`
      );
    }
  }

  private async getOrderForLoyalty(orderId: string): Promise<{
    id: string;
    client_id: string;
    discount_code_id: string | null;
    current_status: string;
    client: {
      user: {
        email: string;
        preferred_language: string | null;
        first_name: string | null;
        last_name: string | null;
      } | null;
    } | null;
  } | null> {
    const query = `
      query GetOrderForLoyalty($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          client_id
          discount_code_id
          current_status
          client {
            user {
              email
              preferred_language
              first_name
              last_name
            }
          }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      orders_by_pk: any | null;
    }>(query, { orderId });
    return res.orders_by_pk ?? null;
  }

  private async countCompletedOrdersForClient(clientId: string): Promise<number> {
    const query = `
      query CountCompletedOrdersForClient($clientId: uuid!) {
        orders_aggregate(
          where: { client_id: { _eq: $clientId }, current_status: { _eq: "complete" } }
        ) {
          aggregate { count }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      orders_aggregate: { aggregate: { count: number } | null } | null;
    }>(query, { clientId });
    return res.orders_aggregate?.aggregate?.count ?? 0;
  }

  private async hasDiscountCodeForClientAndOrder(
    clientId: string,
    orderId: string
  ): Promise<boolean> {
    const query = `
      query HasDiscountCodeForClientAndOrder($clientId: uuid!, $orderId: uuid!) {
        order_discount_codes_aggregate(
          where: {
            created_for_client_id: { _eq: $clientId },
            created_for_order_id: { _eq: $orderId },
            discount_type: { _eq: "first_order_discount_code" }
          }
        ) {
          aggregate { count }
        }
      }
    `;
    const res = await this.hasuraSystemService.executeQuery<{
      order_discount_codes_aggregate: { aggregate: { count: number } | null } | null;
    }>(query, { clientId, orderId });
    return (res.order_discount_codes_aggregate?.aggregate?.count ?? 0) > 0;
  }

  private async maybeCreateFirstOrderCodeAndEmail(order: {
    id: string;
    client_id: string;
    client: {
      user: {
        email: string;
        preferred_language: string | null;
        first_name: string | null;
        last_name: string | null;
      } | null;
    } | null;
  }): Promise<void> {
    const completedCount = await this.countCompletedOrdersForClient(order.client_id);
    if (completedCount !== 1) return;

    const alreadyCreated = await this.hasDiscountCodeForClientAndOrder(
      order.client_id,
      order.id
    );
    if (alreadyCreated) return;

    const code = await this.loyaltyService.generateDiscountCode({
      clientId: order.client_id,
      orderId: order.id,
    });

    const publicWebAppUrl =
      this.configService.get('publicWebAppUrl') || 'https://rendasua.com';
    const orderUrl = `${String(publicWebAppUrl).replace(/\/$/, '')}/orders/${order.id}`;
    const user = order.client?.user;
    if (!user?.email) return;

    await this.notificationsService.sendFirstOrderCompletedEmail({
      to: user.email,
      preferredLanguage: user.preferred_language,
      clientName: [user.first_name, user.last_name].filter(Boolean).join(' ').trim(),
      discountCode: code.code,
      orderUrl,
    });
  }

  private async maybeRewardDiscountCodeOwner(order: {
    id: string;
    client_id: string;
    discount_code_id: string | null;
  }): Promise<void> {
    if (!order.discount_code_id) return;

    const owner = await this.loyaltyService.getCodeOwner(order.discount_code_id);
    if (!owner || owner.clientId === order.client_id) return;

    const alreadyCreated = await this.hasDiscountCodeForClientAndOrder(
      owner.clientId,
      order.id
    );
    if (alreadyCreated) return;

    const rewardCode = await this.loyaltyService.generateDiscountCode({
      clientId: owner.clientId,
      orderId: order.id,
    });

    await this.notificationsService.sendReferralRewardEmail({
      to: owner.email,
      preferredLanguage: owner.preferredLanguage,
      clientName: [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim(),
      discountCode: rewardCode.code,
    });
  }

  private async incrementOrderDeliveryPinAttempts(orderId: string): Promise<void> {
    const order = await this.getOrderDetails(orderId);
    const current = (order as any)?.delivery_pin_attempts ?? 0;
    const mutation = `
      mutation IncrementDeliveryPinAttempts($orderId: uuid!, $newAttempts: Int!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { delivery_pin_attempts: $newAttempts }
        ) {
          id
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      newAttempts: current + 1,
    });
  }

  private async setOrderDeliveryOverwriteUsedAt(orderId: string): Promise<void> {
    const mutation = `
      mutation SetOverwriteUsedAt($orderId: uuid!, $usedAt: timestamptz!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { delivery_overwrite_code_used_at: $usedAt }
        ) {
          id
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      usedAt: new Date().toISOString(),
    });
  }

  private async recordPinFailedStrikeAndMaybeSuspend(
    agentId: string,
    orderId: string
  ): Promise<void> {
    const existingQuery = `
      query ExistingStrike($agentId: uuid!, $orderId: uuid!, $reason: String!) {
        agent_strikes(where: { agent_id: { _eq: $agentId }, order_id: { _eq: $orderId }, reason: { _eq: $reason } }, limit: 1) {
          id
          created_at
        }
      }
    `;
    const existing = await this.hasuraSystemService.executeQuery(
      existingQuery,
      { agentId, orderId, reason: 'pin_failed_3' }
    );
    const rows = (existing as any).agent_strikes ?? [];
    let strike = rows[0];
    if (!strike) {
      const insertMutation = `
        mutation InsertAgentStrike($agentId: uuid!, $orderId: uuid!, $reason: String!) {
          insert_agent_strikes_one(object: { agent_id: $agentId, order_id: $orderId, reason: $reason }) {
            id
            created_at
          }
        }
      `;
      const result = await this.hasuraSystemService.executeMutation(
        insertMutation,
        { agentId, orderId, reason: 'pin_failed_3' }
      );
      strike = (result as any).insert_agent_strikes_one;
    }
    if (!strike?.created_at) return;

    const countQuery = `
      query CountAgentStrikesInMonth($agentId: uuid!, $startOfMonth: timestamptz!, $endOfMonth: timestamptz!) {
        agent_strikes_aggregate(
          where: {
            agent_id: { _eq: $agentId },
            created_at: { _gte: $startOfMonth, _lte: $endOfMonth }
          }
        ) { aggregate { count } }
      }
    `;
    const created = new Date(strike.created_at);
    const startOfMonth = new Date(created.getFullYear(), created.getMonth(), 1);
    const endOfMonth = new Date(
      created.getFullYear(),
      created.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    const countResult = await this.hasuraSystemService.executeQuery(
      countQuery,
      {
        agentId,
        startOfMonth: startOfMonth.toISOString(),
        endOfMonth: endOfMonth.toISOString(),
      }
    );
    const count =
      (countResult as any).agent_strikes_aggregate?.aggregate?.count ?? 0;
    if (count >= 3) {
      const updateMutation = `
        mutation SetAgentSuspended($agentId: uuid!) {
          update_agents_by_pk(pk_columns: { id: $agentId }, _set: { status: "suspended" }) {
            id
          }
        }
      `;
      await this.hasuraSystemService.executeMutation(updateMutation, {
        agentId,
      });
    }
  }

  /**
   * Pay-at-delivery: assigned agent triggers mobile payment request at doorstep.
   */
  async initiatePayAtDeliveryPayment(orderId: string, phoneNumberOverride?: string) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agent users can initiate delivery payments'
    );
    const agent = this.requireAgentRecord(user);

    const order = await this.getOrderDetails(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (order.assigned_agent_id !== agent.id) {
      throw new HttpException(
        'Only the assigned agent can initiate delivery payment',
        HttpStatus.FORBIDDEN
      );
    }

    const paymentTiming = (order as any).payment_timing as
      | 'pay_now'
      | 'pay_at_delivery'
      | undefined;
    if (paymentTiming !== 'pay_at_delivery') {
      throw new HttpException(
        'Order is not configured for pay at delivery',
        HttpStatus.BAD_REQUEST
      );
    }
    if (order.current_status !== 'out_for_delivery') {
      throw new HttpException(
        'Pay at delivery payment can only be initiated when order is out for delivery',
        HttpStatus.BAD_REQUEST
      );
    }

    if ((order as any).payment_status === 'paid') {
      return {
        success: true,
        message: 'Order is already paid',
      };
    }

    const phoneNumber =
      phoneNumberOverride?.trim() || order.client?.user?.phone_number || '';
    if (!phoneNumber.trim()) {
      throw new HttpException(
        'Client phone number is required to initiate payment',
        HttpStatus.BAD_REQUEST
      );
    }

    const existing =
      await this.mobilePaymentsDatabaseService.getTransactionByReference(
        order.order_number
      );
    if (existing && existing.status === 'pending') {
      return {
        success: true,
        message: 'Payment request already pending',
        payment_transaction: {
          success: true,
          transaction_id: existing.transaction_id ?? null,
          message: 'Payment request already pending',
          mode: 'mobile_money' as const,
        },
        database_transaction: {
          id: existing.id,
          reference: existing.reference,
          status: existing.status,
        },
      };
    }

    const provider = this.mobilePaymentsService.getProvider(phoneNumber);
    const account = await this.hasuraSystemService.getAccount(
      order.client.user_id,
      order.currency
    );

    const tx = await this.mobilePaymentsDatabaseService.createTransaction({
      reference: order.order_number,
      amount: Number(order.total_amount),
      currency: order.currency,
      description: `order ${order.order_number} (pay at delivery)`,
      provider,
      payment_method: 'mobile_money',
      customer_phone: phoneNumber,
      customer_email: order.client.user.email,
      account_id: account.id,
      transaction_type: 'PAYMENT',
      payment_entity: 'order' as const,
      entity_id: order.order_number,
    });

    const paymentRequest = {
      amount: Number(order.total_amount),
      currency: order.currency,
      description: `Order ${order.order_number}`,
      customerPhone: phoneNumber,
      provider,
      ownerCharge: 'MERCHANT' as const,
      transactionType: 'PAYMENT' as const,
      payment_entity: 'order' as const,
    };

    const paymentTransaction = await this.mobilePaymentsService.initiatePayment(
      paymentRequest,
      order.order_number
    );

    if (!paymentTransaction.success) {
      await this.mobilePaymentsDatabaseService.updateTransaction(tx.id, {
        status: 'failed',
        error_message: paymentTransaction.message,
        error_code: paymentTransaction.errorCode,
      });
      throw new HttpException(
        paymentTransaction.message || 'Failed to initiate payment',
        HttpStatus.BAD_REQUEST
      );
    }

    if (paymentTransaction.transactionId) {
      await this.mobilePaymentsDatabaseService.updateTransaction(tx.id, {
        transaction_id: paymentTransaction.transactionId,
      });
    }

    return {
      success: true,
      message: 'Payment request initiated',
      payment_transaction: {
        success: true,
        transaction_id: paymentTransaction.transactionId,
        message: paymentTransaction.message,
        mode: 'mobile_money' as const,
      },
      database_transaction: {
        id: tx.id,
        reference: tx.reference,
        status: tx.status,
      },
    };
  }

  /**
   * Cash-exception fallback: agent marks the order paid in cash.
   * This completes the order operationally but flags it for business reconciliation.
   */
  async markPaidInCashException(orderId: string, notes?: string) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agent users can mark cash exceptions'
    );
    const agent = this.requireAgentRecord(user);

    const order = await this.getOrderDetails(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (order.assigned_agent_id !== agent.id) {
      throw new HttpException(
        'Only the assigned agent can mark a cash exception',
        HttpStatus.FORBIDDEN
      );
    }

    const paymentTiming = (order as any).payment_timing as
      | 'pay_now'
      | 'pay_at_delivery'
      | undefined;
    if (paymentTiming !== 'pay_at_delivery') {
      throw new HttpException(
        'Cash exception is only available for pay-at-delivery orders',
        HttpStatus.BAD_REQUEST
      );
    }
    if (order.current_status !== 'out_for_delivery') {
      throw new HttpException(
        'Cash exception can only be reported when order is out for delivery',
        HttpStatus.BAD_REQUEST
      );
    }
    if ((order as any).reconciliation_status === 'reconciled') {
      return { success: true, message: 'Order is already reconciled' };
    }

    const at = new Date().toISOString();
    const mutation = `
      mutation MarkCashException(
        $orderId: uuid!
        $agentId: uuid!
        $at: timestamptz!
        $notes: String
      ) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: {
            reconciliation_status: pending_manual_reconciliation
            cash_exception_reported_by_agent_id: $agentId
            cash_exception_reported_at: $at
            reconciliation_notes: $notes
            current_status: complete
            completed_at: $at
            updated_at: $at
          }
        ) {
          id
          current_status
          reconciliation_status
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      agentId: agent.id,
      at,
      notes: notes?.trim() || null,
    });

    try {
      await this.createStatusHistoryEntry(
        orderId,
        'complete',
        'Completed with cash exception (manual reconciliation required)',
        'agent',
        user.id
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to write cash-exception status history: ${error.message}`
      );
    }
    try {
      await this.orderQueueService.sendOrderCompletedMessage(orderId);
    } catch (error: any) {
      this.logger.error(
        `Failed to send order.completed for cash exception: ${error.message}`
      );
    }
    try {
      await this.handleOrderCompletionRewards(orderId);
    } catch (error: any) {
      this.logger.error(
        `Failed to handle loyalty rewards for cash exception completion: ${error.message}`
      );
    }

    return { success: true, message: 'Cash exception recorded' };
  }

  /**
   * Business reconciliation for cash-exception orders.
   * Records reference/notes and marks the exception reconciled.
   */
  async reconcileCashException(
    orderId: string,
    reference?: string,
    notes?: string
  ) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'business',
      'Only business users can reconcile cash exceptions'
    );
    const business = this.requireBusinessRecord(user);

    const order = await this.getOrderDetails(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (order.business_id !== business.id) {
      throw new HttpException(
        'You are not authorized to reconcile this order',
        HttpStatus.FORBIDDEN
      );
    }
    if ((order as any).reconciliation_status !== 'pending_manual_reconciliation') {
      throw new HttpException(
        'Order is not pending manual reconciliation',
        HttpStatus.BAD_REQUEST
      );
    }

    const at = new Date().toISOString();
    const mutation = `
      mutation ReconcileCashException(
        $orderId: uuid!
        $businessId: uuid!
        $at: timestamptz!
        $reference: String
        $notes: String
      ) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: {
            reconciliation_status: reconciled
            reconciled_by_business_id: $businessId
            reconciled_at: $at
            reconciliation_reference: $reference
            reconciliation_notes: $notes
            payment_status: "paid"
            updated_at: $at
          }
        ) {
          id
          reconciliation_status
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      businessId: business.id,
      at,
      reference: reference?.trim() || null,
      notes: notes?.trim() || null,
    });

    try {
      await this.createStatusHistoryEntry(
        orderId,
        'complete',
        'Cash exception reconciled by business',
        'business',
        user.id
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to write reconciliation status history: ${error.message}`
      );
    }

    return { success: true, message: 'Cash exception reconciled' };
  }

  /**
   * Get delivery PIN for the order's client. Client can retrieve multiple times until order is completed.
   */
  async getDeliveryPinForClient(orderId: string): Promise<{ pin: string } | null> {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'client',
      'Only the order client can retrieve the delivery PIN'
    );
    this.requireClientRecord(user);
    const order = await this.getOrderDetails(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (order.client?.user_id !== user.id) {
      throw new HttpException(
        'Only the order client can retrieve the delivery PIN',
        HttpStatus.FORBIDDEN
      );
    }
    if (order.current_status === 'complete') {
      throw new HttpException(
        'Order already completed. PIN is no longer needed.',
        HttpStatus.GONE
      );
    }
    let pin = this.deliveryPinService.getPinForClient(orderId);
    if (!pin) {
      const orderHasPinFlow = !!(order as { delivery_pin_hash?: string })
        ?.delivery_pin_hash;
      if (orderHasPinFlow) {
        pin = this.deliveryPinService.generatePin();
        const deliveryPinHash = this.deliveryPinService.hashPin(orderId, pin);
        await this.setOrderDeliveryPinHash(orderId, deliveryPinHash);
        await this.resetOrderDeliveryPinAttempts(orderId);
        this.deliveryPinService.setPinForClient(orderId, pin);
      } else {
        throw new HttpException(
          'Delivery PIN is not available. If the order was just paid, try again in a moment.',
          HttpStatus.NOT_FOUND
        );
      }
    }
    return { pin };
  }

  /**
   * Generate overwrite code for an order (business only). Returns plain code once.
   */
  async generateDeliveryOverwriteCode(orderId: string): Promise<{
    overwriteCode: string;
  }> {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'business',
      'Only the order business can generate an overwrite code'
    );
    const business = this.requireBusinessRecord(user);
    const order = await this.getOrderDetails(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (order.business_id !== business.id) {
      throw new HttpException(
        'Only the order business can generate an overwrite code',
        HttpStatus.FORBIDDEN
      );
    }
    if (order.current_status !== 'out_for_delivery') {
      throw new HttpException(
        `Overwrite code can only be generated for orders that are out for delivery (current: ${order.current_status})`,
        HttpStatus.BAD_REQUEST
      );
    }
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const hash = this.deliveryPinService.hashOverwriteCode(orderId, code);
    const mutation = `
      mutation SetOverwriteCodeHash($orderId: uuid!, $hash: String!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { delivery_overwrite_code_hash: $hash }
        ) {
          id
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      hash,
    });
    return { overwriteCode: code };
  }

  async failDelivery(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agent users can mark deliveries as failed'
    );
    const agent = this.requireAgentRecord(user);

    if (!request.failure_reason_id) {
      throw new HttpException(
        'failure_reason_id is required when marking a delivery as failed',
        HttpStatus.BAD_REQUEST
      );
    }

    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== agent.id)
      throw new HttpException(
        'Only the assigned agent can mark this delivery as failed',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'out_for_delivery')
      throw new HttpException(
        `Cannot mark delivery as failed in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    // Validate failure reason exists and is active
    const validateFailureReasonQuery = `
      query ValidateFailureReason($reasonId: uuid!) {
        delivery_failure_reasons_by_pk(id: $reasonId) {
          id
          is_active
        }
      }
    `;

    const reasonResult = await this.hasuraSystemService.executeQuery(
      validateFailureReasonQuery,
      { reasonId: request.failure_reason_id }
    );

    if (!reasonResult.delivery_failure_reasons_by_pk) {
      throw new HttpException(
        'Invalid failure reason ID',
        HttpStatus.BAD_REQUEST
      );
    }

    if (!reasonResult.delivery_failure_reasons_by_pk.is_active) {
      throw new HttpException(
        'The selected failure reason is not active',
        HttpStatus.BAD_REQUEST
      );
    }

    // Mark order status as 'failed'
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'failed'
    );

    // Create entry in failed_deliveries table with status 'pending'
    const createFailedDeliveryMutation = `
      mutation CreateFailedDelivery($failedDelivery: failed_deliveries_insert_input!) {
        insert_failed_deliveries_one(object: $failedDelivery) {
          id
          order_id
          failure_reason_id
          notes
          status
          created_at
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(
      createFailedDeliveryMutation,
      {
        failedDelivery: {
          order_id: request.orderId,
          failure_reason_id: request.failure_reason_id,
          notes: request.notes || null,
          status: 'pending',
        },
      }
    );

    // Create status history entry
    await this.createStatusHistoryEntry(
      request.orderId,
      'failed',
      'Delivery failed',
      'agent',
      user.id,
      request.notes
    );

    // Note: Hold release is now handled in the resolution workflow, not here

    return {
      success: true,
      order: updatedOrder,
      message: 'Delivery marked as failed',
    };
  }

  async cancelOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();

    // Allow both business users and clients to cancel orders
    if (!isActivePersona(user, 'business') && !isActivePersona(user, 'client'))
      throw new HttpException(
        'Only business users and clients can cancel orders',
        HttpStatus.FORBIDDEN
      );

    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);

    // Check authorization - business can cancel their orders, client can cancel their own orders
    const isBusinessOwner =
      isActivePersona(user, 'business') && order.business.user_id === user.id;
    const isOrderOwner =
      isActivePersona(user, 'client') &&
      order.client?.user_id === user.id;

    if (!isBusinessOwner && !isOrderOwner)
      throw new HttpException(
        'Unauthorized to cancel this order',
        HttpStatus.FORBIDDEN
      );

    // Client can only cancel when order is not yet assigned to an agent
    if (isOrderOwner && order.assigned_agent_id) {
      throw new HttpException(
        'Cannot cancel order that has been assigned to a delivery agent',
        HttpStatus.BAD_REQUEST
      );
    }

    // Business can cancel orders in more statuses than clients
    let cancellableStatuses: string[];
    if (isBusinessOwner) {
      cancellableStatuses = [
        'pending_payment',
        'pending',
        'confirmed',
        'preparing',
      ];
    } else {
      // Clients can cancel orders before they are picked up by delivery agent
      cancellableStatuses = [
        'pending_payment',
        'pending',
        'confirmed',
        'preparing',
        'ready_for_pickup',
      ];
    }

    if (!cancellableStatuses.includes(order.current_status))
      throw new HttpException(
        `Cannot cancel order in ${order.current_status} status. Orders can only be cancelled before pickup by delivery agent.`,
        HttpStatus.BAD_REQUEST
      );

    // Store previous status for async handler
    const previousStatus = order.current_status;

    // Update order status to cancelled
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'cancelled'
    );

    // Create appropriate status history entry based on who cancelled
    const cancelledBy = isBusinessOwner ? 'business' : 'client';
    const cancelMessage = isBusinessOwner
      ? 'Order cancelled by business'
      : 'Order cancelled by client';

    await this.createStatusHistoryEntry(
      request.orderId,
      'cancelled',
      cancelMessage,
      cancelledBy,
      user.id,
      request.notes
    );

    // Update reserved quantities - decrement since order is cancelled
    try {
      const orderItems = order.order_items || [];
      await this.updateReservedQuantities(orderItems, 'decrement');
    } catch (error) {
      this.logger.error(
        `Failed to update reserved quantities after order cancellation: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // Don't fail the cancellation if reserved quantity update fails
    }

    // Send cancellation message to async FIFO queue
    try {
      await this.orderQueueService.sendOrderCancelledMessage(
        request.orderId,
        cancelledBy,
        request.notes,
        previousStatus
      );
    } catch (error) {
      this.logger.error(
        `Failed to send order.cancelled message to SQS: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // Don't fail the cancellation if SQS message fails
    }

    return {
      success: true,
      order: updatedOrder,
      message: 'Order cancelled successfully',
    };
  }

  async refundOrder(request: OrderStatusChangeRequest) {
    return this.orderRefundsService.legacyDirectFullRefund(
      request.orderId,
      request.notes
    );
  }

  /**
   * Normalize filters to convert 'status' field to 'current_status'
   * This handles cases where filters are passed with the incorrect field name
   */
  private normalizeFilters(filters: any): any {
    if (!filters || typeof filters !== 'object') {
      return filters;
    }

    // Handle _and array
    if (Array.isArray(filters._and)) {
      return {
        ...filters,
        _and: filters._and.map((filter: any) => this.normalizeFilters(filter)),
      };
    }

    // Handle _or array
    if (Array.isArray(filters._or)) {
      return {
        ...filters,
        _or: filters._or.map((filter: any) => this.normalizeFilters(filter)),
      };
    }

    // Convert 'status' to 'current_status' if present
    if ('status' in filters && !('current_status' in filters)) {
      const { status, ...rest } = filters;
      return {
        ...rest,
        current_status: typeof status === 'string' ? { _eq: status } : status,
      };
    }

    // Convert 'current_status' string to Hasura format if needed
    if (
      'current_status' in filters &&
      typeof filters.current_status === 'string'
    ) {
      const { current_status, ...rest } = filters;
      return {
        ...rest,
        current_status: { _eq: current_status },
      };
    }

    // Recursively normalize nested objects
    const normalized: any = {};
    for (const [key, value] of Object.entries(filters)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        normalized[key] = this.normalizeFilters(value);
      } else {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  /**
   * Fetch orders for the current user (client, agent, or business) with optional filters
   */
  async getOrders(filters?: any): Promise<Orders[]> {
    const user = await this.hasuraUserService.getUser();
    const persona = resolveActivePersona(
      user,
      this.hasuraUserService.getActivePersonaHeader()
    );
    let personaFilter: any = {};
    const pendingClaimTransactionsByOrderNumber = new Map<
      string,
      { id: string; transaction_id?: string }
    >();
    if (persona === 'client') {
      if (!user.client?.id) {
        throw new HttpException(
          'Invalid user persona for orders query',
          HttpStatus.FORBIDDEN
        );
      }
      personaFilter = { client_id: { _eq: user.client.id } };
    } else if (persona === 'agent') {
      if (!user.agent?.id) {
        throw new HttpException(
          'Invalid user persona for orders query',
          HttpStatus.FORBIDDEN
        );
      }
      const pendingClaimTransactions =
        await this.mobilePaymentsDatabaseService.getPendingClaimOrderTransactionsByCustomerEmail(
          user.email
        );
      const pendingClaimOrderNumbers = pendingClaimTransactions
        .map((transaction) => transaction.entity_id)
        .filter((orderNumber) => !!orderNumber);

      pendingClaimTransactions.forEach((transaction) => {
        pendingClaimTransactionsByOrderNumber.set(transaction.entity_id, {
          id: transaction.id,
          transaction_id: transaction.transaction_id,
        });
      });

      if (pendingClaimOrderNumbers.length > 0) {
        personaFilter = {
          _or: [
            { assigned_agent_id: { _eq: user.agent.id } },
            {
              order_number: { _in: pendingClaimOrderNumbers },
              current_status: { _eq: 'ready_for_pickup' },
            },
          ],
        };
      } else {
        personaFilter = { assigned_agent_id: { _eq: user.agent.id } };
      }
    } else if (persona === 'business') {
      if (!user.business?.id) {
        throw new HttpException(
          'Invalid user persona for orders query',
          HttpStatus.FORBIDDEN
        );
      }
      personaFilter = { business_id: { _eq: user.business.id } };
    } else {
      throw new HttpException(
        'Invalid user persona for orders query',
        HttpStatus.FORBIDDEN
      );
    }

    // Normalize filters to convert 'status' to 'current_status'
    const normalizedFilters = filters
      ? this.normalizeFilters(filters)
      : undefined;

    // Merge persona filter with any additional filters
    const where = normalizedFilters
      ? { _and: [personaFilter, normalizedFilters] }
      : personaFilter;

    const query = `
      query GetBusinessOrders($filters: orders_bool_exp) {
        orders(where: $filters, order_by: {created_at: desc}) {
          id
          order_number
          client_id
          business_id
          business_location_id
          assigned_agent_id
          delivery_address_id
          subtotal
          base_delivery_fee
          per_km_delivery_fee
          tax_amount
          total_amount
          currency
          current_status
          estimated_delivery_time
          actual_delivery_time
          special_instructions
          preferred_delivery_time
          requires_fast_delivery
          payment_method
          payment_status
          created_at
          updated_at
          client {
            id
            user {
              id
              first_name
              last_name
              email
              phone_number
            }
          }
          business_location {
            id
            name
            location_type
            address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
              instructions
            }
          }
          delivery_address {
            id
            address_line_1
            address_line_2
            city
            state
            postal_code
            country
            instructions
          }
          assigned_agent {
            id
            user {
              id
              first_name
              last_name
              email
              profile_picture_url
            }
          }
          order_items {
            id
            item_name
            item_description
            unit_price
            quantity
            total_price
            special_instructions
            item {
              sku
              currency
              model
              color
              weight
              weight_unit
              dimensions
              brand {
                id
                name
              }
              item_sub_category {
                id
                name
                item_category {
                  id
                  name
                }
              }
              item_images(order_by: { display_order: asc }) {
                id
                image_url
                image_type
                display_order
              }
            }
          }
          order_status_history {
            changed_by_type
            changed_by_user {
              agent {
                user {
                  email
                  first_name
                  last_name
                }
              }
              business {
                user {
                  email
                  first_name
                  last_name
                }
              }
              client {
                user {
                  first_name
                  email
                  last_name
                }
              }
            }
            changed_by_user_id
            created_at
            id
            previous_status
            status
            notes
          }
          delivery_time_windows {
            id
            slot_id
            preferred_date
            time_slot_start
            time_slot_end
            is_confirmed
            special_instructions
            confirmed_at
            confirmed_by
            slot {
              id
              slot_name
              slot_type
              start_time
              end_time
            }
          }
          delivery_time_window_id
        }
      }

    `;

    const variables = { filters: where };
    const result = await this.hasuraSystemService.executeQuery(
      query,
      variables
    );

    const ordersWithPendingClaimMetadata = (result.orders as any[]).map(
      (order) => {
        const pendingClaimTransaction =
          pendingClaimTransactionsByOrderNumber.get(order.order_number);
        if (!pendingClaimTransaction) {
          return order;
        }

        return {
          ...order,
          is_claim_pending: true,
          claim_transaction_id:
            pendingClaimTransaction.transaction_id ??
            pendingClaimTransaction.id,
        };
      }
    );

    // Transform orders for agents to show commission amounts
    const agentInfo = await this.getAgentInfo();
    if (agentInfo?.isAgent) {
      // Get commission config and hold percentage once for all orders
      const commissionConfig =
        await this.commissionsService.getCommissionConfigs();
      const holdPercentage = await this.agentHoldService.getHoldPercentageForAgent();
      return this.transformOrdersForAgentSync(
        ordersWithPendingClaimMetadata,
        agentInfo.isVerified,
        commissionConfig,
        holdPercentage
      );
    }

    return ordersWithPendingClaimMetadata;
  }

  async getOpenOrders() {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agent users can view open orders'
    );
    const agent = this.requireAgentRecord(user);

    if (!agent.is_verified) {
      return { success: true, orders: [] };
    }

    // Get agent's address information
    const agentAddresses = await this.hasuraSystemService.getAllUserAddresses(
      user.id,
      'agent'
    );

    if (!agentAddresses || agentAddresses.length === 0) {
      // Return empty result if agent has no addresses
      return { success: true, orders: [] };
    }

    // Get the primary address or first address
    const agentAddress =
      agentAddresses.find((addr) => addr.is_primary) || agentAddresses[0];
    const agentCountry = agentAddress.country;
    const agentState = agentAddress.state;

    // Query for orders in ready_for_pickup and assigned_agent_id is null
    // Note: base_delivery_fee and per_km_delivery_fee are kept in query for commission calculation
    // subtotal is kept for agent_hold_amount calculation
    // but all financial fields will be removed in transformation. Financial fields like total_amount,
    // order_holds, and order item prices are excluded.
    const query = `
      query OpenOrders {
        orders(where: {current_status: {_eq: "ready_for_pickup"}, assigned_agent_id: {_is_null: true}}) {
          id
          order_number
          subtotal
          base_delivery_fee
          per_km_delivery_fee
          business {
            name
          }
          client {
              user {
                id
                first_name
                last_name
                phone_number
                email
              }
            }
          business_location {
            id
            name
            address {
              address_line_1
              city
              state
              country
              postal_code
              instructions
            }
          }
          
          delivery_address {
            address_line_1
            city
            state
            country
            postal_code
            instructions
          }
          currency
          current_status
          verified_agent_delivery
          created_at
          order_items {
            id
            quantity
            special_instructions
            item {
              weight
              weight_unit
              dimensions
              is_fragile
              is_perishable
              item_sub_category {
                name
                item_category {
                  name
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query);

    // Exclude orders with a pending claim_order mobile payment (another agent may be completing topup)
    const pendingClaimOrderNumbers =
      await this.mobilePaymentsDatabaseService.getOrderNumbersWithPendingClaimOrder();
    const ordersExcludingPendingClaim = (result.orders as any[]).filter(
      (o) => !pendingClaimOrderNumbers.includes(o.order_number)
    );

    // Filter orders based on agent's location matching business location
    const filteredOrders = ordersExcludingPendingClaim.filter((order: any) => {
      const businessLocation = order.business_location;
      if (!businessLocation || !businessLocation.address) {
        return false;
      }

      const businessCountry = businessLocation.address.country;
      const businessState = businessLocation.address.state;

      // Check if country and state match
      return businessCountry === agentCountry && businessState === agentState;
    });

    // Transform orders for agents to show commission amounts
    const commissionConfig =
      await this.commissionsService.getCommissionConfigs();
    const holdPercentage = await this.agentHoldService.getHoldPercentageForAgent();
    const transformedOrders = this.transformOrdersForAgentSync(
      filteredOrders,
      agent.is_verified || false,
      commissionConfig,
      holdPercentage
    );

    const ordersWithAgentCaution = await this.attachAgentCautionAmounts(
      user.id,
      transformedOrders
    );

    return { success: true, orders: ordersWithAgentCaution };
  }

  async checkOrderClaimAvailability(
    orderId: string
  ): Promise<ClaimAvailabilityResponse> {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agent users can claim orders'
    );
    const agent = this.requireAgentRecord(user);

    const order = await this.getOrderWithItems(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    const holdPercentage =
      await this.agentHoldService.getHoldPercentageForAgent();
    const holdAmount = (order.subtotal * holdPercentage) / 100;

    const agentStatus = await this.getAgentStatus(agent.id);
    if (agentStatus === 'suspended') {
      return this.createClaimAvailabilityFailure(
        holdAmount,
        'Your account is suspended. You cannot claim orders. Contact support.'
      );
    }

    if (order.current_status !== 'ready_for_pickup') {
      return this.createClaimAvailabilityFailure(
        holdAmount,
        'This order is no longer open for claim.'
      );
    }

    if (order.assigned_agent_id) {
      return this.createClaimAvailabilityFailure(
        holdAmount,
        'This order is no longer open for claim.'
      );
    }

    if (order.verified_agent_delivery && !agent.is_internal) {
      return this.createClaimAvailabilityFailure(
        holdAmount,
        'This order requires an internal agent. Contact support to become an internal agent.'
      );
    }

    const hasPendingClaim =
      await this.mobilePaymentsDatabaseService.hasPendingClaimOrderForOrderNumber(
        order.order_number
      );
    if (hasPendingClaim) {
      return this.createClaimAvailabilityFailure(
        holdAmount,
        'This order has a pending claim. Another agent may be completing payment. Please choose another order.'
      );
    }

    if (holdAmount <= 0) {
      return {
        success: true,
        orderOpenStatus: true,
        hasEnoughFundsForHold: true,
        needsTopUpToClaim: false,
        holdAmount,
        message: 'Order is open and available to claim',
      };
    }

    const agentAccount = await this.hasuraSystemService.getAccount(
      user.id,
      order.currency
    );
    const availableBalance = Number(agentAccount?.available_balance ?? 0);
    const hasEnoughFundsForHold = availableBalance >= holdAmount;

    return {
      success: true,
      orderOpenStatus: true,
      hasEnoughFundsForHold,
      needsTopUpToClaim: !hasEnoughFundsForHold,
      holdAmount,
      message: hasEnoughFundsForHold
        ? 'Order is open and available to claim'
        : 'Top up is required before claiming this order',
    };
  }

  /**
   * Get a specific order by ID with access control
   * Accessible by:
   * - Business that owns the order (order.business_id or business with is_admin=true)
   * - Client that made the order (order.client_id)
   * - Agent assigned to the order (order.assigned_agent_id)
   */
  async getOrderById(orderId: string): Promise<OrderWithDetails> {
    const user = await this.hasuraUserService.getUser();

    // First, get the order to check ownership
    const order = await this.getOrderDetails(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    // Check access permissions
    let hasAccess = false;
    let accessReason = '';

    if (isActivePersona(user, 'business') && user.business) {
      // Business users can access if they own the order or are admin
      if (order.business_id === user.business.id) {
        hasAccess = true;
        accessReason = 'business_owner';
      } else if (user.business.is_admin) {
        hasAccess = true;
        accessReason = 'admin_business';
      }
    } else if (
      isActivePersona(user, 'client') &&
      order.client?.user_id === user.id
    ) {
      // Client can access their own orders
      hasAccess = true;
      accessReason = 'order_client';
    } else if (
      isActivePersona(user, 'agent') &&
      user.agent &&
      (order.assigned_agent_id === user.agent.id ||
        order.assigned_agent_id === null)
    ) {
      // Agent can access orders assigned to them
      hasAccess = true;
      accessReason = 'assigned_agent';
    }

    if (!hasAccess) {
      throw new HttpException(
        'Unauthorized to access this order',
        HttpStatus.FORBIDDEN
      );
    }

    // Get comprehensive order data with all relationships
    // For agents, exclude financial fields (total_amount, order_holds, order item prices)
    // but keep base_delivery_fee, per_km_delivery_fee, and subtotal for commission and hold amount calculation
    const isAgent = isActivePersona(user, 'agent');
    const query = isAgent
      ? `
      query GetOrderById($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          client_id
          business_id
          business_location_id
          assigned_agent_id
          delivery_address_id
          subtotal
          base_delivery_fee
          per_km_delivery_fee
          first_order_delivery_fee_promo
          currency
          current_status
          estimated_delivery_time
          actual_delivery_time
          special_instructions
          preferred_delivery_time
          requires_fast_delivery
          payment_method
          payment_status
          verified_agent_delivery
          created_at
          updated_at
          completed_at
          client {
            id
            user_id
            user {
              id
              first_name
              last_name
              email
              phone_number
            }
          }
          business {
            id
            user_id
            name
            is_admin
            user {
              id
              first_name
              last_name
              email
              phone_number
            }
          }
          business_location {
            id
            name
            location_type
            address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
              latitude
              longitude
              instructions
            }
          }
          delivery_address {
            id
            address_line_1
            address_line_2
            city
            state
            postal_code
            country
            latitude
            longitude
            instructions
          }
          assigned_agent {
            id
            user_id
            is_verified
            user {
              id
              first_name
              last_name
              email
              phone_number
              profile_picture_url
            }
          }
          order_items {
            id
            quantity
            special_instructions
            item {
              weight
              weight_unit
              dimensions
              is_fragile
              is_perishable
              item_sub_category {
                name
                item_category {
                  name
                }
              }
            }
          }
          order_status_history {
            id
            order_id
            status
            previous_status
            notes
            changed_by_type
            changed_by_user_id
            created_at
            changed_by_user {
              id
              first_name
              last_name
              email
              agent {
                id
                user {
                  first_name
                  last_name
                  email
                }
              }
              business {
                id
                name
                user {
                  first_name
                  last_name
                  email
                }
              }
              client {
                id
                user {
                  first_name
                  last_name
                  email
                }
              }
            }
          }
          delivery_time_windows {
            id
            order_id
            slot_id
            preferred_date
            time_slot_start
            time_slot_end
            is_confirmed
            special_instructions
            confirmed_at
            confirmed_by
            created_at
            updated_at
            slot {
              id
              slot_name
              slot_type
              start_time
              end_time
              is_active
            }
            confirmedByUser {
              id
              first_name
              last_name
              email
            }
          }
        }
      }
    `
      : `
      query GetOrderById($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          client_id
          business_id
          business_location_id
          assigned_agent_id
          delivery_address_id
          subtotal
          base_delivery_fee
          per_km_delivery_fee
          first_order_delivery_fee_promo
          tax_amount
          total_amount
          currency
          current_status
          estimated_delivery_time
          actual_delivery_time
          special_instructions
          preferred_delivery_time
          requires_fast_delivery
          payment_method
          payment_status
          verified_agent_delivery
          created_at
          updated_at
          completed_at
          client {
            id
            user_id
            user {
              id
              first_name
              last_name
              email
              phone_number
            }
          }
          business {
            id
            user_id
            name
            is_admin
            user {
              id
              first_name
              last_name
              email
              phone_number
            }
          }
          business_location {
            id
            name
            location_type
            address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
              latitude
              longitude
            }
          }
          delivery_address {
            id
            address_line_1
            address_line_2
            city
            state
            postal_code
            country
            latitude
            longitude
          }
          assigned_agent {
            id
            user_id
            is_verified
            user {
              id
              first_name
              last_name
              email
              phone_number
              profile_picture_url
            }
          }
          order_items {
            id
            business_inventory_id
            item_id
            item_name
            item_description
            unit_price
            quantity
            total_price
            special_instructions
            item {
              id
              sku
              name
              description
              currency
              model
              color
              weight
              weight_unit
              dimensions
              brand {
                id
                name
                description
              }
              item_sub_category {
                id
                name
                description
                item_category {
                  id
                  name
                  description
                }
              }
              item_images(order_by: { display_order: asc }) {
                id
                image_url
                alt_text
                image_type
                display_order
              }
            }
          }
          order_status_history {
            id
            order_id
            status
            previous_status
            notes
            changed_by_type
            changed_by_user_id
            created_at
            changed_by_user {
              id
              first_name
              last_name
              email
              agent {
                id
                user {
                  first_name
                  last_name
                  email
                }
              }
              business {
                id
                name
                user {
                  first_name
                  last_name
                  email
                }
              }
              client {
                id
                user {
                  first_name
                  last_name
                  email
                }
              }
            }
          }
          delivery_time_windows {
            id
            order_id
            slot_id
            preferred_date
            time_slot_start
            time_slot_end
            is_confirmed
            special_instructions
            confirmed_at
            confirmed_by
            created_at
            updated_at
            slot {
              id
              slot_name
              slot_type
              start_time
              end_time
              is_active
            }
            confirmedByUser {
              id
              first_name
              last_name
              email
            }
          }
          order_holds {
            id
            client_id
            agent_id
            client_hold_amount
            agent_hold_amount
            delivery_fees
            currency
            status
            created_at
            updated_at
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
    });

    const orderData = result.orders_by_pk;
    if (!orderData) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    // Transform order for agents to show commission amounts
    const agentInfo = await this.getAgentInfo();
    if (agentInfo?.isAgent) {
      const commissionConfig =
        await this.commissionsService.getCommissionConfigs();
      const holdPercentage = await this.agentHoldService.getHoldPercentageForAgent();
      const transformedOrder = this.transformOrderForAgentSync(
        orderData,
        agentInfo.isVerified,
        commissionConfig,
        holdPercentage
      );
      return {
        ...transformedOrder,
        access_reason: accessReason,
      };
    }

    return {
      ...orderData,
      access_reason: accessReason,
    };
  }

  /**
   * Get all messages for a specific order
   * Accessible by:
   * - Business that owns the order (order.business_id or business with is_admin=true)
   * - Client that made the order (order.client_id)
   * - Agent assigned to the order (order.assigned_agent_id)
   */
  async getOrderMessages(orderId: string) {
    const user = await this.hasuraUserService.getUser();

    // First, get the order to check ownership
    const order = await this.getOrderDetails(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    // Check access permissions (same logic as getOrderById)
    let hasAccess = false;

    if (isActivePersona(user, 'business') && user.business) {
      if (order.business_id === user.business.id || user.business.is_admin) {
        hasAccess = true;
      }
    } else if (
      isActivePersona(user, 'client') &&
      order.client?.user_id === user.id
    ) {
      hasAccess = true;
    } else if (
      isActivePersona(user, 'agent') &&
      user.agent &&
      (order.assigned_agent_id === user.agent.id ||
        order.assigned_agent_id === null)
    ) {
      hasAccess = true;
    }

    if (!hasAccess) {
      throw new HttpException(
        'Unauthorized to access messages for this order',
        HttpStatus.FORBIDDEN
      );
    }

    // Query messages for this order
    const query = `
      query GetOrderMessages($orderId: uuid!, $entityType: entity_types_enum!) {
        user_messages(
          where: {
            entity_id: { _eq: $orderId }
            entity_type: { _eq: $entityType }
          }
          order_by: { created_at: desc }
        ) {
          id
          user_id
          entity_type
          entity_id
          message
          created_at
          updated_at
          user {
            id
            email
            first_name
            last_name
          }
          entity_type_info {
            id
            comment
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
      entityType: 'order',
    });

    return result.user_messages || [];
  }

  /**
   * Create a new message for a specific order
   * Accessible by:
   * - Business that owns the order (order.business_id or business with is_admin=true)
   * - Client that made the order (order.client_id)
   * - Agent assigned to the order (order.assigned_agent_id)
   */
  async createOrderMessage(orderId: string, message: string) {
    const user = await this.hasuraUserService.getUser();

    // First, get the order to check ownership
    const order = await this.getOrderDetails(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    // Check access permissions (same logic as getOrderById)
    let hasAccess = false;

    if (isActivePersona(user, 'business') && user.business) {
      if (order.business_id === user.business.id || user.business.is_admin) {
        hasAccess = true;
      }
    } else if (
      isActivePersona(user, 'client') &&
      order.client?.user_id === user.id
    ) {
      hasAccess = true;
    } else if (
      isActivePersona(user, 'agent') &&
      user.agent &&
      (order.assigned_agent_id === user.agent.id ||
        order.assigned_agent_id === null)
    ) {
      hasAccess = true;
    }

    if (!hasAccess) {
      throw new HttpException(
        'Unauthorized to post messages for this order',
        HttpStatus.FORBIDDEN
      );
    }

    // Validate message
    if (!message || !message.trim()) {
      throw new HttpException(
        'Message cannot be empty',
        HttpStatus.BAD_REQUEST
      );
    }

    // Create the message
    const mutation = `
      mutation CreateOrderMessage($user_id: uuid!, $entity_type: entity_types_enum!, $entity_id: uuid!, $message: String!) {
        insert_user_messages_one(object: {
          user_id: $user_id,
          entity_type: $entity_type,
          entity_id: $entity_id,
          message: $message
        }) {
          id
          user_id
          entity_type
          entity_id
          message
          created_at
          updated_at
          user {
            id
            email
            first_name
            last_name
          }
          entity_type_info {
            id
            comment
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeMutation(mutation, {
      user_id: user.id,
      entity_type: 'order',
      entity_id: orderId,
      message: message.trim(),
    });

    if (!result.insert_user_messages_one) {
      throw new HttpException(
        'Failed to create message',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    return result.insert_user_messages_one;
  }

  async dropOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agent users can drop orders'
    );
    const agent = this.requireAgentRecord(user);
    // Get the order and check if assigned to this agent and in assigned_to_agent status
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.current_status !== 'assigned_to_agent') {
      throw new HttpException(
        'Order is not in assigned_to_agent status',
        HttpStatus.BAD_REQUEST
      );
    }
    if (order.assigned_agent_id !== agent.id) {
      throw new HttpException(
        'You are not assigned to this order',
        HttpStatus.FORBIDDEN
      );
    }
    // Clear assigned_agent_id and set status to ready_for_pickup
    const mutation = `
      mutation DropOrder($orderId: uuid!) {
        update_orders_by_pk(pk_columns: {id: $orderId}, _set: {assigned_agent_id: null, current_status: "ready_for_pickup"}) {
          id
          current_status
          assigned_agent_id
        }
      }
    `;
    const result = await this.hasuraSystemService.executeMutation(mutation, {
      orderId: request.orderId,
    });
    // Add order status history entry
    await this.createStatusHistoryEntry(
      request.orderId,
      'ready_for_pickup',
      'Order dropped by agent and made available for other agents',
      'agent',
      user.id
    );

    const agentAccount = await this.hasuraSystemService.getAccount(
      user.id,
      order.currency
    );

    const orderHold = await this.getOrCreateOrderHold(order.id);

    await this.updateOrderHold(orderHold.id, {
      status: 'cancelled',
    });

    await this.accountsService.registerTransaction({
      accountId: agentAccount.id,
      amount: orderHold.agent_hold_amount,
      transactionType: 'release',
      memo: `Hold released for order ${order.order_number}. Order dropped by agent and made available for other agents.`,
      referenceId: order.id,
    });
    return {
      success: true,
      order: result.update_orders_by_pk,
      message: 'Order dropped and made available for other agents.',
    };
  }

  /**
   * Get current time in UTC
   * @param _timezone - IANA timezone identifier (unused, kept for API consistency)
   * @returns Date object representing the current moment in UTC
   */
  private getCurrentTimeInTimezone(_timezone: string): Date {
    // Simply return current time in UTC
    return new Date();
  }

  private async resolveOrderDeliveryTimezone(
    order: Orders,
    countryCode: string
  ): Promise<string> {
    const clientTz = order.client?.user?.timezone;
    if (clientTz && isValidIanaTimezone(clientTz)) {
      return clientTz;
    }
    const configTz = await this.deliveryConfigService.getTimezone(countryCode);
    if (configTz && isValidIanaTimezone(configTz)) {
      return configTz;
    }
    const fromCountry = timezoneFromAddressCountryCode(
      order.delivery_address?.country ?? countryCode
    );
    if (isValidIanaTimezone(fromCountry)) {
      return fromCountry;
    }
    return DEFAULT_USER_TIMEZONE;
  }

  /**
   * Create a date-time in the specified timezone and convert it to UTC for comparison
   */
  private createDateTimeInTimezone(
    preferredDate: string | Date,
    hours: number,
    minutes: number,
    timezone: string
  ): Date {
    try {
      const { year, month, day } =
        parseCalendarDatePartsFromPreferredDate(preferredDate);

      const dateTimeInTimezone = DateTime.fromObject(
        {
          year,
          month,
          day,
          hour: hours,
          minute: minutes,
          second: 0,
        },
        { zone: timezone }
      );

      if (!dateTimeInTimezone.isValid) {
        this.logger.error(
          `Invalid datetime created in timezone ${timezone}: ${dateTimeInTimezone.invalidReason}`
        );
        throw new Error(
          `Invalid datetime: ${dateTimeInTimezone.invalidReason}`
        );
      }

      // Convert to UTC and return as Date object
      const utcDate = dateTimeInTimezone.toUTC().toJSDate();

      this.logger.debug(
        `Created datetime in ${timezone}: ${dateTimeInTimezone.toISO()} (UTC: ${utcDate.toISOString()})`
      );

      return utcDate;
    } catch (error: any) {
      this.logger.error(
        `Error creating datetime in timezone ${timezone}: ${error.message}`
      );
      throw error;
    }
  }

  private async getOrderDetails(orderId: string): Promise<Orders | null> {
    const query = `
      query GetOrder($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          current_status
          subtotal
          base_delivery_fee
          per_km_delivery_fee
          first_order_delivery_fee_promo
          first_order_base_delivery_discount_amount
          tax_amount
          total_amount
          currency
          payment_method
          payment_status
          payment_source
          payment_timing
          reconciliation_status
          completed_at
          business_id
          client_id
          delivery_address_id
          client {
            user_id
            user {
              timezone
              first_name
              last_name
              email
              phone_number
            }
          }
          business {
            user_id
          }
          business_location_id
          business_location {
            id
            address_id
            address {
              country
            }
          }
          delivery_address {
            country
          }
          assigned_agent_id
          assigned_agent {
            user_id
            is_verified
            status
          }
          delivery_pin_hash
          delivery_pin_attempts
          delivery_overwrite_code_hash
          delivery_overwrite_code_used_at
          order_items {
            id
            business_inventory_id
            quantity
          }
          delivery_time_windows {
            id
            order_id
            slot_id
            preferred_date
            time_slot_start
            time_slot_end
            is_confirmed
            special_instructions
            confirmed_at
            confirmed_by
            created_at
            updated_at
            slot {
              id
              slot_name
              slot_type
              start_time
              end_time
              is_active
            }
            confirmedByUser {
              id
              first_name
              last_name
              email
            }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
    });
    return result.orders_by_pk;
  }

  /**
   * Get agent earnings for a specific order. Only the assigned agent can access.
   */
  async getOrderAgentEarnings(orderId: string): Promise<{
    success: boolean;
    earnings: {
      totalEarnings: number;
      baseDeliveryCommission: number;
      perKmDeliveryCommission: number;
      currency: string;
    };
    message?: string;
  }> {
    const user = await this.hasuraUserService.getUser();
    this.requireActivePersona(
      user,
      'agent',
      'Only agents can access order earnings'
    );
    const agent = this.requireAgentRecord(user);
    const order = await this.getOrderDetails(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (order.assigned_agent_id !== agent.id) {
      throw new HttpException(
        'Unauthorized to access this order earnings',
        HttpStatus.FORBIDDEN
      );
    }
    const config = await this.commissionsService.getCommissionConfigs();
    const earnings = this.commissionsService.calculateAgentEarningsSync(
      {
        id: order.id,
        base_delivery_fee: order.base_delivery_fee ?? 0,
        per_km_delivery_fee: order.per_km_delivery_fee ?? 0,
        currency: order.currency ?? 'XAF',
        first_order_delivery_fee_promo: !!(
          order as { first_order_delivery_fee_promo?: boolean }
        ).first_order_delivery_fee_promo,
      },
      agent.is_verified ?? false,
      config
    );
    return {
      success: true,
      earnings: {
        totalEarnings: earnings.totalEarnings,
        baseDeliveryCommission: earnings.baseDeliveryCommission,
        perKmDeliveryCommission: earnings.perKmDeliveryCommission,
        currency: earnings.currency,
      },
      message: 'Agent earnings calculated successfully',
    };
  }

  private async getOrderDetailsByNumber(
    orderNumber: string
  ): Promise<Orders | null> {
    const query = `
      query GetOrderByNumber($orderNumber: String!) {
        orders(where: { order_number: { _eq: $orderNumber } }, limit: 1) {
          id
          order_number
          current_status
          subtotal
          base_delivery_fee
          per_km_delivery_fee
          first_order_delivery_fee_promo
          tax_amount
          total_amount
          currency
          payment_method
          payment_status
          payment_source
          payment_timing
          reconciliation_status
          estimated_delivery_time
          special_instructions
          business_id
          client_id
          delivery_address_id
          requires_fast_delivery
          client {
            user_id
            user {
              id
              first_name
              last_name
              email
              phone_number
              preferred_language
            }
          }
          business_location {
            id
            name
            address_id
            business {
              id
              name
              is_verified
              user {
                id
                email
                preferred_language
              }
            }
            address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
              instructions
            }
          }
          delivery_address {
            id
            address_line_1
            address_line_2
            city
            state
            postal_code
            country
            instructions
          }
          assigned_agent_id
          assigned_agent {
            user_id
            user {
              id
              first_name
              last_name
              email
              preferred_language
              profile_picture_url
            }
          }
          order_items {
            id
            item_name
            quantity
            unit_price
            total_price
            business_inventory_id
            business_inventory {
              id
              item {
                id
                name
              }
            }
          }
          delivery_time_windows {
            id
            order_id
            slot_id
            preferred_date
            time_slot_start
            time_slot_end
            is_confirmed
            special_instructions
            confirmed_at
            confirmed_by
            created_at
            updated_at
            slot {
              id
              slot_name
              slot_type
              start_time
              end_time
              is_active
            }
            confirmedByUser {
              id
              first_name
              last_name
              email
            }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      orderNumber,
    });
    return result.orders[0] || null;
  }

  /**
   * Get order details by order number (public method for controllers)
   */
  async getOrderByNumber(orderNumber: string): Promise<Orders> {
    if (!orderNumber) {
      throw new HttpException(
        'Order number is required',
        HttpStatus.BAD_REQUEST
      );
    }

    const order = await this.getOrderDetailsByNumber(orderNumber);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    // Transform order for agents to show commission amounts
    const agentInfo = await this.getAgentInfo();
    if (agentInfo?.isAgent) {
      const commissionConfig =
        await this.commissionsService.getCommissionConfigs();
      const holdPercentage = await this.agentHoldService.getHoldPercentageForAgent();
      return this.transformOrderForAgentSync(
        order,
        agentInfo.isVerified,
        commissionConfig,
        holdPercentage
      );
    }

    return order;
  }

  /**
   * Finalize order after wallet/mobile incoming payment: holds (pay_now), order_hold row, notifications.
   * Pay-at-delivery: mobile credit is already on the client wallet; settlement debits the client and
   * distributes to business/agent via commission flows (no client hold/release).
   */
  async finalizeOrderAfterIncomingPayment(transaction: any): Promise<void> {
    try {
      const order = await this.getOrderByNumber(transaction.reference);
      const paymentTiming = (order as any).payment_timing as
        | 'pay_now'
        | 'pay_at_delivery'
        | undefined;

      if (paymentTiming === 'pay_at_delivery') {
        await this.finalizePayAtDeliveryPaymentAndComplete(order);
        return;
      }

      await this.finalizeClientOrderPayment(order, transaction.account_id);
    } catch (error) {
      this.logger.error(
        `Failed to process order payment: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * Pay-at-delivery: once mobile payment succeeds, settle and complete the order.
   *
   * Incoming funds are credited to the client wallet in the callback; this path only records
   * settlement amounts on order_holds and runs payment + commission distribution (no client holds).
   *
   * This runs in system context (callback), so it performs direct mutations and status history writes.
   */
  private async finalizePayAtDeliveryPaymentAndComplete(
    order: Orders
  ): Promise<void> {
    const totalDeliveryFees =
      (order.base_delivery_fee || 0) + (order.per_km_delivery_fee || 0);

    const orderHold = await this.getOrCreateOrderHold(order.id);
    await this.updateOrderHold(orderHold.id, {
      client_hold_amount: order.subtotal,
      delivery_fees: totalDeliveryFees,
    });

    // Mark order as paid and complete it (settlement is idempotent)
    await this.updateOrderPaymentStatusOnly(order.id, 'paid');

    await this.processOrderPayment(order.id);
    await this.processOrderDeliveryPayment(order.id);

    await this.setOrderCompleteSystem(order.id);

    // Completion side effects (best-effort)
    try {
      const orderWithDetails = await this.getOrderDetails(order.id);
      const orderItems = orderWithDetails?.order_items || [];
      await this.updateInventoryOnCompletion(orderItems);
    } catch (error: any) {
      this.logger.error(
        `Failed to update inventory after PoD completion: ${error.message}`
      );
    }
    try {
      await this.pdfService.generateReceipt(order.id, order.client.user_id);
    } catch (error: any) {
      this.logger.error(
        `Failed to generate receipt after PoD completion: ${error.message}`
      );
    }
    try {
      await this.orderQueueService.sendOrderCompletedMessage(order.id);
    } catch (error: any) {
      this.logger.error(
        `Failed to send order.completed after PoD completion: ${error.message}`
      );
    }
    try {
      await this.handleOrderCompletionRewards(order.id);
    } catch (error: any) {
      this.logger.error(
        `Failed to handle loyalty rewards after PoD completion: ${error.message}`
      );
    }
  }

  private async updateOrderPaymentStatusOnly(
    orderId: string,
    paymentStatus: string
  ): Promise<void> {
    const at = new Date().toISOString();
    const mutation = `
      mutation UpdateOrderPaymentStatus($orderId: uuid!, $paymentStatus: String!, $at: timestamptz!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { payment_status: $paymentStatus, updated_at: $at }
        ) {
          id
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      paymentStatus,
      at,
    });
  }

  private async setOrderCompleteSystem(orderId: string): Promise<void> {
    const at = new Date().toISOString();
    const mutation = `
      mutation CompleteOrderSystem($orderId: uuid!, $at: timestamptz!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { current_status: complete, completed_at: $at, updated_at: $at }
        ) {
          id
          order_number
          current_status
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, { orderId, at });
    // Record status history in system context (use client user as actor for traceability)
    try {
      const order = await this.getOrderDetails(orderId);
      const changedBy = order?.client?.user_id;
      if (order && changedBy) {
        await this.createStatusHistoryEntry(
          orderId,
          'complete',
          'Order completed after pay-at-delivery payment confirmation',
          'system',
          changedBy
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to write PoD completion status history: ${error.message}`
      );
    }
  }

  /**
   * Finalize client order payment using internal account funds.
   */
  private async finalizeClientOrderPayment(
    order: Orders,
    accountId: string
  ): Promise<void> {
    await this.accountsService.registerTransaction({
      accountId,
      amount: order.subtotal,
      transactionType: 'hold',
      memo: `Hold for order ${order.order_number}`,
      referenceId: order.id,
    });

    const totalDeliveryFees =
      order.base_delivery_fee + order.per_km_delivery_fee;

    await this.accountsService.registerTransaction({
      accountId,
      amount: totalDeliveryFees,
      transactionType: 'hold',
      memo: `Hold for order ${order.order_number} delivery fees (base: ${order.base_delivery_fee}, per-km: ${order.per_km_delivery_fee})`,
      referenceId: order.id,
    });

    const orderHold = await this.getOrCreateOrderHold(order.id);
    await this.updateOrderHold(orderHold.id, {
      client_hold_amount: order.subtotal,
      delivery_fees: totalDeliveryFees,
    });

    await this.updateOrderStatusAndPaymentStatus(order.id, 'pending', 'paid');

    const deliveryPin = this.deliveryPinService.generatePin();
    const deliveryPinHash =
      this.deliveryPinService.hashPin(order.id, deliveryPin);
    await this.setOrderDeliveryPinHash(order.id, deliveryPinHash);
    this.deliveryPinService.setPinForClient(order.id, deliveryPin);

    try {
      const notificationsEnabled =
        this.configService.get('notification').orderStatusChangeEnabled;

      if (!notificationsEnabled) {
        return;
      }

      if (!order.business_location?.business?.name) {
        throw new Error('Business name is undefined');
      }
      if (!order.business_location?.business?.user?.email) {
        throw new Error('Business email is undefined');
      }
      if (!order.delivery_address) {
        throw new Error('Delivery address is undefined');
      }

      const notificationData: NotificationData = {
        orderId: order.id,
        orderNumber: order.order_number,
        clientName: `${order.client?.user?.first_name || ''} ${
          order.client?.user?.last_name || ''
        }`.trim(),
        clientEmail: order.client?.user?.email,
        clientPreferredLanguage: (order.client?.user as { preferred_language?: string })
          ?.preferred_language,
        businessName: order.business_location.business.name,
        businessLocationName: order.business_location?.name || undefined,
        businessEmail: order.business_location.business.user.email,
        businessPreferredLanguage: (
          order.business_location.business.user as { preferred_language?: string }
        )?.preferred_language,
        businessVerified:
          order.business_location.business.is_verified || false,
        agentPreferredLanguage: (
          order.assigned_agent?.user as { preferred_language?: string }
        )?.preferred_language,
        // DB was just set to pending in updateOrderStatusAndPaymentStatus above
        orderStatus: 'pending',
        orderItems:
          order.order_items?.map((item: any) => ({
            name: item.item_name || 'Unknown Item',
            quantity: item.quantity || 0,
            unitPrice: item.unit_price || 0,
            totalPrice: item.total_price || 0,
          })) || [],
        subtotal: order.subtotal || 0,
        deliveryFee:
          (order.base_delivery_fee || 0) + (order.per_km_delivery_fee || 0),
        fastDeliveryFee: order.per_km_delivery_fee || 0,
        taxAmount: order.tax_amount || 0,
        totalAmount: order.total_amount || 0,
        currency: order.currency || 'USD',
        deliveryAddress: this.formatAddress(order.delivery_address),
        estimatedDeliveryTime: order.estimated_delivery_time || undefined,
        specialInstructions: order.special_instructions || undefined,
      };

      await this.notificationsService.sendOrderCreatedNotifications(
        notificationData
      );
    } catch (error) {
      this.logger.error(
        `Failed to send order creation notifications: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Process claim order payment - credits agent account with hold amount
   */
  async processClaimOrderPayment(transaction: any): Promise<void> {
    try {
      // Get order details by order number (reference)
      const order = await this.getOrderByNumber(transaction.entity_id);

      const account = await this.hasuraSystemService.getAccountById(
        transaction.account_id
      );

      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const user = await this.hasuraSystemService.getUserById(account.user_id);

      if (!user || user.user_type_id !== 'agent' || !user.agent) {
        throw new HttpException(
          'User or agent not found',
          HttpStatus.NOT_FOUND
        );
      }

      const orderHold = await this.getOrCreateOrderHold(order.id);

      await this.updateOrderHold(orderHold.id, {
        agent_hold_amount: transaction.amount,
        agent_id: user.agent.id,
      });

      // Register hold transaction
      await this.accountsService.registerTransaction({
        accountId: account.id,
        amount: transaction.amount,
        transactionType: 'hold',
        memo: `Hold for order ${order.order_number}`,
        referenceId: order.id,
      });

      // Assign order to agent
      await this.assignOrderToAgent(
        order.id,
        user.agent.id,
        'assigned_to_agent'
      );

      await this.createStatusHistoryEntry(
        order.id,
        'assigned_to_agent',
        `Order assigned to agent ${user.first_name} ${user.last_name} with topup payment`,
        'agent',
        user.id
      );

      this.logger.log(
        `Successfully processed claim order payment for order ${order.order_number}, amount: ${transaction.amount} ${transaction.currency}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to process claim order payment: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * Handle order payment failure - cancel order and update reserved quantities
   */
  async onOrderPaymentFailed(orderId: string): Promise<void> {
    try {
      // Get order details
      const order = await this.getOrderDetails(orderId);

      if (!order) {
        throw new Error(`Order with ID ${orderId} not found`);
      }

      // Update order status to cancelled (system context - no request user)
      const updateStatusMutation = `
        mutation UpdateOrderStatusCancelled($orderId: uuid!, $newStatus: order_status!) {
          update_orders_by_pk(
            pk_columns: { id: $orderId }
            _set: { current_status: $newStatus, updated_at: "now()" }
          ) {
            id
            current_status
          }
        }
      `;
      await this.hasuraSystemService.executeMutation(updateStatusMutation, {
        orderId,
        newStatus: 'cancelled',
      });

      // Get user ID from the order (client user)
      const userId = order.client.user_id;
      if (!userId) {
        throw new Error('Client user ID not found in order');
      }

      // Create status history entry for payment failure
      await this.createStatusHistoryEntry(
        orderId,
        'cancelled',
        'Order cancelled due to payment failure',
        'client',
        userId,
        'Payment failed - order automatically cancelled'
      );

      // Update reserved quantities - decrement since order is cancelled
      try {
        const orderItems = order.order_items || [];
        await this.updateReservedQuantities(orderItems, 'decrement');
      } catch (error) {
        this.logger.error(
          `Failed to update reserved quantities after payment failure: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        // Don't fail the cancellation if reserved quantity update fails
      }

      this.logger.log(
        `Order ${order.order_number} cancelled due to payment failure`
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle order payment failure for order ${orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  private async getAgentStatus(agentId: string): Promise<string> {
    const query = `
      query GetAgentStatus($agentId: uuid!) {
        agents_by_pk(id: $agentId) {
          status
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      agentId,
    });
    return (result as any).agents_by_pk?.status ?? 'active';
  }

  /**
   * Set delivery PIN hash on order (after payment). Used by PIN-based completion flow.
   */
  private async setOrderDeliveryPinHash(
    orderId: string,
    deliveryPinHash: string
  ): Promise<void> {
    const mutation = `
      mutation SetOrderDeliveryPinHash($orderId: uuid!, $deliveryPinHash: String!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { delivery_pin_hash: $deliveryPinHash }
        ) {
          id
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      deliveryPinHash,
    });
  }

  private async resetOrderDeliveryPinAttempts(orderId: string): Promise<void> {
    const mutation = `
      mutation ResetDeliveryPinAttempts($orderId: uuid!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { delivery_pin_attempts: 0 }
        ) {
          id
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, { orderId });
  }

  /**
   * Update order status and payment status
   */
  private async updateOrderStatusAndPaymentStatus(
    orderId: string,
    newStatus: string,
    paymentStatus: string
  ): Promise<void> {
    const mutation = `
      mutation UpdateOrderStatusAndPaymentStatus($orderId: uuid!, $newStatus: order_status!, $paymentStatus: String!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { 
            current_status: $newStatus,
            payment_status: $paymentStatus,
            updated_at: "now()"
          }
        ) {
          id
          order_number
          current_status
          payment_status
          updated_at
        }
      }
    `;

    try {
      await this.hasuraSystemService.executeMutation(mutation, {
        orderId,
        newStatus,
        paymentStatus,
      });

      this.logger.log(
        `Updated order ${orderId} status to ${newStatus} and payment status to ${paymentStatus}`
      );

      const order = await this.getOrderDetails(orderId);

      if (!order) {
        throw new Error(`Order with ID ${orderId} not found`);
      }

      // Create status history entry for the status change
      await this.createStatusHistoryEntry(
        orderId,
        newStatus,
        `Order status updated to ${newStatus} after payment confirmation`,
        'client',
        order.client.user_id
      );

      // Send order status change notifications (email, push via webPush, SMS)
      try {
        const notificationsEnabled =
          this.configService.get('notification').orderStatusChangeEnabled;
        if (notificationsEnabled) {
          const orderDetails =
            await this.orderStatusService.getOrderDetailsForNotification(
              orderId
            );
          if (orderDetails) {
            await this.notificationsService.sendOrderStatusChangeNotifications(
              orderDetails,
              'pending_payment'
            );
          }
        }
      } catch (notifError) {
        this.logger.error(
          `Failed to send order status change notifications: ${
            notifError instanceof Error ? notifError.message : String(notifError)
          }`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to update order status and payment status for order ${orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  private async getOrderWithItems(orderId: string): Promise<Orders | null> {
    const query = `
      query GetOrderWithItems($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          current_status
          subtotal
          total_amount
          currency
          business_id
          verified_agent_delivery
          business {
            user_id
          }
          assigned_agent_id
          assigned_agent {
            user_id
          }
          order_items {
            id
            total_price
            quantity
            item {
              name
            }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
    });
    return result.orders_by_pk;
  }

  private createClaimAvailabilityFailure(
    holdAmount: number,
    message: string
  ): ClaimAvailabilityResponse {
    return {
      success: true,
      orderOpenStatus: false,
      hasEnoughFundsForHold: false,
      needsTopUpToClaim: false,
      holdAmount,
      message,
    };
  }

  /**
   * Creates a random 8-digit order number
   */
  private createOrderNumber(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  /**
   * Get payment integration (MyPVit vs Freemopay) from phone number.
   */
  private getProvider(phoneNumber: string): MobilePaymentIntegrationProvider {
    if (!phoneNumber) {
      throw new HttpException(
        {
          success: false,
          message: 'Phone number is required for payment',
          error: 'PHONE_NUMBER_REQUIRED',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return this.mobilePaymentsService.getProvider(phoneNumber);
  }

  /**
   * Get fast delivery fee from country_delivery_configs table
   */
  private async getFastDeliveryFee(
    state: string,
    country: string
  ): Promise<{ fee: number; enabled: boolean }> {
    try {
      const [enabled, baseFee] = await Promise.all([
        this.deliveryConfigService.isFastDeliveryEnabled(country),
        this.deliveryConfigService.getFastDeliveryBaseFee(country),
      ]);

      return {
        fee: baseFee || 0,
        enabled: enabled || false,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to get fast delivery fee for country ${country}:`,
        error
      );
      return { fee: 0, enabled: false };
    }
  }

  /**
   * Create a new order with validation and fund withholding
   */
  async createOrder(
    orderData: any,
    client_delivery_address_id: string
  ): Promise<any> {
    // Get the current user
    const user = await this.hasuraUserService.getUser();

    this.requireActivePersona(user, 'client', 'Only clients can create orders');
    const client = this.requireClientRecord(user);

    // Validate delivery address ID
    if (!client_delivery_address_id) {
      throw new HttpException(
        'Delivery address ID is required',
        HttpStatus.BAD_REQUEST
      );
    }

    // Get the specified delivery address
    const address = await this.hasuraUserService.getUserAddressById(
      client_delivery_address_id
    );

    if (!address) {
      throw new Error('Delivery address not found');
    }

    // Validate that we have items
    if (!orderData.items || orderData.items.length === 0) {
      throw new Error('No items provided for order');
    }

    // Get all business inventory items
    const getBusinessInventoryQuery = `
      query GetBusinessInventory($businessInventoryIds: [uuid!]!) {
        business_inventory(where: { id: { _in: $businessInventoryIds } }) {
          id
          computed_available_quantity
          selling_price
          is_active
          business_location_id
          business_location {
            business_id
            business {
              id
              name
              is_verified
              user {
                id
                email
                first_name
                last_name
              }
            }
          }
          item {
            id
            name
            description
            pay_on_delivery_enabled
            currency
            weight
            max_order_quantity
          }
        }
      }
    `;

    const businessInventoryIds = orderData.items.map(
      (item: OrderItem) => item.business_inventory_id
    );
    const now = new Date().toISOString();
    const businessInventoryResult = await this.hasuraSystemService.executeQuery(
      getBusinessInventoryQuery,
      {
        businessInventoryIds: businessInventoryIds,
      }
    );

    if (
      !businessInventoryResult.business_inventory ||
      businessInventoryResult.business_inventory.length === 0
    ) {
      throw new Error('No valid business inventory found');
    }

    const businessInventories =
      businessInventoryResult.business_inventory as any[];

    const paymentTiming: 'pay_now' | 'pay_at_delivery' =
      orderData.payment_timing === 'pay_at_delivery' ? 'pay_at_delivery' : 'pay_now';

    const dealsMap = await this.getActiveDealsByBusinessInventoryIds(
      businessInventoryIds,
      now
    );

    // Validate all items are from the same business
    const businessIds = [
      ...new Set(
        businessInventories.map((inv) => inv.business_location.business_id)
      ),
    ];
    if (businessIds.length > 1) {
      throw new Error('All items must be from the same business');
    }

    // Validate all items are active, respect max_order_quantity, and have sufficient quantity
    for (let i = 0; i < orderData.items.length; i++) {
      const item = orderData.items[i];
      const businessInventory = businessInventories.find(
        (inv) => inv.id === item.business_inventory_id
      );

      if (!businessInventory) {
        throw new Error(
          `Business inventory not found for item ${item.business_inventory_id}`
        );
      }

      if (!businessInventory.is_active) {
        throw new Error(
          `Item ${businessInventory.item.name} is not currently available`
        );
      }

      const maxOrderQuantity = businessInventory.item?.max_order_quantity;
      if (maxOrderQuantity != null && item.quantity > maxOrderQuantity) {
        throw new Error(
          `Item ${businessInventory.item.name} exceeds max order quantity. Max: ${maxOrderQuantity}, Requested: ${item.quantity}`
        );
      }

      if (item.quantity > businessInventory.computed_available_quantity) {
        throw new Error(
          `Insufficient quantity for item ${businessInventory.item.name}. Available: ${businessInventory.computed_available_quantity}, Requested: ${item.quantity}`
        );
      }
    }

    // Use the first item's currency (all items should have the same currency from same business)
    const currency = businessInventories[0].item.currency;

    if (paymentTiming === 'pay_at_delivery') {
      const anyNotEligible = businessInventories.some(
        (inv) => inv?.item?.pay_on_delivery_enabled !== true
      );
      if (anyNotEligible) {
        throw new HttpException(
          'Pay at delivery is not enabled for one or more items in this order',
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Calculate total weight for delivery fee calculation
    const totalWeight = businessInventories.reduce(
      (sum, inv, idx) =>
        sum + (inv.item.weight || 0) * orderData.items[idx].quantity,
      0
    );

    // Calculate delivery fee using the new structure
    const deliveryFeeInfo = await this.calculateItemDeliveryFee(
      orderData.items[0].business_inventory_id,
      client_delivery_address_id,
      orderData.requires_fast_delivery,
      totalWeight
    );

    // Ensure user has an account for the currency (creates one if it doesn't exist)
    const account = await this.hasuraSystemService.getAccount(
      user.id,
      currency
    );

    const orderNumber = this.createOrderNumber();

    // Calculate order amounts for all items
    const totalAmount = businessInventories.reduce((sum, inv, idx) => {
      const deal = dealsMap[inv.id];
      const unitPrice = this.computeUnitPriceFromInventory(inv, deal);
      return sum + unitPrice * orderData.items[idx].quantity;
    }, 0);

    let total_amount = totalAmount + deliveryFeeInfo.deliveryFee;
    let discountCodeId: string | null = null;
    let discountAmount: number | null = null;

    const rawDiscountCode =
      typeof orderData.discount_code === 'string' ? orderData.discount_code : '';
    if (rawDiscountCode.trim()) {
      const validation = await this.loyaltyService.validateDiscountCode(
        rawDiscountCode
      );
      if (!validation.valid || !validation.codeId || !validation.percentage) {
        throw new HttpException(
          {
            success: false,
            message: 'Invalid or already used discount code',
            error: 'DISCOUNT_CODE_INVALID',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      if (validation.createdForClientId && validation.createdForClientId === client.id) {
        throw new HttpException(
          {
            success: false,
            message:
              "You can't use a discount code you generated yourself. Share it with a friend or family member instead.",
            error: 'DISCOUNT_CODE_SELF_USE_NOT_ALLOWED',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      discountCodeId = validation.codeId;
      discountAmount = Number(
        ((total_amount * validation.percentage) / 100).toFixed(2)
      );
      total_amount = Math.max(0, total_amount - discountAmount);
    }

    const phoneNumber = orderData.phone_number || user.phone_number || '';
    const requiredAmountForHold = total_amount;
    const availableBalance = Number(account.available_balance ?? 0);
    const isZeroOrNegativeOrder = requiredAmountForHold <= 0;

    if (paymentTiming === 'pay_at_delivery' && !phoneNumber.trim()) {
      throw new HttpException(
        {
          success: false,
          message: 'Phone number is required for pay at delivery',
          error: 'PHONE_NUMBER_REQUIRED',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const provider = this.mobilePaymentsService.getProvider(phoneNumber);

    if (paymentTiming === 'pay_now' && !isZeroOrNegativeOrder && availableBalance < 0) {
      throw new HttpException(
        `Account balance is negative. Please top up your account before placing orders. Current balance: ${availableBalance} ${currency}`,
        HttpStatus.FORBIDDEN
      );
    }

    const canPayWithWallet =
      paymentTiming === 'pay_now' &&
      !isZeroOrNegativeOrder &&
      availableBalance >= requiredAmountForHold;

    let paymentTransaction: any = null;
    let transaction: any = null;

    if (paymentTiming === 'pay_now' && !canPayWithWallet && !isZeroOrNegativeOrder) {
      try {
        transaction =
          await this.mobilePaymentsDatabaseService.createTransaction({
            reference: orderNumber,
            amount: total_amount,
            currency,
            description: `order ${orderNumber}`,
            provider,
            payment_method: 'mobile_money',
            customer_phone: phoneNumber,
            customer_email: user.email,
            account_id: account.id,
            transaction_type: 'PAYMENT',
            payment_entity: 'order' as const,
            entity_id: orderNumber,
          });

        const paymentRequest = {
          amount: total_amount,
          currency,
          description: `Order ${orderNumber}`,
          customerPhone: phoneNumber,
          provider,
          ownerCharge: 'MERCHANT' as const,
          transactionType: 'PAYMENT' as const,
          payment_entity: 'order' as const,
        };

        paymentTransaction =
          await this.mobilePaymentsService.initiatePayment(
            paymentRequest,
            orderNumber
          );

        if (!paymentTransaction.success) {
          await this.mobilePaymentsDatabaseService.updateTransaction(
            transaction.id,
            {
              status: 'failed',
              error_message: paymentTransaction.message,
              error_code: paymentTransaction.errorCode,
            }
          );

          throw new HttpException(
            {
              success: false,
              message:
                paymentTransaction.message || 'Failed to initiate payment',
              error:
                paymentTransaction.errorCode || 'PAYMENT_INITIATION_FAILED',
              data: {
                orderNumber,
                error: paymentTransaction.message,
                errorCode: paymentTransaction.errorCode,
              },
            },
            HttpStatus.BAD_REQUEST
          );
        }

        if (paymentTransaction.success && paymentTransaction.transactionId) {
          await this.mobilePaymentsDatabaseService.updateTransaction(
            transaction.id,
            {
              transaction_id: paymentTransaction.transactionId,
            }
          );
        }

        this.logger.log(
          `Payment initiated successfully for order ${orderNumber}, transaction ID: ${paymentTransaction.transactionId}`
        );
      } catch (paymentError: any) {
        this.logger.error(
          `Failed to initiate payment for order ${orderNumber}:`,
          paymentError
        );

        if (transaction && !(paymentError instanceof HttpException)) {
          try {
            await this.mobilePaymentsDatabaseService.updateTransaction(
              transaction.id,
              {
                status: 'failed',
                error_message:
                  paymentError instanceof Error
                    ? paymentError.message
                    : String(paymentError),
                error_code: 'PAYMENT_INITIATION_ERROR',
              }
            );
          } catch (updateError) {
            this.logger.error(
              'Failed to update transaction status:',
              updateError
            );
          }
        }

        if (paymentError instanceof HttpException) {
          throw paymentError;
        }

        throw new HttpException(
          {
            success: false,
            message: 'Failed to initiate payment for order',
            error: 'PAYMENT_INITIATION_ERROR',
            data: {
              orderNumber,
              error:
                paymentError instanceof Error
                  ? paymentError.message
                  : String(paymentError),
            },
          },
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }

    const business_location_id = businessInventories[0].business_location_id;
    const delivery_address_id = address.id;
    const subtotal = totalAmount;
    const tax_amount = 0;
    const current_status =
      paymentTiming === 'pay_at_delivery'
        ? 'pending'
        : canPayWithWallet || isZeroOrNegativeOrder
          ? 'pending'
          : 'pending_payment';
    const business_id = businessInventories[0].business_location.business_id;
    const payment_method =
      paymentTiming === 'pay_at_delivery' ? 'pay_on_delivery' : 'online';
    const payment_status =
      paymentTiming === 'pay_at_delivery'
        ? 'pending'
        : canPayWithWallet || isZeroOrNegativeOrder
          ? 'paid'
          : 'pending';
    const payment_source: 'wallet' | 'mobile_payment' =
      paymentTiming === 'pay_at_delivery'
        ? 'mobile_payment'
        : canPayWithWallet || isZeroOrNegativeOrder
          ? 'wallet'
          : 'mobile_payment';
    const special_instructions = orderData.special_instructions || '';
    const estimated_delivery_time = null;
    const preferred_delivery_time = null;
    const actual_delivery_time = null;
    const assigned_agent_id = null;
    const verified_agent_delivery = !!orderData.verified_agent_delivery;
    const requires_fast_delivery = !!orderData.requires_fast_delivery;

    // Create order with all related data in a transaction
    const createOrderMutation = `
      mutation CreateOrderWithItems(
        $clientId: uuid!,
        $businessId: uuid!,
        $businessLocationId: uuid!,
        $deliveryAddressId: uuid!,
        $orderNumber: String!,
        $orderItems: [order_items_insert_input!]!,
        $currency: String!,
        $subTotal: numeric!,
        $taxAmount: numeric!,
        $baseDeliveryFee: numeric!,
        $perKmDeliveryFee: numeric!,
        $totalAmount: numeric!,
        $discountCodeId: uuid,
        $discountAmount: numeric,
        $currentStatus: order_status!,
        $paymentMethod: String!,
        $paymentStatus: String!,
        $paymentSource: payment_source_enum!,
        $paymentTiming: order_payment_timing_enum!,
        $reconciliationStatus: order_reconciliation_status_enum!,
        $specialInstructions: String!,
        $estimatedDeliveryTime: timestamptz,
        $preferredDeliveryTime: timestamptz,
        $actualDeliveryTime: timestamptz,
        $assignedAgentId: uuid,
        $verifiedAgentDelivery: Boolean!,
        $requiresFastDelivery: Boolean!,
        $firstOrderDeliveryFeePromo: Boolean!,
        $firstOrderBaseDeliveryDiscountAmount: numeric!
      ) {
        insert_orders_one(object: {
          client_id: $clientId,
          business_id: $businessId,
          business_location_id: $businessLocationId,
          delivery_address_id: $deliveryAddressId,
          currency: $currency,
          order_number: $orderNumber,
          payment_method: $paymentMethod,
          payment_status: $paymentStatus,
          payment_source: $paymentSource,
          payment_timing: $paymentTiming,
          reconciliation_status: $reconciliationStatus,
          base_delivery_fee: $baseDeliveryFee,
          per_km_delivery_fee: $perKmDeliveryFee,
          subtotal: $subTotal,
          tax_amount: $taxAmount,
          total_amount: $totalAmount,
          discount_code_id: $discountCodeId,
          discount_amount: $discountAmount,
          special_instructions: $specialInstructions,
          actual_delivery_time: $actualDeliveryTime,
          estimated_delivery_time: $estimatedDeliveryTime,
          preferred_delivery_time: $preferredDeliveryTime,
          current_status: $currentStatus,
          assigned_agent_id: $assignedAgentId,
          verified_agent_delivery: $verifiedAgentDelivery,
          requires_fast_delivery: $requiresFastDelivery,
          first_order_delivery_fee_promo: $firstOrderDeliveryFeePromo,
          first_order_base_delivery_discount_amount: $firstOrderBaseDeliveryDiscountAmount,
          order_items: {
            data: $orderItems
          }
        }) {
          id
          currency
          order_number
          payment_method
          payment_status
          payment_source
          payment_timing
          reconciliation_status
          base_delivery_fee
          per_km_delivery_fee
          subtotal
          tax_amount
          total_amount
          discount_code_id
          discount_amount
          special_instructions
          actual_delivery_time
          created_at
          estimated_delivery_time
          preferred_delivery_time
          updated_at
          current_status
          assigned_agent_id
          business_id
          business_location_id
          client_id
          delivery_address_id
          requires_fast_delivery
          first_order_delivery_fee_promo
          first_order_base_delivery_discount_amount
          order_items {
            id
            business_inventory_id
            item_id
            item_name
            quantity
            unit_price
            total_price
          }
        }
      }
    `;

    // Prepare order items data for all items
    const orderItemsData = orderData.items.map((item: OrderItem) => {
      const businessInventory = businessInventories.find(
        (inv) => inv.id === item.business_inventory_id
      );
      const deal = businessInventory ? dealsMap[businessInventory.id] : undefined;
      const unitPrice = businessInventory
        ? this.computeUnitPriceFromInventory(businessInventory, deal)
        : 0;
      return {
        business_inventory_id: item.business_inventory_id,
        item_id: businessInventory.item.id,
        item_name: businessInventory.item.name,
        item_description: businessInventory.item.description,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: unitPrice * item.quantity,
      };
    });

    // Create the order
    const orderResult = await this.hasuraSystemService.executeMutation(
      createOrderMutation,
      {
        clientId: client.id,
        businessId: business_id,
        businessLocationId: business_location_id,
        deliveryAddressId: delivery_address_id,
        orderNumber: orderNumber,
        orderItems: orderItemsData,
        currency: currency,
        subTotal: subtotal,
        taxAmount: tax_amount,
        baseDeliveryFee: deliveryFeeInfo.baseDeliveryFee,
        perKmDeliveryFee: deliveryFeeInfo.perKmDeliveryFee,
        totalAmount: total_amount,
        discountCodeId: discountCodeId,
        discountAmount: discountAmount,
        currentStatus: current_status,
        paymentMethod: payment_method,
        paymentStatus: payment_status,
        paymentSource: payment_source,
        paymentTiming: paymentTiming,
        reconciliationStatus: 'none',
        specialInstructions: special_instructions,
        estimatedDeliveryTime: estimated_delivery_time,
        preferredDeliveryTime: preferred_delivery_time,
        actualDeliveryTime: actual_delivery_time,
        assignedAgentId: assigned_agent_id,
        verifiedAgentDelivery: verified_agent_delivery,
        requiresFastDelivery: requires_fast_delivery,
        firstOrderDeliveryFeePromo: deliveryFeeInfo.firstOrderDeliveryFeePromo,
        firstOrderBaseDeliveryDiscountAmount:
          deliveryFeeInfo.firstOrderBaseDeliveryDiscountAmount,
      }
    );

    const order = orderResult.insert_orders_one;

    // Update reserved quantities for inventory items
    await this.updateReservedQuantities(orderItemsData, 'increment');

    // Create order status history after order is created
    const createStatusHistoryMutation = `
      mutation CreateStatusHistory($orderId: uuid!, $status: order_status!, $notes: String!, $changedByType: String!, $changedByUserId: uuid!) {
        insert_order_status_history(objects: [{
          order_id: $orderId,
          status: $status,
          notes: $notes,
          changed_by_type: $changedByType,
          changed_by_user_id: $changedByUserId
        }]) {
          affected_rows
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(
      createStatusHistoryMutation,
      {
        orderId: order.id,
        status: current_status,
        notes:
          current_status === 'pending_payment'
            ? 'Order created, awaiting payment'
            : 'Order created and paid from Rendasua account',
        changedByType: 'client',
        changedByUserId: user.id,
      }
    );

    // Create delivery window if provided
    let deliveryWindow = null;
    if (orderData.delivery_window) {
      try {
        deliveryWindow = await this.deliveryWindowsService.createDeliveryWindow(
          {
            order_id: order.id,
            slot_id: orderData.delivery_window.slot_id,
            preferred_date: orderData.delivery_window.preferred_date,
            special_instructions:
              orderData.delivery_window.special_instructions ||
              orderData.special_instructions ||
              '',
          }
        );
      } catch (error) {
        this.logger.error('Failed to create delivery window:', error);
        // Don't fail the order creation if delivery window creation fails
        // The order can still be processed without a delivery window
      }
    }

    // Send order.created message to SQS queue
    try {
      await this.orderQueueService.sendOrderCreatedMessage(order.id);
    } catch (error) {
      // Log but don't throw - order creation should succeed
      this.logger.error(
        `Failed to send order.created message to SQS: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (paymentTiming === 'pay_at_delivery') {
      // Pay-at-delivery orders are not finalized at placement time, but we still want the
      // "order placed" notifications to go out immediately.
      try {
        const notificationsEnabled =
          this.configService.get('notification').orderStatusChangeEnabled;
        if (notificationsEnabled) {
          const orderWithDetails = await this.getOrderByNumber(order.order_number);
          if (
            orderWithDetails?.business_location?.business?.name &&
            orderWithDetails?.business_location?.business?.user?.email &&
            orderWithDetails?.delivery_address
          ) {
            const notificationData: NotificationData = {
              orderId: orderWithDetails.id,
              orderNumber: orderWithDetails.order_number,
              clientName: `${orderWithDetails.client?.user?.first_name || ''} ${
                orderWithDetails.client?.user?.last_name || ''
              }`.trim(),
              clientEmail: orderWithDetails.client?.user?.email,
              clientPreferredLanguage: (
                orderWithDetails.client?.user as { preferred_language?: string }
              )?.preferred_language,
              businessName: orderWithDetails.business_location.business.name,
              businessLocationName: orderWithDetails.business_location?.name || undefined,
              businessEmail: orderWithDetails.business_location.business.user.email,
              businessPreferredLanguage: (
                orderWithDetails.business_location.business.user as {
                  preferred_language?: string;
                }
              )?.preferred_language,
              businessVerified:
                orderWithDetails.business_location.business.is_verified || false,
              agentPreferredLanguage: (
                orderWithDetails.assigned_agent?.user as {
                  preferred_language?: string;
                }
              )?.preferred_language,
              orderStatus: 'pending',
              orderItems:
                orderWithDetails.order_items?.map((item: any) => ({
                  name: item.item_name || 'Unknown Item',
                  quantity: item.quantity || 0,
                  unitPrice: item.unit_price || 0,
                  totalPrice: item.total_price || 0,
                })) || [],
              subtotal: orderWithDetails.subtotal || 0,
              deliveryFee:
                (orderWithDetails.base_delivery_fee || 0) +
                (orderWithDetails.per_km_delivery_fee || 0),
              fastDeliveryFee: orderWithDetails.per_km_delivery_fee || 0,
              taxAmount: orderWithDetails.tax_amount || 0,
              totalAmount: orderWithDetails.total_amount || 0,
              currency: orderWithDetails.currency || 'USD',
              deliveryAddress: this.formatAddress(orderWithDetails.delivery_address),
              estimatedDeliveryTime:
                orderWithDetails.estimated_delivery_time || undefined,
              specialInstructions: orderWithDetails.special_instructions || undefined,
            };

            await this.notificationsService.sendOrderCreatedNotifications(
              notificationData
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to send pay-at-delivery order creation notifications: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      return {
        ...order,
        total_amount: total_amount,
        delivery_window: deliveryWindow,
        payment_transaction: {
          success: true,
          transaction_id: null,
          message: 'Pay at delivery selected',
          mode: 'pay_at_delivery' as const,
        },
        database_transaction: null,
      };
    }

    if (paymentTiming === 'pay_now' && !canPayWithWallet && !isZeroOrNegativeOrder) {
      // For mobile payments, schedule payment timeout
      try {
        await this.waitAndExecuteScheduleService.schedulePaymentTimeout(
          'order.created',
          { order_id: order.id, transaction_id: transaction.id }
        );
      } catch (error) {
        this.logger.error(
          `Failed to schedule payment timeout for order ${order.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      return {
        ...order,
        total_amount: total_amount,
        delivery_window: deliveryWindow,
        payment_source: 'mobile_money' as const,
        payment_transaction: {
          success: paymentTransaction.success,
          transaction_id: paymentTransaction.transactionId,
          message: paymentTransaction.message,
          mode: 'mobile_money' as const,
        },
        database_transaction: {
          id: transaction.id,
          reference: transaction.reference,
          status: transaction.status,
        },
      };
    }

    // For wallet-funded or zero-amount orders, finalize payment immediately.
    // Fetch full order (with business_location, delivery_address, client) so notifications have required data.
    const orderWithDetails = await this.getOrderByNumber(order.order_number);
    await this.finalizeClientOrderPayment(orderWithDetails, account.id);

    return {
      ...order,
      total_amount: total_amount,
      delivery_window: deliveryWindow,
      payment_transaction: {
        success: true,
        transaction_id: null,
        message: 'Paid from Rendasua account',
        mode: order.payment_source as 'wallet' | 'mobile_money',
      },
      database_transaction: null,
    };
  }

  /**
   * Get or create an order hold for the given order ID
   */
  async getOrCreateOrderHold(
    orderId: string,
    deliveryFees = 0
  ): Promise<OrderHoldWithSettlement> {
    // First, try to get the existing order hold
    const getOrderHoldQuery = `
      query GetOrderHold($orderId: uuid!) {
        order_holds(where: { order_id: { _eq: $orderId } }) {
          id
          order_id
          client_id
          agent_id
          client_hold_amount
          agent_hold_amount
          delivery_fees
          currency
          status
          item_settlement_completed_at
          delivery_settlement_completed_at
          created_at
          updated_at
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(
      getOrderHoldQuery,
      {
        orderId,
      }
    );

    let orderHold = result.order_holds[0] || null;

    if (!orderHold) {
      // Get order details to create the order hold
      const order = await this.getOrderDetails(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Create a new order hold
      const createOrderHoldMutation = `
        mutation CreateOrderHold(
          $orderId: uuid!,
          $clientId: uuid!,
          $currency: currency_enum!,
          $clientHoldAmount: numeric!,
          $deliveryFees: numeric!
        ) {
          insert_order_holds_one(object: {
            order_id: $orderId,
            client_id: $clientId,
            agent_id: null,
            client_hold_amount: $clientHoldAmount,
            agent_hold_amount: 0,
            delivery_fees: $deliveryFees,
            currency: $currency,
            status: "active"
          }) {
            id
            order_id
            client_id
            agent_id
            client_hold_amount
            agent_hold_amount
            delivery_fees
            currency
            status
            item_settlement_completed_at
            delivery_settlement_completed_at
            created_at
            updated_at
          }
        }
      `;

      const createResult = await this.hasuraSystemService.executeMutation(
        createOrderHoldMutation,
        {
          orderId: order.id,
          clientId: order.client_id,
          currency: order.currency,
          clientHoldAmount: order.total_amount,
          deliveryFees: deliveryFees ?? 0,
        }
      );

      orderHold = createResult.insert_order_holds_one;
    }

    return orderHold;
  }

  /**
   * Update an order hold with the specified fields
   */
  async updateOrderHold(
    orderHoldId: string,
    updates: {
      status?: string;
      client_hold_amount?: number;
      agent_hold_amount?: number;
      delivery_fees?: number;
      agent_id?: string | null;
      item_settlement_completed_at?: string | null;
      delivery_settlement_completed_at?: string | null;
    }
  ): Promise<any> {
    const updateOrderHoldMutation = `
     mutation UpdateOrderHold($orderHoldId: uuid!, $_set: order_holds_set_input = {}) {
      update_order_holds_by_pk(pk_columns: {id: $orderHoldId}, _set: $_set) {
        id
        order_id
        client_id
        agent_id
        client_hold_amount
        agent_hold_amount
        delivery_fees
        currency
        status
        item_settlement_completed_at
        delivery_settlement_completed_at
        created_at
        updated_at
      }
    }

    `;

    const result = await this.hasuraSystemService.executeMutation(
      updateOrderHoldMutation,
      {
        orderHoldId,
        _set: {
          status: updates.status ?? undefined,
          client_hold_amount:
            updates.client_hold_amount != null
              ? updates.client_hold_amount
              : undefined,
          agent_hold_amount:
            updates.agent_hold_amount != null
              ? updates.agent_hold_amount
              : undefined,
          delivery_fees:
            updates.delivery_fees != null ? updates.delivery_fees : undefined,
          agent_id: updates.agent_id ?? undefined,
          item_settlement_completed_at:
            updates.item_settlement_completed_at !== undefined
              ? updates.item_settlement_completed_at
              : undefined,
          delivery_settlement_completed_at:
            updates.delivery_settlement_completed_at !== undefined
              ? updates.delivery_settlement_completed_at
              : undefined,
        },
      }
    );

    return result.update_order_holds_by_pk;
  }

  private async assignOrderToAgent(
    orderId: string,
    agentId: string,
    status: string
  ): Promise<any> {
    const mutation = `
      mutation AssignOrderToAgent($orderId: uuid!, $agentId: uuid!, $status: order_status!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { 
            current_status: $status,
            assigned_agent_id: $agentId,
            updated_at: "now()"
          }
        ) {
          id
          order_number
          current_status
          assigned_agent_id
          updated_at
        }
      }
    `;
    const result = await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      agentId,
      status,
    });
    return result.update_orders_by_pk;
  }

  private async createStatusHistoryEntry(
    orderId: string,
    status: string,
    notes: string,
    changedByType: string,
    changedByUserId: string,
    additionalNotes?: string
  ): Promise<void> {
    const finalNotes = additionalNotes ? `${notes}. ${additionalNotes}` : notes;
    const mutation = `
      mutation CreateStatusHistory($orderId: uuid!, $status: order_status!, $notes: String!, $changedByType: String!, $changedByUserId: uuid!) {
        insert_order_status_history(objects: [{
          order_id: $orderId,
          status: $status,
          notes: $notes,
          changed_by_type: $changedByType,
          changed_by_user_id: $changedByUserId
        }]) {
          affected_rows
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      status,
      notes: finalNotes,
      changedByType,
      changedByUserId,
    });
  }

  /**
   * Release item/subtotal client hold, record item payment, distribute item/business commissions.
   * Idempotent via order_holds.item_settlement_completed_at. Call while status is assigned_to_agent (pickup) or picked_up (retry).
   */
  async processOrderPayment(orderId: string): Promise<void> {
    const order = await this.getOrderDetails(orderId);
    if (
      !order ||
      !order.business?.user_id ||
      !order.client_id ||
      !order.client?.user_id
    ) {
      throw new HttpException(
        'Order, business user, or client not found',
        HttpStatus.BAD_REQUEST
      );
    }

    const orderHold = await this.getOrCreateOrderHold(orderId);
    if (orderHold.item_settlement_completed_at) {
      return;
    }

    const paymentTiming = (order as any).payment_timing as
      | 'pay_now'
      | 'pay_at_delivery'
      | undefined;
    const itemStatuses =
      paymentTiming === 'pay_at_delivery'
        ? ['assigned_to_agent', 'picked_up', 'out_for_delivery', 'complete']
        : ['assigned_to_agent', 'picked_up'];
    if (!itemStatuses.includes(order.current_status)) {
      throw new HttpException(
        `Item settlement requires assigned_to_agent or picked_up; got ${order.current_status}`,
        HttpStatus.BAD_REQUEST
      );
    }

    const subtotalPortion = Number(orderHold.client_hold_amount);
    const clientAccount = await this.hasuraSystemService.getAccount(
      order.client.user_id,
      order.currency
    );
    if (!clientAccount) {
      throw new HttpException('Client account not found', HttpStatus.NOT_FOUND);
    }

    if (subtotalPortion > 0) {
      if (paymentTiming === 'pay_at_delivery') {
        await this.accountsService.registerTransaction({
          accountId: clientAccount.id,
          amount: subtotalPortion,
          transactionType: 'payment',
          memo: `Order item payment for order ${order.order_number} (pay at delivery)`,
          referenceId: orderId,
        });
      } else {
        await this.accountsService.registerTransaction({
          accountId: clientAccount.id,
          amount: subtotalPortion,
          transactionType: 'release',
          memo: `Hold released for order ${order.order_number} (items)`,
          referenceId: orderId,
        });
        await this.accountsService.registerTransaction({
          accountId: clientAccount.id,
          amount: subtotalPortion,
          transactionType: 'payment',
          memo: `Order item payment for order ${order.order_number}`,
          referenceId: orderId,
        });
      }
    }

    try {
      await this.commissionsService.distributeItemCommissions(order);
    } catch (error: any) {
      this.logger.error(
        `Failed item commission distribution for order ${order.order_number}: ${error.message}`
      );
    }

    await this.updateOrderHold(orderHold.id, {
      client_hold_amount: 0,
      item_settlement_completed_at: new Date().toISOString(),
    });
  }

  /**
   * Release agent hold and delivery client hold, record delivery payment, distribute delivery commissions.
   * Idempotent via order_holds.delivery_settlement_completed_at. Call while out_for_delivery (before complete) or complete (retry).
   */
  async processOrderDeliveryPayment(orderId: string): Promise<void> {
    const order = await this.getOrderDetails(orderId);
    if (
      !order ||
      !order.business?.user_id ||
      !order.client_id ||
      !order.client?.user_id
    ) {
      throw new HttpException(
        'Order, business user, or client not found',
        HttpStatus.BAD_REQUEST
      );
    }

    const orderHold = await this.getOrCreateOrderHold(orderId);
    if (orderHold.delivery_settlement_completed_at) {
      return;
    }

    if (!orderHold.item_settlement_completed_at) {
      throw new HttpException(
        'Item settlement must complete before delivery settlement',
        HttpStatus.BAD_REQUEST
      );
    }

    const paymentTiming = (order as any).payment_timing as
      | 'pay_now'
      | 'pay_at_delivery'
      | undefined;

    const deliveryStatuses = ['out_for_delivery', 'complete'];
    if (!deliveryStatuses.includes(order.current_status)) {
      throw new HttpException(
        `Delivery settlement requires out_for_delivery or complete; got ${order.current_status}`,
        HttpStatus.BAD_REQUEST
      );
    }

    if (order.assigned_agent) {
      const agentAccount = await this.hasuraSystemService.getAccount(
        order.assigned_agent.user_id,
        order.currency
      );
      const agentHoldAmt = Number(orderHold.agent_hold_amount);
      if (agentAccount && agentHoldAmt > 0) {
        await this.accountsService.registerTransaction({
          accountId: agentAccount.id,
          amount: agentHoldAmt,
          transactionType: 'release',
          memo: `Hold released for order ${order.order_number}`,
          referenceId: orderId,
        });
      }
    }

    const clientAccount = await this.hasuraSystemService.getAccount(
      order.client.user_id,
      order.currency
    );
    if (!clientAccount) {
      throw new HttpException('Client account not found', HttpStatus.NOT_FOUND);
    }

    const deliveryAmt = Number(orderHold.delivery_fees);
    if (deliveryAmt > 0) {
      if (paymentTiming === 'pay_at_delivery') {
        await this.accountsService.registerTransaction({
          accountId: clientAccount.id,
          amount: deliveryAmt,
          transactionType: 'payment',
          memo: `Order delivery payment for order ${order.order_number} (pay at delivery)`,
          referenceId: orderId,
        });
      } else {
        await this.accountsService.registerTransaction({
          accountId: clientAccount.id,
          amount: deliveryAmt,
          transactionType: 'release',
          memo: `Hold released for order ${order.order_number} delivery fee`,
          referenceId: orderId,
        });
        await this.accountsService.registerTransaction({
          accountId: clientAccount.id,
          amount: deliveryAmt,
          transactionType: 'payment',
          memo: `Order delivery payment for order ${order.order_number}`,
          referenceId: orderId,
        });
      }
    }

    try {
      await this.commissionsService.distributeDeliveryCommissions(order);
    } catch (error: any) {
      this.logger.error(
        `Failed delivery commission distribution for order ${order.order_number}: ${error.message}`
      );
    }

    await this.updateOrderHold(orderHold.id, {
      delivery_fees: 0,
      status: 'completed',
      delivery_settlement_completed_at: new Date().toISOString(),
    });
  }

  private roundCurrency(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  private async clientHasAnyOrders(clientId: string): Promise<boolean> {
    const query = `
      query ClientHasOrders($clientId: uuid!) {
        orders_aggregate(where: { client_id: { _eq: $clientId } }) {
          aggregate {
            count
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      clientId,
    });
    const count = result.orders_aggregate?.aggregate?.count ?? 0;
    return count > 0;
  }

  private applyFirstOrderBasePromo(
    baseFeeBefore: number,
    perKmFee: number,
    applyPromo: boolean
  ): {
    baseDeliveryFee: number;
    perKmDeliveryFee: number;
    deliveryFee: number;
    firstOrderDeliveryFeePromo: boolean;
    firstOrderBaseDeliveryDiscountAmount: number;
    baseDeliveryFeeBeforeDiscount: number;
  } {
    const baseDeliveryFeeBeforeDiscount = this.roundCurrency(baseFeeBefore);
    if (!applyPromo || baseFeeBefore <= 0) {
      const baseDeliveryFee = baseDeliveryFeeBeforeDiscount;
      const perKmDeliveryFee = this.roundCurrency(perKmFee);
      return {
        baseDeliveryFee,
        perKmDeliveryFee,
        deliveryFee: this.roundCurrency(baseDeliveryFee + perKmDeliveryFee),
        firstOrderDeliveryFeePromo: false,
        firstOrderBaseDeliveryDiscountAmount: 0,
        baseDeliveryFeeBeforeDiscount,
      };
    }
    const discount = this.roundCurrency(baseFeeBefore / 2);
    const baseDeliveryFee = this.roundCurrency(baseFeeBefore - discount);
    const perKmDeliveryFee = this.roundCurrency(perKmFee);
    return {
      baseDeliveryFee,
      perKmDeliveryFee,
      deliveryFee: this.roundCurrency(baseDeliveryFee + perKmDeliveryFee),
      firstOrderDeliveryFeePromo: true,
      firstOrderBaseDeliveryDiscountAmount: discount,
      baseDeliveryFeeBeforeDiscount,
    };
  }

  private resolveDeliveryFeeTargetAddressId(
    explicitId: string | undefined,
    addresses?: Array<Pick<Addresses, 'id' | 'is_primary' | 'status'>>
  ): string {
    if (explicitId?.trim()) {
      return explicitId.trim();
    }
    const active = (addresses ?? []).filter(
      (a) => (a.status ?? 'active') === 'active'
    );
    const primaryActive = active.find((a) => a.is_primary === true);
    return primaryActive?.id ?? active[0]?.id ?? '';
  }

  /**
   * Calculate delivery fee for a given item based on distance
   * Uses tiered pricing model with fallback to delivery_fees table
   */
  async calculateItemDeliveryFee(
    itemId: string,
    addressId?: string,
    requiresFastDelivery = false,
    totalWeight?: number
  ): Promise<{
    deliveryFee: number;
    distance?: number;
    method: 'distance_based' | 'flat_fee';
    currency: string;
    country: string;
    baseDeliveryFee: number;
    perKmDeliveryFee: number;
    isFirstOrderClient: boolean;
    firstOrderDeliveryFeePromo: boolean;
    firstOrderBaseDeliveryDiscountAmount: number;
    baseDeliveryFeeBeforeDiscount: number;
  }> {
    try {
      // Get user for authorization
      const user = await this.hasuraUserService.getUser();
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const isFirstOrderClient = !!(
        user.client?.id &&
        !(await this.clientHasAnyOrders(user.client.id))
      );
      const applyPromo = isFirstOrderClient;

      // Get item details
      const item = await this.getItemDetails(itemId);
      if (!item) {
        throw new HttpException('Item not found', HttpStatus.NOT_FOUND);
      }

      // Use explicit address, else first active primary, else first active
      const targetAddressId = this.resolveDeliveryFeeTargetAddressId(
        addressId,
        user.addresses
      );
      const userAddresses = await this.addressesService.getAddressesByIds([
        targetAddressId,
      ]);
      const userAddress = userAddresses[0];
      if (!userAddress) {
        throw new HttpException('User address not found', HttpStatus.NOT_FOUND);
      }

      // Get business location address
      const businessAddresses = await this.addressesService.getAddressesByIds([
        item.business_location.address_id,
      ]);
      const businessAddress = businessAddresses[0];
      if (!businessAddress) {
        throw new HttpException(
          'Business address not found',
          HttpStatus.NOT_FOUND
        );
      }

      // Create formatted addresses
      const userFormattedAddress = this.formatAddress(userAddress as Addresses);
      const businessFormattedAddress = this.formatAddress(
        businessAddress as Addresses
      );

      // Try to calculate distance-based fee
      try {
        const distanceMatrix =
          await this.googleDistanceService.getDistanceMatrixWithCaching(
            userAddress.id,
            userFormattedAddress,
            [
              {
                id: businessAddress.id,
                formatted: businessFormattedAddress,
              },
            ]
          );

        if (
          distanceMatrix.rows?.[0]?.elements?.[0]?.status === 'OK' &&
          distanceMatrix.rows[0].elements[0].distance
        ) {
          const distanceKm = Math.round(
            distanceMatrix.rows[0].elements[0].distance.value / 1000
          ); // Convert meters to km and round to nearest integer

          this.logger.log(`Distance-based delivery fee calculated: ${distanceKm}`);

          // Calculate fee using tiered pricing model
          const feeComponents = await this.calculateTieredDeliveryFee(
            distanceKm,
            businessAddress.country,
            requiresFastDelivery
          );

          this.logger.log(`Tiered delivery fee calculated: ${distanceKm}km`);
          this.logger.log(`Base delivery fee: ${feeComponents.baseFee}`);
          this.logger.log(`Per km delivery fee: ${feeComponents.perKmFee}`);
          this.logger.log(`Total delivery fee: ${feeComponents.totalFee}`);
          this.logger.log(`Currency: ${item.item.currency}`);
          this.logger.log(`Country: ${businessAddress.country}`);

          const promo = this.applyFirstOrderBasePromo(
            feeComponents.baseFee,
            feeComponents.perKmFee,
            applyPromo
          );
          return {
            deliveryFee: promo.deliveryFee,
            baseDeliveryFee: promo.baseDeliveryFee,
            perKmDeliveryFee: promo.perKmDeliveryFee,
            distance: distanceKm,
            method: 'distance_based',
            currency: item.item.currency,
            country: businessAddress.country,
            isFirstOrderClient,
            firstOrderDeliveryFeePromo: promo.firstOrderDeliveryFeePromo,
            firstOrderBaseDeliveryDiscountAmount:
              promo.firstOrderBaseDeliveryDiscountAmount,
            baseDeliveryFeeBeforeDiscount: promo.baseDeliveryFeeBeforeDiscount,
          };
        }
      } catch (distanceError) {
        console.warn('Failed to calculate distance-based fee:', distanceError);
      }

      // Fallback to normal delivery base fee
      const countryCode = this.extractCountryCode(
        businessAddress as unknown as Addresses
      );
      const flatFee = await this.deliveryConfigService.getNormalDeliveryBaseFee(
        countryCode
      );

      let fastExtra = 0;
      if (requiresFastDelivery) {
        const fastDeliveryConfig = await this.getFastDeliveryFee(
          userAddress.state || '',
          userAddress.country || ''
        );
        if (fastDeliveryConfig.enabled) {
          fastExtra = fastDeliveryConfig.fee;
        }
      }

      const promo = this.applyFirstOrderBasePromo(flatFee, 0, applyPromo);
      const finalDeliveryFee = this.roundCurrency(promo.deliveryFee + fastExtra);

      this.logger.log(`Flat fee calculated: ${finalDeliveryFee}`);
      this.logger.log(`Currency: ${item.item.currency}`);
      this.logger.log(`Country: ${businessAddress.country}`);
      this.logger.log(`Base delivery fee: ${promo.baseDeliveryFee}`);
      this.logger.log(`Per km delivery fee: 0`);
      this.logger.log(`Total delivery fee: ${finalDeliveryFee}`);

      return {
        deliveryFee: finalDeliveryFee,
        method: 'flat_fee',
        currency: item.item.currency,
        country: businessAddress.country,
        baseDeliveryFee: promo.baseDeliveryFee,
        perKmDeliveryFee: 0,
        isFirstOrderClient,
        firstOrderDeliveryFeePromo: promo.firstOrderDeliveryFeePromo,
        firstOrderBaseDeliveryDiscountAmount:
          promo.firstOrderBaseDeliveryDiscountAmount,
        baseDeliveryFeeBeforeDiscount: promo.baseDeliveryFeeBeforeDiscount,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to calculate delivery fee: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Calculate delivery fee for a given order based on distance
   * Uses tiered pricing model with fallback to delivery_fees table
   */
  async calculateDeliveryFee(orderId: string): Promise<{
    deliveryFee: number;
    distance?: number;
    method: 'distance_based' | 'flat_fee';
    currency: string;
  }> {
    try {
      // Get order details
      const order = await this.getOrderDetails(orderId);
      if (!order) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      // Get user for authorization
      const user = await this.hasuraUserService.getUser();
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Check if user has access to this order
      const isClient = order.client_id === user.id;
      const isBusiness = order.business?.user_id === user.id;
      const isAgent = order.assigned_agent?.user_id === user.id;

      if (!isClient && !isBusiness && !isAgent) {
        throw new HttpException(
          'Unauthorized to access this order',
          HttpStatus.FORBIDDEN
        );
      }

      // Order may reference addresses later soft-deleted; still use snapshot IDs for distance
      const clientAddresses = await this.addressesService.getAddressesByIds(
        [order.delivery_address_id],
        { includeInactive: true }
      );
      const clientAddress = clientAddresses[0];
      if (!clientAddress) {
        throw new HttpException(
          'Client address not found',
          HttpStatus.NOT_FOUND
        );
      }

      const businessAddresses = await this.addressesService.getAddressesByIds(
        [order.business_location.address_id],
        { includeInactive: true }
      );
      const businessAddress = businessAddresses[0];
      if (!businessAddress) {
        throw new HttpException(
          'Business address not found',
          HttpStatus.NOT_FOUND
        );
      }

      // Create formatted addresses
      const clientFormattedAddress = this.formatAddress(
        clientAddress as Addresses
      );
      const businessFormattedAddress = this.formatAddress(
        businessAddress as Addresses
      );

      // Try to calculate distance-based fee
      try {
        const distanceMatrix =
          await this.googleDistanceService.getDistanceMatrixWithCaching(
            clientAddress.id,
            clientFormattedAddress,
            [
              {
                id: businessAddress.id,
                formatted: businessFormattedAddress,
              },
            ]
          );

        if (
          distanceMatrix.rows?.[0]?.elements?.[0]?.status === 'OK' &&
          distanceMatrix.rows[0].elements[0].distance
        ) {
          const distanceKm =
            distanceMatrix.rows[0].elements[0].distance.value / 1000; // Convert meters to km

          // Calculate fee using tiered pricing model
          const feeComponents = await this.calculateTieredDeliveryFee(
            distanceKm,
            this.extractCountryCode(clientAddress as Addresses, order) ?? 'GA'
          );

          return {
            deliveryFee: feeComponents.totalFee,
            distance: distanceKm,
            method: 'distance_based',
            currency: order.currency,
          };
        }
      } catch (distanceError) {
        console.warn('Failed to calculate distance-based fee:', distanceError);
      }

      // Fallback to normal delivery base fee
      const countryCode =
        this.extractCountryCode(clientAddress as Addresses, order) ?? 'GA';
      const flatFee = await this.deliveryConfigService.getNormalDeliveryBaseFee(
        countryCode
      );

      return {
        deliveryFee: flatFee,
        method: 'flat_fee',
        currency: order.currency,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to calculate delivery fee: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Extract country code from address or order context
   */
  extractCountryCode(address?: Addresses, order?: Orders): string {
    // Try to get country from address first
    if (address?.country) {
      // Convert full country name to ISO 3166-1 alpha-2 code
      const countryMap: { [key: string]: string } = {
        Cameroon: 'CM',
        Gabon: 'GA',
        Canada: 'CA',
        'United States': 'US',
        USA: 'US',
        // Add more mappings as needed
      };

      const countryCode = countryMap[address.country] || address.country;
      if (countryCode.length === 2) {
        return countryCode.toUpperCase();
      }
    }

    // Try to get country from order context
    if (order?.delivery_address?.country) {
      return this.extractCountryCode(order.delivery_address);
    }

    // Default to GA (Gabon)
    return 'GA';
  }

  /**
   * Calculate delivery fee using tiered pricing model based on country_delivery_configs
   * Returns base fee and per-km fee components separately
   */
  private async calculateTieredDeliveryFee(
    distanceKm: number,
    countryCode = 'GA',
    requiresFastDelivery = false
  ): Promise<{ baseFee: number; perKmFee: number; totalFee: number }> {
    try {
      // Get configurations from country_delivery_configs
      const [baseFee, ratePerKm, maxPerKmFee] = await Promise.all([
        requiresFastDelivery
          ? this.deliveryConfigService.getFastDeliveryBaseFee(countryCode)
          : this.deliveryConfigService.getNormalDeliveryBaseFee(countryCode),
        this.deliveryConfigService.getPerKmDeliveryFee(countryCode),
        this.deliveryConfigService.getMaxPerKmDeliveryFee(countryCode),
      ]);

      // Use fallback values if configurations are not found
      const finalBaseFee = baseFee || (requiresFastDelivery ? 1500 : 1000);
      const finalRatePerKm = ratePerKm || 200;
      const finalMaxPerKmFee = maxPerKmFee || 0;

      this.logger.log(
        `Calculating delivery fee for country ${countryCode}: base=${finalBaseFee}, rate=${finalRatePerKm}/km, maxPerKmFee=${finalMaxPerKmFee}, distance=${distanceKm}km, fast=${requiresFastDelivery}`
      );

      const perKmCalculated = distanceKm * finalRatePerKm;
      const perKmFee = Math.min(finalMaxPerKmFee, perKmCalculated);
      const calculatedFee = finalBaseFee + perKmFee;
      const totalFee = calculatedFee;

      this.logger.log(
        `Delivery fee calculated: base=${finalBaseFee}, perKm=${perKmFee}, total=${totalFee})`
      );

      return { baseFee: finalBaseFee, perKmFee, totalFee };
    } catch (error: any) {
      this.logger.error(
        `Failed to calculate tiered delivery fee for country ${countryCode}:`,
        error
      );

      const isCmOrGa = countryCode === 'CM' || countryCode === 'GA';
      // Fallback to hardcoded GA values if configuration lookup fails
      const fallbackConfig = {
        baseFee: requiresFastDelivery ? 1500 : 1000,
        ratePerKm: isCmOrGa ? 100 : 200,
        maxPerKmFee: isCmOrGa ? 1500 : 0,
        minFee: 1000,
      };
      const perKmCalculated = distanceKm * fallbackConfig.ratePerKm;
      const perKmFee = Math.min(fallbackConfig.maxPerKmFee, perKmCalculated);
      const calculatedFee = fallbackConfig.baseFee + perKmFee;
      const totalFee = Math.max(fallbackConfig.minFee, calculatedFee);

      return {
        baseFee: fallbackConfig.baseFee,
        perKmFee,
        totalFee,
      };
    }
  }

  /**
   * Format address for Google Distance Matrix API
   */
  private formatAddress(address: Addresses): string {
    const parts = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ].filter(Boolean);

    return parts.join(', ');
  }

  /**
   * Get item details by ID
   */
  private async getItemDetails(
    itemId: string
  ): Promise<Business_Inventory | null> {
    const query = `
      query GetItem($itemId: uuid!) {
        business_inventory_by_pk(id: $itemId) {
          id
          computed_available_quantity
          selling_price
          item {
            id
            name
            description
            currency
            brand {
              name
            }
          }
          business_location {
            address_id
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      itemId,
    });
    return result.business_inventory_by_pk;
  }

  /**
   * Update reserved quantities for business inventory items
   * Optimized to batch reads and parallelize writes
   */
  async updateReservedQuantities(
    orderItems: any[],
    operation: 'increment' | 'decrement'
  ): Promise<void> {
    try {
      // Filter out items with missing data
      const validItems = orderItems.filter(
        (item) => item.business_inventory_id && item.quantity
      );

      if (validItems.length === 0) {
        this.logger.warn('No valid items to update reserved quantities for');
        return;
      }

      // Log warnings for invalid items
      const invalidItems = orderItems.filter(
        (item) => !item.business_inventory_id || !item.quantity
      );
      if (invalidItems.length > 0) {
          this.logger.warn(
          `Skipping ${
            invalidItems.length
          } items with missing data: ${JSON.stringify(invalidItems)}`
        );
      }

      // Collect all business inventory IDs
      const businessInventoryIds = validItems.map(
        (item) => item.business_inventory_id
      );

      // Batch read: Get all current reserved quantities in a single query
      const getCurrentQuantitiesQuery = `
        query GetCurrentReservedQuantities($ids: [uuid!]!) {
          business_inventory(where: { id: { _in: $ids } }) {
              id
              reserved_quantity
              quantity
            }
          }
        `;

        const currentData = await this.hasuraSystemService.executeQuery(
        getCurrentQuantitiesQuery,
        { ids: businessInventoryIds }
      );

      // Create a map of current quantities for quick lookup
      const quantityMap = new Map<string, number>();
      (currentData.business_inventory || []).forEach((inv: any) => {
        quantityMap.set(inv.id, inv.reserved_quantity || 0);
      });

      // Calculate all new reserved quantities
      const updates = validItems.map((item) => {
        const businessInventoryId = item.business_inventory_id;
        const quantity = item.quantity;
        const currentReservedQuantity =
          quantityMap.get(businessInventoryId) || 0;

        // Calculate new reserved quantity
        const newReservedQuantity =
          operation === 'increment'
            ? currentReservedQuantity + quantity
            : currentReservedQuantity - quantity;

        // Ensure reserved quantity doesn't go below 0
        const finalReservedQuantity = Math.max(0, newReservedQuantity);

        return {
          id: businessInventoryId,
          currentReservedQuantity,
          finalReservedQuantity,
          quantity,
        };
      });

      // Batch update: Execute all updates in parallel
      const updatePromises = updates.map((update) => {
        const updateMutation = `
          mutation UpdateReservedQuantity($id: uuid!, $reservedQuantity: Int!) {
            update_business_inventory_by_pk(
              pk_columns: { id: $id }
              _set: { reserved_quantity: $reservedQuantity }
            ) {
              id
              reserved_quantity
              quantity
            }
          }
        `;

        return this.hasuraSystemService.executeQuery(updateMutation, {
          id: update.id,
          reservedQuantity: update.finalReservedQuantity,
        });
      });

      await Promise.all(updatePromises);

      // Log all updates
      updates.forEach((update) => {
        this.logger.log(
          `Updated reserved quantity for inventory ${update.id}: ${update.currentReservedQuantity} -> ${update.finalReservedQuantity} (${operation} ${update.quantity})`
        );
      });
    } catch (error) {
      this.logger.error(
        `Failed to update reserved quantities: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * Update inventory quantities when an order is completed
   * Decrements both reserved_quantity and total quantity
   */
  private async updateInventoryOnCompletion(
    orderItems: Order_Items[]
  ): Promise<void> {
    try {
      for (const item of orderItems) {
        const businessInventoryId = item.business_inventory_id;
        const quantity = item.quantity;

        if (!businessInventoryId || !quantity) {
          this.logger.warn(
            `Skipping inventory update for item with missing data: ${JSON.stringify(
              item
            )}`
          );
          continue;
        }

        const updateMutation = `
          mutation UpdateInventoryOnCompletion($id: uuid!, $quantity: Int!, $reservedQuantity: Int!) {
            update_business_inventory_by_pk(
              pk_columns: { id: $id }
              _inc: { 
                reserved_quantity: $reservedQuantity
                quantity: $quantity
              }
            ) {
              id
              reserved_quantity
              quantity
            }
          }
        `;

        await this.hasuraSystemService.executeQuery(updateMutation, {
          id: businessInventoryId,
          reservedQuantity: -quantity, // Decrement reserved quantity
          quantity: -quantity, // Decrement total quantity
        });

        this.logger.log(
          `Updated inventory on completion for ${businessInventoryId}: decremented reserved_quantity and quantity by ${quantity}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to update inventory on completion: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }
}

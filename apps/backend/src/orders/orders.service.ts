import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountsService } from '../accounts/accounts.service';
import { AddressesService } from '../addresses/addresses.service';
import { ConfigurationsService } from '../admin/configurations.service';
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
import { MobilePaymentsDatabaseService } from '../mobile-payments/mobile-payments-database.service';
import { MobilePaymentsService } from '../mobile-payments/mobile-payments.service';
import {
  NotificationData,
  NotificationsService,
} from '../notifications/notifications.service';
import { PdfService } from '../pdf/pdf.service';
import { OrderStatusService } from './order-status.service';

export interface OrderStatusChangeRequest {
  orderId: string;
  notes?: string;
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
  access_reason: string;
  client?: {
    id: string;
    user_id: string;
    user: {
      id: string;
      identifier: string;
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
      identifier: string;
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
      identifier: string;
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
    weight?: number;
    weight_unit?: string;
    dimensions?: string;
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
      identifier: string;
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
    private readonly configurationsService: ConfigurationsService,
    private readonly deliveryConfigService: DeliveryConfigService,
    private readonly deliveryWindowsService: DeliveryWindowsService,
    private readonly commissionsService: CommissionsService,
    private readonly pdfService: PdfService
  ) {}

  /**
   * Get agent hold percentage from configuration
   */
  async getAgentHoldPercentage(): Promise<number> {
    try {
      const config = this.configService.get('order');
      return config?.agentHoldPercentage || 80; // Default to 80% if not configured
    } catch (error: any) {
      this.logger.warn(
        `Failed to get agent hold percentage: ${error.message}. Using default 80%.`
      );
      return 80; // Default fallback
    }
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

      // Remove unit_price and total_price from order_items if present
      const orderItems = restOrder.order_items?.map((item: any) => {
        const {
          unit_price: _unit_price,
          total_price: _total_price,
          ...restItem
        } = item;
        return restItem;
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
      if (!user?.agent) {
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
    confirmedBy: string
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

    // Validate that the window is at least 2 hours in the future
    const now = new Date();
    const windowDate = new Date(window.preferred_date);
    const [startHours, startMinutes] = window.time_slot_start
      .split(':')
      .map(Number);
    const windowDateTime = new Date(windowDate);
    windowDateTime.setHours(startHours, startMinutes, 0, 0);

    if (windowDateTime < now) {
      throw new HttpException(
        'Delivery time window is in the past. Please create a new time window.',
        HttpStatus.BAD_REQUEST
      );
    }

    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    if (windowDateTime < twoHoursFromNow) {
      throw new HttpException(
        'Delivery time window must be at least 2 hours from now. Please create a new time window.',
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
    confirmedBy: string
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

    // Validate that the window is at least 2 hours in the future
    const now = new Date();
    const windowDate = new Date(details.preferred_date);
    const [startHours, startMinutes] = slot.start_time.split(':').map(Number);
    const windowDateTime = new Date(windowDate);
    windowDateTime.setHours(startHours, startMinutes, 0, 0);

    if (windowDateTime < now) {
      throw new HttpException(
        'Delivery time window is in the past. Please select a time that is at least 2 hours from now.',
        HttpStatus.BAD_REQUEST
      );
    }

    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    if (windowDateTime < twoHoursFromNow) {
      throw new HttpException(
        'Delivery time window must be at least 2 hours from now. Please select a later time.',
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
    if (!user.business)
      throw new HttpException(
        'Only business users can confirm orders',
        HttpStatus.FORBIDDEN
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

    if (request.delivery_time_window_id) {
      // Confirm existing delivery window
      confirmedWindowId = await this.confirmExistingDeliveryWindow(
        request.delivery_time_window_id,
        request.orderId,
        user.id
      );
    } else if (request.delivery_window_details) {
      // Create new confirmed delivery window
      confirmedWindowId = await this.createConfirmedDeliveryWindow(
        request.delivery_window_details,
        request.orderId,
        user.id
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

  async startPreparing(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business)
      throw new HttpException(
        'Only business users can start preparing orders',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.business.user_id !== user.id)
      throw new HttpException(
        'Unauthorized to start preparing this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'confirmed')
      throw new HttpException(
        `Cannot start preparing order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'preparing'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'preparing',
      'Order preparation started',
      'business',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order preparation started successfully',
    };
  }

  async completePreparation(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business)
      throw new HttpException(
        'Only business users can complete order preparation',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.business.user_id !== user.id)
      throw new HttpException(
        'Unauthorized to complete preparation for this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'preparing')
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

  async claimOrder(request: GetOrderRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent)
      throw new HttpException(
        'Only agent users can get orders',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderWithItems(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.current_status !== 'ready_for_pickup')
      throw new HttpException(
        `Cannot get order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    // Check if order requires verified agent and if agent is verified
    if (order.verified_agent_delivery && !user.agent.is_verified) {
      throw new HttpException(
        'This order requires a verified agent. Please contact support to get your account verified.',
        HttpStatus.FORBIDDEN
      );
    }
    const holdPercentage = this.configService.get('order').agentHoldPercentage;
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
    if (agentAccount.available_balance < holdAmount)
      throw new HttpException(
        `Insufficient balance. Required: ${holdAmount} ${order.currency}, Available: ${agentAccount.available_balance} ${order.currency}`,
        HttpStatus.FORBIDDEN
      );

    const orderHold = await this.getOrCreateOrderHold(order.id);

    await this.updateOrderHold(orderHold.id, {
      agent_hold_amount: holdAmount,
      agent_id: user.agent.id,
    });

    await this.accountsService.registerTransaction({
      accountId: agentAccount.id,
      amount: holdAmount,
      transactionType: 'hold',
      memo: `Hold for order ${order.order_number}`,
      referenceId: order.id,
    });

    const updatedOrder = await this.assignOrderToAgent(
      request.orderId,
      user.agent.id,
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
    if (!user.agent)
      throw new HttpException(
        'Only agent users can claim orders',
        HttpStatus.FORBIDDEN
      );

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

    // Check if order requires verified agent and if agent is verified
    if (order.verified_agent_delivery && !user.agent.is_verified) {
      throw new HttpException(
        'This order requires a verified agent. Please contact support to get your account verified.',
        HttpStatus.FORBIDDEN
      );
    }

    // Get hold percentage and calculate required amount
    const holdPercentage = this.configService.get('order').agentHoldPercentage;
    const holdAmount = (order.subtotal * holdPercentage) / 100;

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
        reference
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

  async pickUpOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent)
      throw new HttpException(
        'Only agent users can pick up orders',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== user.agent.id)
      throw new HttpException(
        'Only the assigned agent can pick up this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'assigned_to_agent')
      throw new HttpException(
        `Cannot pick up order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
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

  async startTransit(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent)
      throw new HttpException(
        'Only agent users can start transit',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== user.agent.id)
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

  async outForDelivery(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent)
      throw new HttpException(
        'Only agent users can mark orders as out for delivery',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== user.agent.id)
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

  async deliverOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent)
      throw new HttpException(
        'Only agent users can deliver orders',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== user.agent.id)
      throw new HttpException(
        'Only the assigned agent can deliver this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'out_for_delivery')
      throw new HttpException(
        `Cannot deliver order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'delivered'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'delivered',
      'Order delivered successfully to customer',
      'agent',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order delivered successfully',
    };
  }

  async completeOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.client)
      throw new HttpException(
        'Only client users can complete orders',
        HttpStatus.FORBIDDEN
      );

    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.client_id !== user.client.id)
      throw new HttpException(
        'Only the client can complete this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'delivered')
      throw new HttpException(
        `Cannot complete order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'complete'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'complete',
      'Order completed by client',
      'client',
      user.id,
      request.notes
    );

    // Update inventory quantities - decrement both reserved and total quantities
    try {
      const orderItems = order.order_items || [];
      await this.updateInventoryOnCompletion(orderItems);
    } catch (error) {
      this.logger.error(
        `Failed to update inventory after order completion: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // Don't fail the completion if inventory update fails
    }

    await this.releaseHoldAndProcessPayment(order.id);

    // Generate receipt automatically after successful completion
    try {
      await this.pdfService.generateReceipt(order.id, order.client.user_id);
      this.logger.log(`Receipt generated for order ${order.id}`);
    } catch (error: any) {
      this.logger.error(`Failed to generate receipt: ${error.message}`);
      // Don't fail completion if receipt generation fails
    }

    return {
      success: true,
      order: updatedOrder,
      message: 'Order completed successfully',
    };
  }

  async failDelivery(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent)
      throw new HttpException(
        'Only agent users can mark deliveries as failed',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== user.agent.id)
      throw new HttpException(
        'Only the assigned agent can mark this delivery as failed',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'out_for_delivery')
      throw new HttpException(
        `Cannot mark delivery as failed in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    // Release the hold since delivery failed
    await this.releaseOrderHold(order, 'failed');

    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'failed'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'failed',
      'Delivery failed - customer not available or other issue',
      'agent',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Delivery marked as failed',
    };
  }

  async cancelOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();

    // Allow both business users and clients to cancel orders
    if (!user.business && !user.client)
      throw new HttpException(
        'Only business users and clients can cancel orders',
        HttpStatus.FORBIDDEN
      );

    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);

    // Check authorization - business can cancel their orders, client can cancel their own orders
    const isBusinessOwner = user.business && order.business.user_id === user.id;
    const isOrderOwner = user.client && order.client_id === user.client.id;

    if (!isBusinessOwner && !isOrderOwner)
      throw new HttpException(
        'Unauthorized to cancel this order',
        HttpStatus.FORBIDDEN
      );

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

    // Calculate cancellation fee for client cancellations after confirmation
    let cancellationFee = 0;
    let refundAmount = 0;

    if (
      isOrderOwner &&
      ['confirmed', 'preparing', 'ready_for_pickup'].includes(
        order.current_status
      )
    ) {
      try {
        // Get cancellation fee configuration for the order's country
        const cancellationConfig =
          await this.configurationsService.getConfigurationByKey(
            'cancellation_fee',
            order.business_location?.address?.country || 'GA'
          );

        if (cancellationConfig && cancellationConfig.number_value) {
          cancellationFee = cancellationConfig.number_value;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to get cancellation fee configuration: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        // Continue without cancellation fee if config is not available
      }
    }

    // Calculate refund amount for response
    if (order.current_status !== 'pending_payment') {
      const orderHold = await this.getOrCreateOrderHold(order.id);
      refundAmount = orderHold.client_hold_amount - cancellationFee;
    }

    // If order was assigned to agent, release the agent hold
    // Skip releasing holds for pending_payment orders since no holds have been placed yet
    if (order.current_status !== 'pending_payment') {
      await this.releaseOrderHold(order, 'cancelled', cancellationFee);
    }

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

    return {
      success: true,
      order: updatedOrder,
      message: 'Order cancelled successfully',
      cancellationFee: cancellationFee,
      refundAmount: refundAmount,
    };
  }

  async refundOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business)
      throw new HttpException(
        'Only business users can refund orders',
        HttpStatus.FORBIDDEN
      );

    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);

    if (order.business.user_id !== user.id)
      throw new HttpException(
        'Unauthorized to refund this order',
        HttpStatus.FORBIDDEN
      );

    // Check if order can be refunded - only delivered or failed orders
    const refundableStatuses = ['delivered', 'failed'];
    if (!refundableStatuses.includes(order.current_status))
      throw new HttpException(
        `Cannot refund order in ${order.current_status} status. Only delivered or failed orders can be refunded.`,
        HttpStatus.BAD_REQUEST
      );

    // Get order hold details
    const orderHold = await this.getOrCreateOrderHold(request.orderId);
    if (!orderHold) {
      throw new HttpException(
        'Order hold details not found',
        HttpStatus.NOT_FOUND
      );
    }

    // Credit the client with the client_hold_amount
    if (orderHold.client_hold_amount > 0) {
      const clientAccount = await this.hasuraSystemService.getAccount(
        order.client.user_id,
        order.currency
      );

      if (!clientAccount) {
        throw new HttpException(
          'Client account not found',
          HttpStatus.NOT_FOUND
        );
      }

      await this.accountsService.registerTransaction({
        accountId: clientAccount.id,
        amount: orderHold.client_hold_amount,
        transactionType: 'release',
        memo: `Refund for order ${order.order_number}`,
        referenceId: order.id,
      });
    }

    // Update order status to refunded
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'refunded'
    );

    // Update order hold status to completed
    await this.updateOrderHold(orderHold.id, {
      status: 'completed',
    });

    await this.createStatusHistoryEntry(
      request.orderId,
      'refunded',
      'Order refunded by business',
      'business',
      user.id,
      request.notes
    );

    return {
      success: true,
      order: updatedOrder,
      message: 'Order refunded successfully',
    };
  }

  /**
   * Fetch orders for the current user (client, agent, or business) with optional filters
   */
  async getOrders(filters?: any): Promise<Orders[]> {
    const user = await this.hasuraUserService.getUser();
    let personaFilter: any = {};
    if (user.user_type_id === 'client' && user.client) {
      personaFilter = { client_id: { _eq: user.client.id } };
    } else if (user.user_type_id === 'agent' && user.agent) {
      personaFilter = { assigned_agent_id: { _eq: user.agent.id } };
    } else if (user.user_type_id === 'business' && user.business) {
      personaFilter = { business_id: { _eq: user.business.id } };
    } else {
      throw new HttpException(
        'Invalid user persona for orders query',
        HttpStatus.FORBIDDEN
      );
    }

    // Merge persona filter with any additional filters
    const where = filters ? { _and: [personaFilter, filters] } : personaFilter;

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
          }
          assigned_agent {
            id
            user {
              id
              first_name
              last_name
              email
            }
          }
          order_items {
            id
            item_name
            item_description
            unit_price
            quantity
            total_price
            weight
            item {
              sku
              currency
              model
              color
              weight
              weight_unit
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
              item_images {
                id
                image_url
              }
            }
            weight_unit
            dimensions
            special_instructions
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

    // Transform orders for agents to show commission amounts
    const agentInfo = await this.getAgentInfo();
    if (agentInfo?.isAgent) {
      // Get commission config and hold percentage once for all orders
      const commissionConfig =
        await this.commissionsService.getCommissionConfigs();
      const holdPercentage = await this.getAgentHoldPercentage();
      return this.transformOrdersForAgentSync(
        result.orders,
        agentInfo.isVerified,
        commissionConfig,
        holdPercentage
      );
    }

    return result.orders;
  }

  async getOpenOrders() {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent) {
      throw new HttpException(
        'Only agent users can view open orders',
        HttpStatus.FORBIDDEN
      );
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
            }
          }
          
          delivery_address {
            address_line_1
            city
            state
            country
            postal_code
          }
          currency
          current_status
          verified_agent_delivery
          created_at
          order_items {
            id
            item_name
            item {
              model
              color
              weight
              weight_unit
              brand {
                name
              }
              item_sub_category {
                name
                item_category {
                  name
                }
              }
              item_images {
                image_url
              }
            }
            quantity
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query);

    // Filter orders based on agent's location matching business location
    const filteredOrders = result.orders.filter((order: any) => {
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
    const holdPercentage = await this.getAgentHoldPercentage();
    const transformedOrders = this.transformOrdersForAgentSync(
      filteredOrders,
      user.agent.is_verified || false,
      commissionConfig,
      holdPercentage
    );

    return { success: true, orders: transformedOrders };
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

    if (user.business) {
      // Business users can access if they own the order or are admin
      if (order.business_id === user.business.id) {
        hasAccess = true;
        accessReason = 'business_owner';
      } else if (user.business.is_admin) {
        hasAccess = true;
        accessReason = 'admin_business';
      }
    } else if (user.client && order.client_id === user.client.id) {
      // Client can access their own orders
      hasAccess = true;
      accessReason = 'order_client';
    } else if (
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
    const isAgent = user.agent !== null;
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
          client {
            id
            user_id
            user {
              id
              identifier
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
              identifier
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
              identifier
              first_name
              last_name
              email
              phone_number
            }
          }
          order_items {
            id
            business_inventory_id
            item_id
            item_name
            item_description
            quantity
            weight
            weight_unit
            dimensions
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
              item_images {
                id
                image_url
                alt_text
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
              identifier
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
          client {
            id
            user_id
            user {
              id
              identifier
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
              identifier
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
              identifier
              first_name
              last_name
              email
              phone_number
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
            weight
            weight_unit
            dimensions
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
              item_images {
                id
                image_url
                alt_text
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
              identifier
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
      const holdPercentage = await this.getAgentHoldPercentage();
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

    if (user.business) {
      // Business users can access if they own the order or are admin
      if (order.business_id === user.business.id || user.business.is_admin) {
        hasAccess = true;
      }
    } else if (user.client && order.client_id === user.client.id) {
      // Client can access their own orders
      hasAccess = true;
    } else if (
      user.agent &&
      (order.assigned_agent_id === user.agent.id ||
        order.assigned_agent_id === null)
    ) {
      // Agent can access orders assigned to them
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
            identifier
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

    if (user.business) {
      // Business users can access if they own the order or are admin
      if (order.business_id === user.business.id || user.business.is_admin) {
        hasAccess = true;
      }
    } else if (user.client && order.client_id === user.client.id) {
      // Client can access their own orders
      hasAccess = true;
    } else if (
      user.agent &&
      (order.assigned_agent_id === user.agent.id ||
        order.assigned_agent_id === null)
    ) {
      // Agent can access orders assigned to them
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
            identifier
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
    if (!user.agent) {
      throw new HttpException(
        'Only agent users can drop orders',
        HttpStatus.FORBIDDEN
      );
    }
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
    if (order.assigned_agent_id !== user.agent.id) {
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
      user.agent.user_id,
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
          tax_amount
          total_amount
          currency
          business_id
          client_id
          delivery_address_id
          client {
            user_id
          }
          business {
            user_id
          }
          business_location {
            address_id
          }
          assigned_agent_id
          assigned_agent {
            user_id
            is_verified
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
          tax_amount
          total_amount
          currency
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
            }
          }
          business_location {
            id
            address_id
            business {
              id
              name
              is_verified
              user {
                id
                email
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
          }
          assigned_agent_id
          assigned_agent {
            user_id
            user {
              id
              first_name
              last_name
              email
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
      const holdPercentage = await this.getAgentHoldPercentage();
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
   * Process order payment - handles hold transactions and notifications
   */
  async processOrderPayment(transaction: any): Promise<void> {
    try {
      // Get order details by order number (reference)
      const order = await this.getOrderByNumber(transaction.reference);

      // Register hold transactions for order amount and delivery fee
      await this.accountsService.registerTransaction({
        accountId: transaction.account_id,
        amount: order.subtotal,
        transactionType: 'hold',
        memo: `Hold for order ${order.order_number}`,
        referenceId: order.id,
      });

      // Calculate total delivery fees (base delivery fee + per-km delivery fee)
      const totalDeliveryFees =
        order.base_delivery_fee + order.per_km_delivery_fee;

      await this.accountsService.registerTransaction({
        accountId: transaction.account_id,
        amount: totalDeliveryFees,
        transactionType: 'hold',
        memo: `Hold for order ${order.order_number} delivery fees (base: ${order.base_delivery_fee}, per-km: ${order.per_km_delivery_fee})`,
        referenceId: order.id,
      });

      // Create or update order hold
      const orderHold = await this.getOrCreateOrderHold(order.id);
      await this.updateOrderHold(orderHold.id, {
        client_hold_amount: order.subtotal,
        delivery_fees: totalDeliveryFees,
      });

      // Update order status from pending_payment to pending and payment_status to paid
      await this.updateOrderStatusAndPaymentStatus(order.id, 'pending', 'paid');

      // Send order creation notifications
      try {
        // Check if notifications are enabled
        const notificationsEnabled =
          this.configService.get('notification').orderStatusChangeEnabled;

        if (notificationsEnabled) {
          // Validate required data before creating notification data
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
            businessName: order.business_location.business.name,
            businessEmail: order.business_location.business.user.email,
            businessVerified:
              order.business_location.business.is_verified || false,
            orderStatus: order.current_status,
            orderItems:
              order.order_items?.map((item: any) => ({
                name: item.item_name || 'Unknown Item',
                quantity: item.quantity || 0,
                unitPrice: item.unit_price || 0,
                totalPrice: item.total_price || 0,
              })) || [],
            subtotal: order.subtotal || 0,
            deliveryFee: order.base_delivery_fee || 0,
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
        } else {
          this.logger.log(
            `Order creation notifications disabled for order ${order.order_number}`
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to send order creation notifications: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        // Don't fail the order processing if notifications fail
      }
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

      if (!user || !user.agent) {
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

      // Update order status to cancelled
      await this.orderStatusService.updateOrderStatus(orderId, 'cancelled');

      // Get user ID from the order (client user)
      const userId = order.client?.user?.id;
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

  /**
   * Creates a random 8-digit order number
   */
  private createOrderNumber(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  /**
   * Get payment provider based on phone number
   */
  private getProvider(
    phoneNumber: string
  ): 'airtel' | 'mypvit' | 'moov' | 'mtn' {
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

    if (phoneNumber.startsWith('+241')) {
      return 'airtel';
    }

    throw new HttpException(
      {
        success: false,
        message: 'Phone number not yet supported for mobile payments',
        error: 'UNSUPPORTED_PHONE_NUMBER',
        data: {
          phoneNumber,
          supportedPrefixes: ['+241 (Airtel)'],
        },
      },
      HttpStatus.BAD_REQUEST
    );
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

    if (!user.client) {
      throw new Error('Client not found');
    }

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
            currency
            weight
          }
        }
      }
    `;

    const businessInventoryIds = orderData.items.map(
      (item: OrderItem) => item.business_inventory_id
    );
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

    // Validate all items are from the same business
    const businessIds = [
      ...new Set(
        businessInventories.map((inv) => inv.business_location.business_id)
      ),
    ];
    if (businessIds.length > 1) {
      throw new Error('All items must be from the same business');
    }

    // Validate all items are active and have sufficient quantity
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

      if (item.quantity > businessInventory.computed_available_quantity) {
        throw new Error(
          `Insufficient quantity for item ${businessInventory.item.name}. Available: ${businessInventory.computed_available_quantity}, Requested: ${item.quantity}`
        );
      }
    }

    // Use the first item's currency (all items should have the same currency from same business)
    const currency = businessInventories[0].item.currency;

    // Calculate total weight for delivery fee calculation
    const totalWeight = businessInventories.reduce(
      (sum, inv, idx) =>
        sum + (inv.item.weight || 0) * orderData.items[idx].quantity,
      0
    );

    // Calculate delivery fee using the new structure
    const deliveryFeeInfo = await this.calculateItemDeliveryFee(
      orderData.items[0].business_inventory_id,
      orderData.delivery_address?.id,
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
    const totalAmount = businessInventories.reduce(
      (sum, inv, idx) =>
        sum + inv.selling_price * orderData.items[idx].quantity,
      0
    );

    const total_amount = totalAmount + deliveryFeeInfo.deliveryFee;
    const phoneNumber = orderData.phone_number || user.phone_number || '';
    const provider = this.getProvider(phoneNumber);

    // Create transaction record before initiating payment
    let paymentTransaction = null;
    let transaction = null;
    try {
      // Create transaction record in database
      transaction = await this.mobilePaymentsDatabaseService.createTransaction({
        reference: orderNumber,
        amount: total_amount,
        currency: currency,
        description: `order ${orderNumber}`,
        provider: provider,
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
        currency: currency,
        description: `Order ${orderNumber}`,
        customerPhone: user.phone_number || '',
        provider: provider,
        ownerCharge: 'MERCHANT' as const,
        transactionType: 'PAYMENT' as const,
        payment_entity: 'order' as const,
      };

      paymentTransaction = await this.mobilePaymentsService.initiatePayment(
        paymentRequest,
        orderNumber
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
              orderNumber,
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
        `Payment initiated successfully for order ${orderNumber}, transaction ID: ${paymentTransaction.transactionId}`
      );
    } catch (paymentError) {
      this.logger.error(
        `Failed to initiate payment for order ${orderNumber}:`,
        paymentError
      );

      // Update transaction status to failed if transaction was created
      if (transaction) {
        try {
          await this.mobilePaymentsDatabaseService.updateTransaction(
            transaction.id,
            {
              status: 'failed',
              error_message: 'Payment initiation error',
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

    const business_location_id = businessInventories[0].business_location_id;
    const delivery_address_id = address.id;
    const subtotal = totalAmount;
    const tax_amount = 0;
    const current_status = 'pending_payment';
    const business_id = businessInventories[0].business_location.business_id;
    const payment_method = 'online';
    const payment_status = 'pending';
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
        $currentStatus: order_status!,
        $paymentMethod: String!,
        $paymentStatus: String!,
        $specialInstructions: String!,
        $estimatedDeliveryTime: timestamptz,
        $preferredDeliveryTime: timestamptz,
        $actualDeliveryTime: timestamptz,
        $assignedAgentId: uuid,
        $verifiedAgentDelivery: Boolean!,
        $requiresFastDelivery: Boolean!
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
          base_delivery_fee: $baseDeliveryFee,
          per_km_delivery_fee: $perKmDeliveryFee,
          subtotal: $subTotal,
          tax_amount: $taxAmount,
          total_amount: $totalAmount,
          special_instructions: $specialInstructions,
          actual_delivery_time: $actualDeliveryTime,
          estimated_delivery_time: $estimatedDeliveryTime,
          preferred_delivery_time: $preferredDeliveryTime,
          current_status: $currentStatus,
          assigned_agent_id: $assignedAgentId,
          verified_agent_delivery: $verifiedAgentDelivery,
          requires_fast_delivery: $requiresFastDelivery,
          order_items: {
            data: $orderItems
          }
        }) {
          id
          currency
          order_number
          payment_method
          payment_status
          base_delivery_fee
          per_km_delivery_fee
          subtotal
          tax_amount
          total_amount
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
      return {
        business_inventory_id: item.business_inventory_id,
        item_id: businessInventory.item.id,
        item_name: businessInventory.item.name,
        item_description: businessInventory.item.description,
        quantity: item.quantity,
        unit_price: businessInventory.selling_price,
        total_price: businessInventory.selling_price * item.quantity,
      };
    });

    // Create the order
    const orderResult = await this.hasuraSystemService.executeMutation(
      createOrderMutation,
      {
        clientId: user.client.id,
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
        currentStatus: current_status,
        paymentMethod: payment_method,
        paymentStatus: payment_status,
        specialInstructions: special_instructions,
        estimatedDeliveryTime: estimated_delivery_time,
        preferredDeliveryTime: preferred_delivery_time,
        actualDeliveryTime: actual_delivery_time,
        assignedAgentId: assigned_agent_id,
        verifiedAgentDelivery: verified_agent_delivery,
        requiresFastDelivery: requires_fast_delivery,
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
        status: 'pending_payment',
        notes: 'Order created, awaiting payment',
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

    return {
      ...order,
      total_amount: total_amount,
      delivery_window: deliveryWindow,
      payment_transaction: {
        success: paymentTransaction.success,
        transaction_id: paymentTransaction.transactionId,
        message: paymentTransaction.message,
      },
      database_transaction: {
        id: transaction.id,
        reference: transaction.reference,
        status: transaction.status,
      },
    };
  }

  /**
   * Get or create an order hold for the given order ID
   */
  async getOrCreateOrderHold(
    orderId: string,
    deliveryFees = 0
  ): Promise<Order_Holds> {
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

  private async releaseOrderHold(
    order: any,
    status: string,
    cancellationFee = 0
  ) {
    const orderHold = await this.getOrCreateOrderHold(order.id);

    if (order.assigned_agent?.user_id) {
      const agentAccount = await this.hasuraSystemService.getAccount(
        order.assigned_agent.user_id,
        order.currency
      );

      await this.accountsService.registerTransaction({
        accountId: agentAccount.id,
        amount: orderHold.agent_hold_amount,
        transactionType: 'release',
        memo: `Hold released for order ${order.order_number}`,
        referenceId: order.id,
      });
    }

    const clientAccount = await this.hasuraSystemService.getAccount(
      order.client.user_id,
      order.currency
    );

    // Calculate refund amount after deducting cancellation fee
    const refundAmount = orderHold.client_hold_amount - cancellationFee;

    if (refundAmount > 0) {
      await this.accountsService.registerTransaction({
        accountId: clientAccount.id,
        amount: refundAmount,
        transactionType: 'release',
        memo: `Hold released for order ${order.order_number}${
          cancellationFee > 0
            ? ` (cancellation fee: ${cancellationFee} deducted)`
            : ''
        }`,
        referenceId: order.id,
      });
    }

    // If there's a cancellation fee, create a separate transaction to record it
    if (cancellationFee > 0) {
      await this.accountsService.registerTransaction({
        accountId: clientAccount.id,
        amount: cancellationFee,
        transactionType: 'fee',
        memo: `Cancellation fee for order ${order.order_number}`,
        referenceId: order.id,
      });
    }

    await this.accountsService.registerTransaction({
      accountId: clientAccount.id,
      amount: orderHold.delivery_fees,
      transactionType: 'release',
      memo: `Hold released for order ${order.order_number} delivery fee`,
      referenceId: order.id,
    });

    await this.updateOrderHold(orderHold.id, {
      status: status,
    });
  }

  private async releaseHoldAndProcessPayment(
    referenceId: string
  ): Promise<void> {
    const order = await this.getOrderDetails(referenceId);

    if (
      !order ||
      !order.business ||
      !order.business.user_id ||
      !order.client_id
    ) {
      throw new Error('Order, business user, or client not found');
    }

    const orderHold = await this.getOrCreateOrderHold(referenceId);

    // Release holds first
    if (order.assigned_agent) {
      const agentAccount = await this.hasuraSystemService.getAccount(
        order.assigned_agent.user_id,
        order.currency
      );

      await this.accountsService.registerTransaction({
        accountId: agentAccount.id,
        amount: orderHold.agent_hold_amount,
        transactionType: 'release',
        memo: `Hold released for order ${order.order_number}`,
        referenceId: referenceId,
      });
    }

    const clientAccount = await this.hasuraSystemService.getAccount(
      order.client.user_id,
      order.currency
    );

    await this.accountsService.registerTransaction({
      accountId: clientAccount.id,
      amount: orderHold.client_hold_amount,
      transactionType: 'release',
      memo: `Hold released for order ${order.order_number}`,
      referenceId: referenceId,
    });

    await this.accountsService.registerTransaction({
      accountId: clientAccount.id,
      amount: orderHold.delivery_fees,
      transactionType: 'release',
      memo: `Hold released for order ${order.order_number} delivery fee`,
      referenceId: referenceId,
    });

    await this.accountsService.registerTransaction({
      accountId: clientAccount.id,
      amount: order.total_amount,
      transactionType: 'payment',
      memo: `Order payment received for order ${order.order_number}`,
      referenceId: referenceId,
    });

    // Now distribute commissions using the new commission system
    try {
      await this.commissionsService.distributeCommissions(order);
      this.logger.log(
        `Successfully distributed commissions for order ${order.order_number}`
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to distribute commissions for order ${order.order_number}: ${error.message}`
      );
      // Don't fail the order completion if commission distribution fails
      // The order should still be marked as complete
    }

    await this.updateOrderHold(orderHold.id, {
      status: 'completed',
    });
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
  }> {
    try {
      // Get user for authorization
      const user = await this.hasuraUserService.getUser();
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Get item details
      const item = await this.getItemDetails(itemId);
      if (!item) {
        throw new HttpException('Item not found', HttpStatus.NOT_FOUND);
      }

      // Get user's address (use provided addressId or fallback to primary address)
      const targetAddressId = addressId || user.addresses?.[0]?.id || '';
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

          // Calculate fee using tiered pricing model
          const feeComponents = await this.calculateTieredDeliveryFee(
            distanceKm,
            businessAddress.country,
            requiresFastDelivery
          );

          return {
            deliveryFee: feeComponents.totalFee,
            baseDeliveryFee: feeComponents.baseFee,
            perKmDeliveryFee: feeComponents.perKmFee,
            distance: distanceKm,
            method: 'distance_based',
            currency: item.item.currency,
            country: businessAddress.country,
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

      let finalDeliveryFee = flatFee;

      // Add fast delivery fee if required
      if (requiresFastDelivery) {
        const fastDeliveryConfig = await this.getFastDeliveryFee(
          userAddress.state || '',
          userAddress.country || ''
        );

        if (fastDeliveryConfig.enabled) {
          finalDeliveryFee += fastDeliveryConfig.fee;
        }
      }

      return {
        deliveryFee: finalDeliveryFee,
        method: 'flat_fee',
        currency: item.item.currency,
        country: businessAddress.country,
        baseDeliveryFee: flatFee,
        perKmDeliveryFee: 0,
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

      // Get client address
      const clientAddresses = await this.addressesService.getAddressesByIds([
        order.delivery_address_id,
      ]);
      const clientAddress = clientAddresses[0];
      if (!clientAddress) {
        throw new HttpException(
          'Client address not found',
          HttpStatus.NOT_FOUND
        );
      }

      // Get business location address
      const businessAddresses = await this.addressesService.getAddressesByIds([
        order.business_location.address_id,
      ]);
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
      const [baseFee, ratePerKm] = await Promise.all([
        requiresFastDelivery
          ? this.deliveryConfigService.getFastDeliveryBaseFee(countryCode)
          : this.deliveryConfigService.getNormalDeliveryBaseFee(countryCode),
        this.deliveryConfigService.getPerKmDeliveryFee(countryCode),
      ]);

      // Use fallback values if configurations are not found
      const finalBaseFee = baseFee || (requiresFastDelivery ? 1500 : 1000);
      const finalRatePerKm = ratePerKm || 200;

      this.logger.log(
        `Calculating delivery fee for country ${countryCode}: base=${finalBaseFee}, rate=${finalRatePerKm}/km, distance=${distanceKm}km, fast=${requiresFastDelivery}`
      );

      const perKmFee = distanceKm * finalRatePerKm;
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

      // Fallback to hardcoded GA values if configuration lookup fails
      const fallbackConfig = {
        baseFee: requiresFastDelivery ? 1500 : 1000,
        ratePerKm: 200,
        minFee: 1000,
      };
      const perKmFee = distanceKm * fallbackConfig.ratePerKm;
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
  private async updateReservedQuantities(
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
          mutation UpdateInventoryOnCompletion($id: uuid!, $quantity: Int!) {
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

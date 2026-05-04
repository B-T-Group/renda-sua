import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigurationsService } from '../admin/configurations.service';
import { Public } from '../auth/public.decorator';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import type { CreateOrderRequest } from '../hasura/hasura-user.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { OrderStatusService } from './order-status.service';
import type {
  BatchOrderStatusChangeRequest,
  BatchOrderStatusChangeResult,
  CompleteDeliveryRequest,
  ConfirmOrderRequest,
  GetOrderRequest,
  OrderStatusChangeRequest,
} from './orders.service';
import { OrdersService } from './orders.service';

export interface UpdateOrderStatusRequest {
  status: string;
}

@ApiTags('Orders')
@Controller('orders')
@Throttle({ short: { limit: 30, ttl: 60000 } })
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderStatusService: OrderStatusService,
    private readonly deliveryConfigService: DeliveryConfigService,
    private readonly configurationsService: ConfigurationsService,
    private readonly loyaltyService: LoyaltyService
  ) {}

  @Get('discount-codes/validate')
  @ApiOperation({ summary: 'Validate a discount code for checkout' })
  @ApiQuery({ name: 'code', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Discount code validation result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        discountPercentage: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async validateDiscountCode(@Query('code') code: string) {
    const clientId = await this.ordersService.getCurrentClientId();

    const result = await this.loyaltyService.validateDiscountCode(code || '');
    if (!result.valid || !result.percentage) {
      return {
        valid: false,
        discountPercentage: 0,
        message: 'Invalid or already used discount code',
      };
    }

    if (clientId && result.createdForClientId === clientId) {
      return {
        valid: false,
        discountPercentage: 0,
        message:
          "You can't use a discount code you generated yourself. Share it with a friend or family member instead.",
      };
    }

    return {
      valid: true,
      discountPercentage: result.percentage,
      message: 'Discount code is valid',
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create order with multiple items' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              business_inventory_id: { type: 'string', format: 'uuid' },
              quantity: { type: 'number', minimum: 1 },
              item_variant_id: {
                type: 'string',
                format: 'uuid',
                description:
                  'Selected catalog variant when the item has multiple active variants',
              },
            },
            required: ['business_inventory_id', 'quantity'],
          },
        },
        delivery_address_id: { type: 'string', format: 'uuid' },
        fulfillment_method: {
          type: 'string',
          enum: ['delivery', 'pickup'],
          description:
            'delivery (default): ship to delivery_address_id; pickup: collect at business location, no delivery fee, requires pay_at_pickup.',
        },
        special_instructions: { type: 'string' },
        verified_agent_delivery: { type: 'boolean' },
        phone_number: { type: 'string' },
        requires_fast_delivery: { type: 'boolean' },
        payment_timing: {
          type: 'string',
          enum: ['pay_now', 'pay_at_delivery', 'pay_at_pickup'],
          description:
            'Client-selected payment timing. pay_now preserves current behavior; pay_at_delivery defers mobile payment until delivery; pay_at_pickup defers payment until business initiates at pickup.',
        },
        delivery_window: {
          type: 'object',
          properties: {
            slot_id: { type: 'string' },
            preferred_date: { type: 'string', format: 'date' },
            special_instructions: { type: 'string' },
          },
        },
      },
      required: ['items'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        order: { type: 'object' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data or insufficient stock',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - User or address not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  })
  async createOrder(@Body() orderData: CreateOrderRequest) {
    try {
      const isPickup = orderData.fulfillment_method === 'pickup';
      if (!isPickup && !orderData.delivery_address_id) {
        throw new HttpException(
          'Delivery address ID is required for delivery orders',
          HttpStatus.BAD_REQUEST
        );
      }

      const order = await this.ordersService.createOrder(orderData);

      return {
        success: true,
        order,
        message: 'Order created successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      // Convert service errors to appropriate HTTP exceptions
      const errorMessage = error.message || 'Internal server error';
      let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

      if (errorMessage.includes('User not found')) {
        statusCode = HttpStatus.NOT_FOUND;
      } else if (
        errorMessage.includes('No valid items found') ||
        errorMessage.includes('Item') ||
        errorMessage.includes('No account found') ||
        errorMessage.includes('Insufficient')
      ) {
        statusCode = HttpStatus.BAD_REQUEST;
      }

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        statusCode
      );
    }
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({
    status: 409,
    description:
      'Order status was already updated (concurrent request or stale state)',
  })
  async updateOrderStatus(
    @Param('id') orderId: string,
    @Body() updateData: UpdateOrderStatusRequest
  ) {
    try {
      const order = await this.orderStatusService.updateOrderStatus(
        orderId,
        updateData.status
      );

      return {
        success: true,
        order,
        message: 'Order status updated successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error.message || 'Internal server error';
      let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

      if (errorMessage.includes('Order not found')) {
        statusCode = HttpStatus.NOT_FOUND;
      } else if (
        errorMessage.includes('Invalid status transition') ||
        errorMessage.includes('Unauthorized')
      ) {
        statusCode = HttpStatus.BAD_REQUEST;
      }

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        statusCode
      );
    }
  }

  @Post('confirm')
  async confirmOrder(@Body() request: ConfirmOrderRequest) {
    return this.ordersService.confirmOrder(request);
  }

  @Post('complete_preparation')
  @ApiOperation({
    summary: 'Mark order ready for pickup',
    description:
      'Business users can transition confirmed (or preparing) orders to ready_for_pickup in a single operation.',
  })
  async completePreparation(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.completePreparation(request);
  }

  @Post('batch/complete_preparation')
  @ApiOperation({
    summary: 'Mark multiple orders ready for pickup',
    description:
      'Business users can mark multiple confirmed or preparing orders as ready_for_pickup in a single operation.',
  })
  @ApiBody({
    description: 'Batch complete preparation request',
    type: Object,
  })
  @ApiResponse({
    status: 200,
    description: 'Batch complete preparation completed with per-order results',
    type: Object,
  })
  async completePreparationBatch(
    @Body() request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResult> {
    return this.ordersService.completePreparationBatch(request);
  }

  @Post('pick_up')
  async pickUpOrder(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.pickUpOrder(request);
  }

  @Post('batch/pick_up')
  @ApiOperation({
    summary: 'Pick up multiple orders',
    description:
      'Assigned agents can mark multiple assigned_to_agent orders as picked_up in a single operation.',
  })
  @ApiBody({
    description: 'Batch pick up request',
    type: Object,
  })
  @ApiResponse({
    status: 200,
    description: 'Batch pick up completed with per-order results',
    type: Object,
  })
  async pickUpOrderBatch(
    @Body() request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResult> {
    return this.ordersService.pickUpOrderBatch(request);
  }

  @Post('start_transit')
  async startTransit(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.startTransit(request);
  }

  @Post('batch/start_transit')
  @ApiOperation({
    summary: 'Start transit for multiple orders',
    description:
      'Assigned agents can transition multiple picked_up orders to in_transit in a single operation.',
  })
  @ApiBody({
    description: 'Batch start transit request',
    type: Object,
  })
  @ApiResponse({
    status: 200,
    description: 'Batch start transit completed with per-order results',
    type: Object,
  })
  async startTransitBatch(
    @Body() request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResult> {
    return this.ordersService.startTransitBatch(request);
  }

  @Post('out_for_delivery')
  async outForDelivery(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.outForDelivery(request);
  }

  @Post('batch/out_for_delivery')
  @ApiOperation({
    summary: 'Mark multiple orders as out for delivery',
    description:
      'Assigned agents can transition multiple in_transit or picked_up orders to out_for_delivery in a single operation.',
  })
  @ApiBody({
    description: 'Batch out for delivery request',
    type: Object,
  })
  @ApiResponse({
    status: 200,
    description: 'Batch out for delivery completed with per-order results',
    type: Object,
  })
  async outForDeliveryBatch(
    @Body() request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResult> {
    return this.ordersService.outForDeliveryBatch(request);
  }

  @Post('deliver')
  async deliverOrder(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.deliverOrder(request);
  }

  @Post('batch/deliver')
  @ApiOperation({
    summary: 'Deliver multiple orders',
    description:
      'Assigned agents can transition multiple out_for_delivery orders to delivered in a single operation.',
  })
  @ApiBody({
    description: 'Batch deliver request',
    type: Object,
  })
  @ApiResponse({
    status: 200,
    description: 'Batch deliver completed with per-order results',
    type: Object,
  })
  async deliverOrderBatch(
    @Body() request: BatchOrderStatusChangeRequest
  ): Promise<BatchOrderStatusChangeResult> {
    return this.ordersService.deliverOrderBatch(request);
  }

  @Post('complete')
  async completeOrder(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.completeOrder(request);
  }

  @Post('complete-delivery')
  @ApiOperation({
    summary: 'Complete delivery with PIN or overwrite code',
    description:
      'Agent completes order in one step (out_for_delivery → complete) by entering the client PIN or business overwrite code. On 3 wrong PIN attempts a strike is recorded; 3 strikes in the month suspends the agent.',
  })
  @ApiBody({
    description: 'Order ID and either pin or overwriteCode',
    schema: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'string', format: 'uuid' },
        pin: { type: 'string', description: '4-digit delivery PIN' },
        overwriteCode: { type: 'string', description: 'Overwrite code from business' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Delivery completed successfully' })
  @ApiResponse({ status: 403, description: 'Invalid PIN, max attempts reached, or account suspended' })
  async completeDelivery(@Body() request: CompleteDeliveryRequest) {
    return this.ordersService.completeDelivery(request);
  }

  @Post(':id/initiate-pay-at-delivery-payment')
  @ApiOperation({
    summary: 'Initiate pay-at-delivery mobile payment (agent only)',
    description:
      'For pay-at-delivery orders, the assigned agent triggers a mobile payment request at the doorstep. On successful payment callback, the order is automatically settled and marked complete.',
  })
  @ApiResponse({ status: 200, description: 'Payment request initiated' })
  @ApiResponse({ status: 400, description: 'Invalid order state or missing data' })
  @ApiResponse({ status: 403, description: 'Not authorized for this order' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description:
            'Optional override phone number to receive the payment request (E.164).',
        },
      },
    },
  })
  async initiatePayAtDeliveryPayment(
    @Param('id') orderId: string,
    @Body() body: { phone_number?: string }
  ) {
    return this.ordersService.initiatePayAtDeliveryPayment(
      orderId,
      body?.phone_number
    );
  }

  @Post(':id/initiate-pay-at-pickup-payment')
  @ApiOperation({
    summary: 'Initiate pay-at-pickup mobile payment (business only)',
    description:
      'For pay-at-pickup orders in ready_for_pickup, the business triggers a mobile payment request to the client. On successful payment callback, the order is settled and marked complete.',
  })
  @ApiResponse({ status: 200, description: 'Payment request initiated' })
  @ApiResponse({ status: 400, description: 'Invalid order state or missing data' })
  @ApiResponse({ status: 403, description: 'Not authorized for this order' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description:
            'Optional override phone number to receive the payment request (E.164).',
        },
      },
    },
  })
  async initiatePayAtPickupPayment(
    @Param('id') orderId: string,
    @Body() body: { phone_number?: string }
  ) {
    return this.ordersService.initiatePayAtPickupPayment(
      orderId,
      body?.phone_number
    );
  }

  @Post(':id/mark-paid-in-cash-exception')
  @ApiOperation({
    summary: 'Mark pay-at-delivery order as paid in cash (exception, agent only)',
    description:
      'Fallback when mobile payment fails at delivery. Marks the order complete operationally and flags it for business manual reconciliation.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        notes: { type: 'string' },
      },
    },
  })
  async markPaidInCashException(
    @Param('id') orderId: string,
    @Body() body: { notes?: string }
  ) {
    return this.ordersService.markPaidInCashException(orderId, body?.notes);
  }

  @Post(':id/reconcile-cash-exception')
  @ApiOperation({
    summary: 'Reconcile a cash-exception order via mobile payment (business only)',
    description:
      'Starts mobile money collection from the given payer phone. On success, the payment callback settles business/agent/rendasua shares without posting to the client wallet.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['customerPhone'],
      properties: {
        customerPhone: {
          type: 'string',
          description: 'MSISDN to charge (external payer; not recorded on client account)',
        },
        reference: { type: 'string' },
        notes: { type: 'string' },
      },
    },
  })
  async reconcileCashException(
    @Param('id') orderId: string,
    @Body() body: { customerPhone: string; reference?: string; notes?: string }
  ) {
    return this.ordersService.reconcileCashException(
      orderId,
      body.customerPhone,
      body?.reference,
      body?.notes
    );
  }

  @Get(':id/delivery-pin')
  @ApiOperation({
    summary: 'Get delivery PIN (client only, one-time)',
    description: 'Returns the 4-digit delivery PIN for the order. Only the order client can call this; PIN is returned once then invalidated.',
  })
  @ApiResponse({ status: 200, description: 'PIN returned' })
  @ApiResponse({ status: 410, description: 'PIN already retrieved or expired' })
  async getDeliveryPin(@Param('id') orderId: string) {
    return this.ordersService.getDeliveryPinForClient(orderId);
  }

  @Post(':id/delivery-overwrite-code')
  @ApiOperation({
    summary: 'Generate overwrite code (business only)',
    description: 'Generates a one-time overwrite code so the agent can complete the order without the client PIN. Order must be out_for_delivery.',
  })
  @ApiResponse({ status: 200, description: 'Overwrite code generated' })
  async generateDeliveryOverwriteCode(@Param('id') orderId: string) {
    return this.ordersService.generateDeliveryOverwriteCode(orderId);
  }

  @Post('cancel')
  @ApiOperation({
    summary: 'Cancel an order',
    description:
      'Cancel an order. Clients can cancel orders before pickup by delivery agent. Cancellation fees may apply for confirmed orders.',
  })
  @ApiBody({
    description: 'Order cancellation request',
    schema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'Order ID to cancel',
          example: 'order-123',
        },
        notes: {
          type: 'string',
          description: 'Optional cancellation notes',
          example: 'Customer requested cancellation',
        },
      },
      required: ['orderId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        order: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'order-123' },
            order_number: { type: 'string', example: 'ORD-20241201-000001' },
            current_status: { type: 'string', example: 'cancelled' },
          },
        },
        message: { type: 'string', example: 'Order cancelled successfully' },
        cancellationFee: { type: 'number', example: 500 },
        refundAmount: { type: 'number', example: 4500 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel order in current status',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: {
          type: 'string',
          example:
            'Cannot cancel order in picked_up status. Orders can only be cancelled before pickup by delivery agent.',
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Unauthorized to cancel this order',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Unauthorized to cancel this order' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Order not found' },
      },
    },
  })
  async cancelOrder(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.cancelOrder(request);
  }

  @Post('refund')
  async refundOrder(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.refundOrder(request);
  }

  @Get()
  async getOrders(@Query('filters') filters?: string) {
    try {
      let parsedFilters = undefined;
      if (filters) {
        try {
          parsedFilters = JSON.parse(filters);
        } catch {
          throw new HttpException(
            'Invalid filters JSON',
            HttpStatus.BAD_REQUEST
          );
        }
      }
      const orders = await this.ordersService.getOrders(parsedFilters);
      return { success: true, orders };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { success: false, error: error.message || 'Internal server error' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('open')
  async getOpenOrders() {
    return this.ordersService.getOpenOrders();
  }

  @Get('number/:orderNumber')
  @ApiOperation({ summary: 'Get order details by order number' })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        order: { type: 'object' },
        message: { type: 'string', example: 'Order retrieved successfully' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Order not found' },
      },
    },
  })
  async getOrderByNumber(@Param('orderNumber') orderNumber: string) {
    try {
      const order = await this.ordersService.getOrderByNumber(orderNumber);
      return {
        success: true,
        order,
        message: 'Order retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve order',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Public()
  @Get('fast-delivery-config')
  @ApiOperation({
    summary: 'Get fast delivery configuration for a country',
    description:
      'Retrieves fast delivery settings including fees, timing, and operating hours for a specific country',
  })
  @ApiQuery({
    name: 'countryCode',
    required: true,
    type: String,
    description:
      'Country code to get fast delivery configuration for (e.g., GA for Gabon)',
    example: 'GA',
  })
  @ApiQuery({
    name: 'stateCode',
    required: false,
    type: String,
    description:
      'State/province code to get fast delivery configuration for (e.g., Littoral)',
    example: 'Littoral',
  })
  @ApiResponse({
    status: 200,
    description: 'Fast delivery configuration retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        config: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', example: true },
            fee: { type: 'number', example: 2000 },
            minHours: { type: 'number', example: 2 },
            maxHours: { type: 'number', example: 4 },
            operatingHours: {
              type: 'object',
              properties: {
                monday: {
                  type: 'object',
                  properties: {
                    start: { type: 'string', example: '08:00' },
                    end: { type: 'string', example: '20:00' },
                    enabled: { type: 'boolean', example: true },
                  },
                },
                tuesday: {
                  type: 'object',
                  properties: {
                    start: { type: 'string', example: '08:00' },
                    end: { type: 'string', example: '20:00' },
                    enabled: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
        },
        message: {
          type: 'string',
          example: 'Fast delivery configuration retrieved successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid country code',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Country code is required' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No fast delivery configuration found for country',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: {
          type: 'string',
          example: 'No fast delivery configuration found for country GA',
        },
      },
    },
  })
  async getFastDeliveryConfig(
    @Query('countryCode') countryCode: string,
    @Query('stateCode') stateCode?: string
  ) {
    try {
      if (!countryCode) {
        throw new HttpException(
          'Country code is required',
          HttpStatus.BAD_REQUEST
        );
      }

      const fastDeliveryConfig =
        await this.deliveryConfigService.getFastDeliveryConfig(countryCode);

      if (!fastDeliveryConfig || !fastDeliveryConfig.enabled) {
        throw new HttpException(
          `Fast delivery is not available for country ${countryCode}`,
          HttpStatus.NOT_FOUND
        );
      }

      const config = {
        enabled: fastDeliveryConfig.enabled,
        fee: fastDeliveryConfig.baseFee,
        minHours: 12,
        maxHours: fastDeliveryConfig.sla,
        operatingHours: fastDeliveryConfig.serviceHours,
      };

      return {
        success: true,
        config,
        message: 'Fast delivery configuration retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error.message || 'Internal server error';
      let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

      if (errorMessage.includes('Country code is required')) {
        statusCode = HttpStatus.BAD_REQUEST;
      } else if (
        errorMessage.includes('No fast delivery configuration found')
      ) {
        statusCode = HttpStatus.NOT_FOUND;
      }

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        statusCode
      );
    }
  }

  @Get(':orderId/agent-earnings')
  @ApiOperation({ summary: 'Get agent earnings for an order' })
  @ApiResponse({
    status: 200,
    description: 'Agent earnings for the order',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        earnings: {
          type: 'object',
          properties: {
            totalEarnings: { type: 'number' },
            baseDeliveryCommission: { type: 'number' },
            perKmDeliveryCommission: { type: 'number' },
            currency: { type: 'string' },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - not the assigned agent' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderAgentEarnings(@Param('orderId') orderId: string) {
    try {
      return await this.ordersService.getOrderAgentEarnings(orderId);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      const errorMessage = error.message || 'Failed to get agent earnings';
      let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      if (errorMessage.includes('Order not found')) {
        statusCode = HttpStatus.NOT_FOUND;
      } else if (
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('Only agents')
      ) {
        statusCode = HttpStatus.FORBIDDEN;
      }
      throw new HttpException(
        { success: false, error: errorMessage },
        statusCode
      );
    }
  }

  @Get(':orderId/claim-availability')
  @ApiOperation({
    summary: 'Check if order is available to claim',
    description:
      'Returns pre-claim eligibility details for an agent including open status, hold amount, and top-up requirement.',
  })
  @ApiParam({
    name: 'orderId',
    required: true,
    type: String,
    description: 'Order ID to validate claim availability',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Claim availability computed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        orderOpenStatus: { type: 'boolean', example: true },
        hasEnoughFundsForHold: { type: 'boolean', example: true },
        needsTopUpToClaim: { type: 'boolean', example: false },
        holdAmount: { type: 'number', example: 1200 },
        message: {
          type: 'string',
          example: 'Order is open and available to claim',
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only agents can claim orders',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Only agent users can claim orders' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Order not found' },
      },
    },
  })
  async checkOrderClaimAvailability(@Param('orderId') orderId: string) {
    return this.ordersService.checkOrderClaimAvailability(orderId);
  }

  @Get(':id')
  async getOrderById(@Param('id') orderId: string) {
    try {
      const order = await this.ordersService.getOrderById(orderId);
      return {
        success: true,
        order,
        message: 'Order retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error.message || 'Internal server error';
      let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

      if (errorMessage.includes('Order not found')) {
        statusCode = HttpStatus.NOT_FOUND;
      } else if (
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('access')
      ) {
        statusCode = HttpStatus.FORBIDDEN;
      }

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        statusCode
      );
    }
  }

  @Post(':id/retry-payment')
  @ApiOperation({
    summary: 'Retry order payment (client only)',
    description:
      'Re-initiates a mobile money payment request for an existing order that is pending payment. This does not change the fulfillment status, but resets payment status to pending and creates a new mobile payment transaction.',
  })
  @ApiResponse({ status: 200, description: 'Payment retry initiated' })
  @ApiResponse({ status: 400, description: 'Invalid order state or missing data' })
  @ApiResponse({ status: 403, description: 'Not authorized for this order' })
  async retryOrderPayment(@Param('id') orderId: string) {
    return this.ordersService.retryOrderPayment(orderId);
  }

  @Post('drop_order')
  async dropOrder(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.dropOrder(request);
  }

  @Post('claim_order')
  async claimOrder(@Body() request: GetOrderRequest) {
    return this.ordersService.claimOrder(request);
  }

  @Post('claim_order_with_topup')
  @ApiOperation({
    summary: 'Claim order with topup payment',
    description:
      "Claims an order by initiating a mobile payment for the required hold amount. Optionally accepts a phone_number parameter to override the user's default phone number for payment.",
  })
  @ApiBody({
    description: 'Request body for claiming order with topup payment',
    schema: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: {
          type: 'string',
          description: 'The ID of the order to claim',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
        phone_number: {
          type: 'string',
          description:
            "Optional phone number to use for payment. If not provided, uses the user's default phone number.",
          example: '+241123456789',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Order claimed with topup payment initiated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        order: { type: 'object' },
        paymentTransaction: { type: 'object' },
        holdAmount: { type: 'number' },
        phoneNumber: {
          type: 'string',
          description: 'Phone number used for payment',
          example: '+241123456789',
        },
        message: {
          type: 'string',
          example: 'Order claimed with topup payment initiated successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data or payment initiation failed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Failed to initiate payment' },
        error: { type: 'string', example: 'PAYMENT_INITIATION_FAILED' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions or balance',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: {
          type: 'string',
          example: 'Only agent users can claim orders',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Order not found' },
      },
    },
  })
  async claimOrderWithTopup(@Body() request: GetOrderRequest) {
    return this.ordersService.claimOrderWithTopup(request);
  }

  @Post('cancel-claim-request')
  @ApiOperation({
    summary: 'Cancel pending claim request',
    description:
      'Cancels an in-flight claim_order top-up payment request for the authenticated agent and order.',
  })
  @ApiBody({
    description: 'Order claim cancellation request',
    schema: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: {
          type: 'string',
          description: 'The ID of the order whose pending claim should be cancelled',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      },
    },
  })
  async cancelClaimRequest(@Body() request: GetOrderRequest) {
    return this.ordersService.cancelClaimRequest(request);
  }

  @Get('item/:itemId/deliveryFee')
  @ApiOperation({ summary: 'Get estimated delivery fee for an item' })
  @ApiQuery({
    name: 'addressId',
    required: false,
    type: String,
    description:
      'Address ID to calculate delivery fee to (uses primary address if not provided)',
  })
  @ApiQuery({
    name: 'requiresFastDelivery',
    required: false,
    type: Boolean,
    description:
      'Whether fast delivery is required (affects delivery fee calculation)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Delivery fee calculated successfully. When isFirstOrderClient is true, deliveryFee is the payable total after halving the base component only; use baseDeliveryFeeBeforeDiscount + perKmDeliveryFee for the non-promo total (e.g. second business on checkout).',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        deliveryFee: { type: 'number', example: 1500 },
        isFirstOrderClient: {
          type: 'boolean',
          description: 'True when the client has no existing orders (any status)',
        },
        baseDeliveryFeeBeforeDiscount: {
          type: 'number',
          description: 'Base component before first-order promo',
        },
        firstOrderBaseDeliveryDiscountAmount: {
          type: 'number',
          description: 'Amount taken off the base when promo applies (half of base)',
        },
        baseDeliveryFee: {
          type: 'number',
          description: 'Base component charged after promo',
        },
        perKmDeliveryFee: { type: 'number', example: 400 },
        distance: { type: 'number', example: 5.2 },
        method: {
          type: 'string',
          enum: ['distance_based', 'flat_fee'],
          example: 'distance_based',
        },
        currency: { type: 'string', example: 'XAF' },
        message: {
          type: 'string',
          example: 'Delivery fee calculated successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Item not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Item not found' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Unauthorized access',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Unauthorized to access this item' },
      },
    },
  })
  async getItemDeliveryFee(
    @Param('itemId') itemId: string,
    @Query('addressId') addressId?: string,
    @Query('requiresFastDelivery') requiresFastDelivery?: boolean
  ) {
    try {
      const deliveryFeeInfo = await this.ordersService.calculateItemDeliveryFee(
        itemId,
        addressId,
        requiresFastDelivery || false
      );

      return {
        success: true,
        deliveryFee: deliveryFeeInfo.deliveryFee,
        isFirstOrderClient: deliveryFeeInfo.isFirstOrderClient,
        baseDeliveryFeeBeforeDiscount:
          deliveryFeeInfo.baseDeliveryFeeBeforeDiscount,
        firstOrderBaseDeliveryDiscountAmount:
          deliveryFeeInfo.firstOrderBaseDeliveryDiscountAmount,
        baseDeliveryFee: deliveryFeeInfo.baseDeliveryFee,
        perKmDeliveryFee: deliveryFeeInfo.perKmDeliveryFee,
        distance: deliveryFeeInfo.distance,
        method: deliveryFeeInfo.method,
        currency: deliveryFeeInfo.currency,
        message: 'Delivery fee calculated successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error.message || 'Internal server error';
      let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

      if (errorMessage.includes('Item not found')) {
        statusCode = HttpStatus.NOT_FOUND;
      } else if (
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('access')
      ) {
        statusCode = HttpStatus.FORBIDDEN;
      }

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        statusCode
      );
    }
  }

  @Get('cancellation-fee')
  @ApiOperation({
    summary: 'Get cancellation fee for a country',
    description:
      'Retrieves the cancellation fee configuration for a specific country',
  })
  @ApiQuery({
    name: 'country',
    required: true,
    type: String,
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'GA',
  })
  @ApiResponse({
    status: 200,
    description: 'Cancellation fee retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        cancellationFee: { type: 'number', example: 500 },
        currency: { type: 'string', example: 'XAF' },
        country: { type: 'string', example: 'GA' },
        message: {
          type: 'string',
          example: 'Cancellation fee retrieved successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'Cancellation fee configuration not found for the specified country',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: {
          type: 'string',
          example: 'Cancellation fee configuration not found for country GA',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid country code provided',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Country code is required' },
      },
    },
  })
  async getCancellationFee(@Query('country') country: string) {
    try {
      // Validate country parameter
      if (!country) {
        throw new HttpException(
          'Country code is required',
          HttpStatus.BAD_REQUEST
        );
      }

      // Get cancellation fee configuration
      const config = await this.configurationsService.getConfigurationByKey(
        'cancellation_fee',
        country
      );

      if (!config) {
        throw new HttpException(
          `Cancellation fee configuration not found for country ${country}`,
          HttpStatus.NOT_FOUND
        );
      }

      // Determine currency based on country
      const currencyMap: Record<string, string> = {
        GA: 'XAF', // Gabon - Central African CFA franc
        CM: 'XAF', // Cameroon - Central African CFA franc
        CA: 'CAD', // Canada - Canadian Dollar
        US: 'USD', // United States - US Dollar
      };

      const currency = currencyMap[country] || 'XAF';

      return {
        success: true,
        cancellationFee: config.number_value,
        currency,
        country,
        message: 'Cancellation fee retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error.message || 'Internal server error';
      let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

      if (errorMessage.includes('not found')) {
        statusCode = HttpStatus.NOT_FOUND;
      } else if (errorMessage.includes('required')) {
        statusCode = HttpStatus.BAD_REQUEST;
      }

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        statusCode
      );
    }
  }

  @Get(':orderId/messages')
  @ApiOperation({ summary: 'Get all messages for a specific order' })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string', format: 'uuid' },
              entity_type: { type: 'string' },
              entity_id: { type: 'string', format: 'uuid' },
              message: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  email: { type: 'string' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Unauthorized to access messages for this order',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  })
  async getOrderMessages(@Param('orderId') orderId: string) {
    try {
      const messages = await this.ordersService.getOrderMessages(orderId);
      return {
        success: true,
        messages,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error.message || 'Internal server error';
      let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

      if (errorMessage.includes('not found')) {
        statusCode = HttpStatus.NOT_FOUND;
      } else if (errorMessage.includes('Unauthorized')) {
        statusCode = HttpStatus.FORBIDDEN;
      }

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        statusCode
      );
    }
  }

  @Post(':orderId/messages')
  @ApiOperation({ summary: 'Create a new message for a specific order' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message content' },
      },
      required: ['message'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Message created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            entity_type: { type: 'string' },
            entity_id: { type: 'string', format: 'uuid' },
            message: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string' },
                first_name: { type: 'string' },
                last_name: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data or empty message',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Unauthorized to post messages for this order',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  })
  async createOrderMessage(
    @Param('orderId') orderId: string,
    @Body() body: { message: string }
  ) {
    try {
      const createdMessage = await this.ordersService.createOrderMessage(
        orderId,
        body.message
      );
      return {
        success: true,
        message: createdMessage,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error.message || 'Internal server error';
      let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

      if (errorMessage.includes('not found')) {
        statusCode = HttpStatus.NOT_FOUND;
      } else if (errorMessage.includes('Unauthorized')) {
        statusCode = HttpStatus.FORBIDDEN;
      } else if (
        errorMessage.includes('empty') ||
        errorMessage.includes('required')
      ) {
        statusCode = HttpStatus.BAD_REQUEST;
      }

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        statusCode
      );
    }
  }
}

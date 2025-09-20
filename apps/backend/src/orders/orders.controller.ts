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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { CreateOrderRequest } from '../hasura/hasura-user.service';
import { OrderStatusService } from './order-status.service';
import type {
  GetOrderRequest,
  OrderStatusChangeRequest,
} from './orders.service';
import { OrdersService } from './orders.service';

export interface UpdateOrderStatusRequest {
  status: string;
}

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderStatusService: OrderStatusService
  ) {}

  @Post()
  async createOrder(@Body() orderData: CreateOrderRequest) {
    try {
      // Validate required fields
      if (!orderData.delivery_address_id) {
        throw new HttpException(
          'Delivery address ID is required',
          HttpStatus.BAD_REQUEST
        );
      }

      const order = await this.ordersService.createOrder(
        orderData,
        orderData.delivery_address_id
      );

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
  async confirmOrder(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.confirmOrder(request);
  }

  @Post('start_preparing')
  async startPreparing(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.startPreparing(request);
  }

  @Post('complete_preparation')
  async completePreparation(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.completePreparation(request);
  }

  @Post('pick_up')
  async pickUpOrder(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.pickUpOrder(request);
  }

  @Post('start_transit')
  async startTransit(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.startTransit(request);
  }

  @Post('out_for_delivery')
  async outForDelivery(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.outForDelivery(request);
  }

  @Post('deliver')
  async deliverOrder(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.deliverOrder(request);
  }

  @Post('complete')
  async completeOrder(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.completeOrder(request);
  }

  @Post('fail_delivery')
  async failDelivery(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.failDelivery(request);
  }

  @Post('cancel')
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

  @Get('item/:itemId/deliveryFee')
  @ApiOperation({ summary: 'Get estimated delivery fee for an item' })
  @ApiQuery({
    name: 'addressId',
    required: false,
    type: String,
    description:
      'Address ID to calculate delivery fee to (uses primary address if not provided)',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery fee calculated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        deliveryFee: { type: 'number', example: 1500 },
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
    @Query('addressId') addressId?: string
  ) {
    try {
      const deliveryFeeInfo = await this.ordersService.calculateItemDeliveryFee(
        itemId,
        addressId
      );

      return {
        success: true,
        deliveryFee: deliveryFeeInfo.deliveryFee,
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
}

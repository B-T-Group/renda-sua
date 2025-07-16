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
import type { CreateOrderRequest } from '../hasura/hasura-user.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type {
  GetOrderRequest,
  OrderStatusChangeRequest,
} from './orders.service';
import { OrdersService } from './orders.service';

export interface UpdateOrderStatusRequest {
  status: string;
}

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly ordersService: OrdersService
  ) {}

  @Post()
  async createOrder(@Body() orderData: CreateOrderRequest) {
    try {
      const order = await this.hasuraUserService.createOrder(orderData);

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
      const order = await this.hasuraUserService.updateOrderStatus(
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

  @Post('get_order')
  async getOrder(@Body() request: GetOrderRequest) {
    return this.ordersService.getOrder(request);
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
        } catch (e) {
          throw new HttpException(
            'Invalid filters JSON',
            HttpStatus.BAD_REQUEST
          );
        }
      }
      const orders = await this.ordersService.getBusinessOrders(parsedFilters);
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
}

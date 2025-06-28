import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { CreateOrderRequest } from '../hasura/hasura-user.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly hasuraUserService: HasuraUserService
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
      } else if (errorMessage.includes('No valid items found') || 
                 errorMessage.includes('Item') ||
                 errorMessage.includes('No account found') ||
                 errorMessage.includes('Insufficient')) {
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
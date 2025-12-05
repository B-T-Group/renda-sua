import {
  Body,
  Controller,
  Delete,
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
import { Public } from '../auth/public.decorator';
import { DeliverySlotsService } from './delivery-slots.service';
import type {
  CreateDeliveryWindowDto,
  UpdateDeliveryWindowDto,
} from './delivery-windows.service';
import { DeliveryWindowsService } from './delivery-windows.service';

@ApiTags('Delivery Windows')
@Controller('delivery-windows')
export class DeliveryWindowsController {
  constructor(
    private readonly deliverySlotsService: DeliverySlotsService,
    private readonly deliveryWindowsService: DeliveryWindowsService
  ) {}

  @Public()
  @Get('slots')
  @ApiOperation({
    summary: 'Get available delivery time slots',
    description:
      'Retrieves available delivery time slots for a specific location and date',
  })
  @ApiQuery({
    name: 'countryCode',
    required: true,
    type: String,
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'GA',
  })
  @ApiQuery({
    name: 'stateCode',
    required: true,
    type: String,
    description: 'State/province code',
    example: 'Estuaire',
  })
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
    description: 'Delivery date in YYYY-MM-DD format',
    example: '2024-01-15',
  })
  @ApiQuery({
    name: 'isFastDelivery',
    required: false,
    type: Boolean,
    description:
      'Whether to get fast delivery slots (2-4h) or standard delivery slots (24-48h)',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Available delivery slots retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        slots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'uuid' },
              slot_name: { type: 'string', example: 'Morning' },
              slot_type: { type: 'string', example: 'standard' },
              start_time: { type: 'string', example: '08:00' },
              end_time: { type: 'string', example: '12:00' },
              available_capacity: { type: 'number', example: 5 },
              is_available: { type: 'boolean', example: true },
            },
          },
        },
      },
    },
  })
  async getAvailableSlots(
    @Query('countryCode') countryCode: string,
    @Query('stateCode') stateCode: string,
    @Query('date') date: string,
    @Query('isFastDelivery') isFastDelivery?: string
  ) {
    try {
      if (!countryCode || !stateCode || !date) {
        throw new HttpException(
          'Country code, state code, and date are required',
          HttpStatus.BAD_REQUEST
        );
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        throw new HttpException(
          'Date must be in YYYY-MM-DD format',
          HttpStatus.BAD_REQUEST
        );
      }

      // Parse isFastDelivery from query string (query params come as strings)
      // "true" -> true, "false" -> false, undefined -> false
      const isFastDeliveryBool =
        isFastDelivery === undefined
          ? false
          : isFastDelivery.toLowerCase() === 'true';

      const slots = await this.deliverySlotsService.getAvailableSlots(
        countryCode,
        stateCode,
        date,
        isFastDeliveryBool
      );

      return {
        success: true,
        slots,
        message: 'Available delivery slots retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error.message || 'Failed to get available slots';
      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Create delivery time window',
    description: 'Creates a delivery time window for an order',
  })
  @ApiBody({
    description: 'Delivery window creation data',
    schema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', example: 'uuid' },
        slot_id: { type: 'string', example: 'uuid' },
        preferred_date: { type: 'string', example: '2024-01-15' },
        special_instructions: {
          type: 'string',
          example: 'Leave at front door',
        },
      },
      required: ['order_id', 'slot_id', 'preferred_date'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Delivery window created successfully',
  })
  async createDeliveryWindow(@Body() data: CreateDeliveryWindowDto) {
    try {
      const deliveryWindow =
        await this.deliveryWindowsService.createDeliveryWindow(data);

      return {
        success: true,
        deliveryWindow,
        message: 'Delivery window created successfully',
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to create delivery window';
      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('order/:orderId')
  @ApiOperation({
    summary: 'Get delivery window by order ID',
    description: 'Retrieves delivery time window details for a specific order',
  })
  @ApiParam({
    name: 'orderId',
    required: true,
    type: String,
    description: 'Order ID',
    example: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery window retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Delivery window not found',
  })
  async getDeliveryWindowByOrder(@Param('orderId') orderId: string) {
    try {
      const deliveryWindow =
        await this.deliveryWindowsService.getDeliveryWindow(orderId);

      if (!deliveryWindow) {
        throw new HttpException(
          'Delivery window not found',
          HttpStatus.NOT_FOUND
        );
      }

      return {
        success: true,
        deliveryWindow,
        message: 'Delivery window retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage = error.message || 'Failed to get delivery window';
      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch(':orderId')
  @ApiOperation({
    summary: 'Update delivery window',
    description: 'Updates an existing delivery time window',
  })
  @ApiParam({
    name: 'orderId',
    required: true,
    type: String,
    description: 'Order ID',
    example: 'uuid',
  })
  @ApiBody({
    description: 'Delivery window update data',
    schema: {
      type: 'object',
      properties: {
        slot_id: { type: 'string', example: 'uuid' },
        preferred_date: { type: 'string', example: '2024-01-15' },
        special_instructions: {
          type: 'string',
          example: 'Leave at front door',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery window updated successfully',
  })
  async updateDeliveryWindow(
    @Param('orderId') orderId: string,
    @Body() data: UpdateDeliveryWindowDto
  ) {
    try {
      const deliveryWindow =
        await this.deliveryWindowsService.updateDeliveryWindow(orderId, data);

      return {
        success: true,
        deliveryWindow,
        message: 'Delivery window updated successfully',
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to update delivery window';
      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':orderId/confirm')
  @ApiOperation({
    summary: 'Confirm delivery window',
    description: 'Confirms a delivery time window (business only)',
  })
  @ApiParam({
    name: 'orderId',
    required: true,
    type: String,
    description: 'Order ID',
    example: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery window confirmed successfully',
  })
  async confirmDeliveryWindow(@Param('orderId') orderId: string) {
    try {
      // TODO: Get confirmed_by from authenticated user
      const confirmedBy = 'system'; // Placeholder - should come from auth context

      const deliveryWindow =
        await this.deliveryWindowsService.confirmDeliveryWindow(
          orderId,
          confirmedBy
        );

      return {
        success: true,
        deliveryWindow,
        message: 'Delivery window confirmed successfully',
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to confirm delivery window';
      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':orderId')
  @ApiOperation({
    summary: 'Delete delivery window',
    description: 'Deletes a delivery time window',
  })
  @ApiParam({
    name: 'orderId',
    required: true,
    type: String,
    description: 'Order ID',
    example: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery window deleted successfully',
  })
  async deleteDeliveryWindow(@Param('orderId') orderId: string) {
    try {
      await this.deliveryWindowsService.deleteDeliveryWindow(orderId);

      return {
        success: true,
        message: 'Delivery window deleted successfully',
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to delete delivery window';
      throw new HttpException(
        {
          success: false,
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

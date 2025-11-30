import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { ResolutionRequest } from './failed-deliveries.service';
import { FailedDeliveriesService } from './failed-deliveries.service';
import type { OrderStatusChangeRequest } from './orders.service';
import { OrdersService } from './orders.service';

@ApiTags('Failed Deliveries')
@Controller('failed-deliveries')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class FailedDeliveriesController {
  constructor(
    private readonly failedDeliveriesService: FailedDeliveriesService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly ordersService: OrdersService
  ) {}

  @Post('fail')
  @ApiOperation({
    summary: 'Mark delivery as failed',
    description:
      'Marks an order delivery as failed. Only the assigned agent can mark their own delivery as failed. Requires a failure reason ID.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId', 'failure_reason_id'],
      properties: {
        orderId: { type: 'string', format: 'uuid', description: 'Order ID' },
        failure_reason_id: {
          type: 'string',
          format: 'uuid',
          description: 'ID of the delivery failure reason',
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the failure',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery marked as failed successfully',
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
    description: 'Bad request - Invalid data or missing failure_reason_id',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only assigned agent can mark delivery as failed',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found or invalid failure reason',
  })
  async failDelivery(@Body() request: OrderStatusChangeRequest) {
    return this.ordersService.failDelivery(request);
  }

  @Get('reasons')
  @ApiOperation({
    summary: 'Get delivery failure reasons',
    description:
      'Returns all active delivery failure reasons. Defaults to French language.',
  })
  @ApiQuery({
    name: 'language',
    required: false,
    enum: ['en', 'fr'],
    description: 'Language for failure reason text (default: fr)',
  })
  @ApiResponse({
    status: 200,
    description: 'Failure reasons retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        reasons: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              reason_key: { type: 'string' },
              reason: { type: 'string' },
              reason_en: { type: 'string' },
              reason_fr: { type: 'string' },
              is_active: { type: 'boolean' },
              sort_order: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getFailureReasons(@Query('language') language?: 'en' | 'fr') {
    try {
      const reasons = await this.failedDeliveriesService.getFailureReasons(
        language || 'fr'
      );
      return {
        success: true,
        reasons,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to retrieve failure reasons',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get failed deliveries for business',
    description:
      'Returns all failed deliveries for the authenticated business user. Can be filtered by status and resolution type.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'completed'],
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'resolution_type',
    required: false,
    enum: ['agent_fault', 'client_fault', 'item_fault'],
    description: 'Filter by resolution type',
  })
  @ApiResponse({
    status: 200,
    description: 'Failed deliveries retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only business users can access this endpoint',
  })
  async getFailedDeliveries(
    @Query('status') status?: 'pending' | 'completed',
    @Query('resolution_type')
    resolution_type?: 'agent_fault' | 'client_fault' | 'item_fault'
  ) {
    try {
      // Get business ID from authenticated user
      const user = await this.hasuraUserService.getUser();

      if (!user.business) {
        throw new HttpException(
          'Only business users can access failed deliveries',
          HttpStatus.FORBIDDEN
        );
      }

      const filters: any = {};
      if (status) filters.status = status;
      if (resolution_type) filters.resolution_type = resolution_type;

      const failedDeliveries =
        await this.failedDeliveriesService.getFailedDeliveries(
          user.business.id,
          filters
        );

      return {
        success: true,
        failed_deliveries: failedDeliveries,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to retrieve failed deliveries',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':orderId')
  @ApiOperation({
    summary: 'Get specific failed delivery',
    description: 'Returns details for a specific failed delivery by order ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'Failed delivery retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Failed delivery not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Access denied',
  })
  async getFailedDelivery(@Param('orderId') orderId: string) {
    try {
      const failedDelivery =
        await this.failedDeliveriesService.getFailedDelivery(orderId);
      return {
        success: true,
        failed_delivery: failedDelivery,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to retrieve failed delivery',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':orderId/resolve')
  @ApiOperation({
    summary: 'Resolve a failed delivery',
    description:
      'Resolves a failed delivery with one of three resolution types: agent_fault, client_fault, or item_fault. Business users only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Failed delivery resolved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid resolution data or already resolved',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Only business users can resolve failed deliveries',
  })
  @ApiResponse({
    status: 404,
    description: 'Failed delivery not found',
  })
  async resolveFailedDelivery(
    @Param('orderId') orderId: string,
    @Body() resolution: ResolutionRequest
  ) {
    try {
      if (!resolution.resolution_type) {
        throw new HttpException(
          'resolution_type is required',
          HttpStatus.BAD_REQUEST
        );
      }

      if (!resolution.outcome || resolution.outcome.trim().length === 0) {
        throw new HttpException(
          'outcome is required and cannot be empty',
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.failedDeliveriesService.resolveFailedDelivery(
        orderId,
        resolution
      );

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to resolve failed delivery',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

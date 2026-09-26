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
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { isActivePersona } from '../users/persona.util';
import { FailedPickupsService } from './failed-pickups.service';

@ApiTags('Failed Pickups')
@Controller('failed-pickups')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class FailedPickupsController {
  constructor(
    private readonly failedPickupsService: FailedPickupsService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Post('fail')
  @ApiOperation({
    summary: 'Mark cooked-food pickup as failed',
    description:
      'Business marks a ready cooked-food order as failed pickup. Applies country cancellation fee and enqueues partial refund.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId', 'failure_reason_id'],
      properties: {
        orderId: { type: 'string', format: 'uuid' },
        failure_reason_id: { type: 'string', format: 'uuid' },
        notes: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Pickup marked as failed' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async failPickup(
    @Body()
    body: {
      orderId: string;
      failure_reason_id: string;
      notes?: string;
    }
  ) {
    return this.failedPickupsService.failPickup(body);
  }

  @Get('reasons')
  @ApiOperation({ summary: 'Get pickup failure reasons' })
  @ApiQuery({ name: 'language', required: false, enum: ['en', 'fr'] })
  @ApiResponse({ status: 200, description: 'Reasons retrieved' })
  async getFailureReasons(@Query('language') language?: 'en' | 'fr') {
    try {
      const reasons = await this.failedPickupsService.getFailureReasons(
        language || 'fr'
      );
      return { success: true, reasons };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to retrieve pickup failure reasons',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'List failed pickups for business' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'completed'],
  })
  @ApiResponse({ status: 200, description: 'Failed pickups retrieved' })
  async getFailedPickups(
    @ReqContext() ctx: RequestContext,
    @Query('status') status?: 'pending' | 'completed'
  ) {
    const user = await this.hasuraUserService.getUser(ctx);
    if (!isActivePersona(user, 'business') || !user.business) {
      throw new HttpException(
        'Only business users can access failed pickups',
        HttpStatus.FORBIDDEN
      );
    }
    const filters: { status?: 'pending' | 'completed' } = {};
    if (status) filters.status = status;
    const failed_pickups = await this.failedPickupsService.getFailedPickups(
      user.business.id,
      filters
    );
    return { success: true, failed_pickups };
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get failed pickup by order ID' })
  @ApiResponse({ status: 200, description: 'Failed pickup retrieved' })
  async getFailedPickup(@Param('orderId') orderId: string) {
    const failed_pickup =
      await this.failedPickupsService.getFailedPickup(orderId);
    return { success: true, failed_pickup };
  }
}

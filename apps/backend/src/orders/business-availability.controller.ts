import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { RbacService } from '../rbac/rbac.service';
import { isActivePersona } from '../users/persona.util';
import { OrderAcceptanceService } from './order-acceptance.service';

@ApiTags('Business')
@Controller()
@Throttle({ short: { limit: 30, ttl: 60000 } })
export class BusinessAvailabilityController {
  constructor(
    private readonly orderAcceptanceService: OrderAcceptanceService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly rbacService: RbacService
  ) {}

  private async requireBusinessId(): Promise<string> {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException(
        'Only business users can manage availability',
        HttpStatus.FORBIDDEN
      );
    }
    return user.business.id;
  }

  private async requireCrossBusinessAdmin(): Promise<void> {
    const user = await this.hasuraUserService.getUser();
    const allowed = await this.rbacService.hasPermission(
      user.id,
      PlatformPermissions.ORDERS_CROSS_BUSINESS
    );
    if (!allowed) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  @Get('business/reliability')
  @ApiOperation({ summary: 'Get reliability KPIs for the current business' })
  async getMyReliability() {
    const businessId = await this.requireBusinessId();
    return this.orderAcceptanceService.getReliability(businessId);
  }

  @Get('admin/businesses/reliability')
  @ApiOperation({
    summary: 'List least reliable businesses for superuser follow-up',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'tier',
    required: false,
    enum: ['ok', 'warn', 'demote', 'restrict', 'suspend'],
  })
  @ApiQuery({ name: 'minAutoDeclines30d', required: false, type: Number })
  async listAdminReliability(
    @Query('limit') limit?: string,
    @Query('tier') tier?: string,
    @Query('minAutoDeclines30d') minAutoDeclines30d?: string
  ) {
    await this.requireCrossBusinessAdmin();
    const parsedLimit = limit != null ? Number(limit) : undefined;
    const parsedMin =
      minAutoDeclines30d != null ? Number(minAutoDeclines30d) : undefined;
    return this.orderAcceptanceService.listLeastReliableBusinesses({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      tier,
      minAutoDeclines30d: Number.isFinite(parsedMin) ? parsedMin : undefined,
    });
  }

  @Get('admin/businesses/:id/reliability')
  @ApiOperation({ summary: 'Get reliability KPIs for a business (admin)' })
  async getAdminReliability(@Param('id') id: string) {
    await this.requireCrossBusinessAdmin();
    return this.orderAcceptanceService.getReliability(id);
  }

  @Post('business/availability/pause')
  @ApiOperation({ summary: 'Pause accepting new orders' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['duration'],
      properties: {
        duration: {
          type: 'string',
          enum: ['15m', '1h', 'until_tomorrow', 'indefinite'],
        },
      },
    },
  })
  async pause(
    @Body() body: { duration?: '15m' | '1h' | 'until_tomorrow' | 'indefinite' }
  ) {
    const businessId = await this.requireBusinessId();
    const duration = body?.duration;
    if (
      !duration ||
      !['15m', '1h', 'until_tomorrow', 'indefinite'].includes(duration)
    ) {
      throw new HttpException('Invalid duration', HttpStatus.BAD_REQUEST);
    }
    await this.orderAcceptanceService.pauseBusiness(businessId, duration);
    return { success: true };
  }

  @Post('business/availability/resume')
  @ApiOperation({ summary: 'Resume accepting new orders' })
  async resume() {
    const businessId = await this.requireBusinessId();
    await this.orderAcceptanceService.resumeBusiness(businessId);
    return { success: true };
  }

  @Put('business/locations/:id/hours')
  @ApiOperation({ summary: 'Update location operating hours' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['operatingHours'],
      properties: { operatingHours: { type: 'object' } },
    },
  })
  async updateHours(
    @Param('id') locationId: string,
    @Body() body: { operatingHours?: Record<string, unknown> }
  ) {
    const businessId = await this.requireBusinessId();
    if (!body?.operatingHours || typeof body.operatingHours !== 'object') {
      throw new HttpException(
        'operatingHours is required',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.orderAcceptanceService.updateLocationHours(
      locationId,
      businessId,
      body.operatingHours
    );
    return { success: true };
  }

  @Get('business/order-timing')
  @ApiOperation({
    summary:
      'Get per-business order acceptance timing (ASAP SLA, future SLA, activation lead, prep)',
  })
  async getOrderTiming() {
    const businessId = await this.requireBusinessId();
    return this.orderAcceptanceService.getOrderTiming(businessId);
  }

  @Put('business/order-timing')
  @ApiOperation({ summary: 'Update per-business order acceptance timing' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        acceptance_timeout_seconds: {
          type: 'integer',
          nullable: true,
          description: 'ASAP confirm window in seconds (60–3600); null = platform default',
        },
        future_acceptance_timeout_seconds: {
          type: 'integer',
          nullable: true,
          description:
            'Confirm window after future-order activation (60–3600); null = default',
        },
        order_activation_lead_minutes: {
          type: 'integer',
          nullable: true,
          enum: [30, 60, 120],
          description: 'Minutes before prep start to activate SLA',
        },
        default_estimated_prep_minutes: {
          type: 'integer',
          nullable: true,
          description: 'Default prep minutes (5–240); null = platform default',
        },
      },
    },
  })
  async updateOrderTiming(
    @Body()
    body: {
      acceptance_timeout_seconds?: number | null;
      future_acceptance_timeout_seconds?: number | null;
      order_activation_lead_minutes?: number | null;
      default_estimated_prep_minutes?: number | null;
    }
  ) {
    const businessId = await this.requireBusinessId();
    await this.orderAcceptanceService.updateOrderTiming(businessId, body || {});
    return {
      success: true,
      ...(await this.orderAcceptanceService.getOrderTiming(businessId)),
    };
  }
}

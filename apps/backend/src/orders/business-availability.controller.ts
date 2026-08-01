import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @Get('business/reliability')
  @ApiOperation({ summary: 'Get reliability KPIs for the current business' })
  async getMyReliability() {
    const businessId = await this.requireBusinessId();
    return this.orderAcceptanceService.getReliability(businessId);
  }

  @Get('admin/businesses/:id/reliability')
  @ApiOperation({ summary: 'Get reliability KPIs for a business (admin)' })
  async getAdminReliability(@Param('id') id: string) {
    const user = await this.hasuraUserService.getUser();
    const allowed = await this.rbacService.hasPermission(
      user.id,
      PlatformPermissions.ORDERS_CROSS_BUSINESS
    );
    if (!allowed) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
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
}

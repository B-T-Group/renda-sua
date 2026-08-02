import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import type { Configuration } from '../config/configuration';
import { OrderAcceptanceService } from './order-acceptance.service';

@ApiTags('Orders')
@Controller('orders')
export class OrderAcceptanceInternalController {
  constructor(
    private readonly orderAcceptanceService: OrderAcceptanceService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  private assertInternalKey(internalKey?: string): void {
    const expected =
      this.configService.get<Configuration['notificationsInternal']>(
        'notificationsInternal'
      )?.apiKey ?? '';
    if (!expected || internalKey !== expected) {
      throw new UnauthorizedException();
    }
  }

  @Public()
  @Post('internal/acceptance-activate')
  @ApiOperation({
    summary: 'Internal: activate scheduled acceptance SLA (wait-handler Lambda)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId'],
      properties: { orderId: { type: 'string', format: 'uuid' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Processed' })
  async acceptanceActivate(
    @Body() body: { orderId?: string },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ) {
    this.assertInternalKey(internalKey);
    const orderId = body?.orderId?.trim();
    if (!orderId) return { success: false, error: 'orderId is required' };
    return this.orderAcceptanceService.activateAcceptanceSla(orderId);
  }

  @Public()
  @Post('internal/acceptance-deadline')
  @ApiOperation({
    summary: 'Internal: merchant acceptance deadline (wait-handler Lambda)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId'],
      properties: { orderId: { type: 'string', format: 'uuid' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Processed' })
  async acceptanceDeadline(
    @Body() body: { orderId?: string },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ) {
    this.assertInternalKey(internalKey);
    const orderId = body?.orderId?.trim();
    if (!orderId) return { success: false, error: 'orderId is required' };
    return this.orderAcceptanceService.onAcceptanceDeadline(orderId);
  }

  @Public()
  @Post('internal/acceptance-grace-deadline')
  @ApiOperation({
    summary: 'Internal: merchant acceptance grace deadline (wait-handler Lambda)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId'],
      properties: { orderId: { type: 'string', format: 'uuid' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Processed' })
  async acceptanceGraceDeadline(
    @Body() body: { orderId?: string },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ) {
    this.assertInternalKey(internalKey);
    const orderId = body?.orderId?.trim();
    if (!orderId) return { success: false, error: 'orderId is required' };
    return this.orderAcceptanceService.onGraceDeadline(orderId);
  }
}

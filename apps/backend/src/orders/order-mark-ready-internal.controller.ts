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
import { CookedFoodPickupFlowService } from './cooked-food-pickup-flow.service';
import { OrderMarkReadyService } from './order-mark-ready.service';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller('orders')
export class OrderMarkReadyInternalController {
  constructor(
    private readonly markReadyService: OrderMarkReadyService,
    private readonly cookedFoodFlow: CookedFoodPickupFlowService,
    private readonly ordersService: OrdersService,
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
  @Post('internal/mark-ready-prompt')
  @ApiOperation({
    summary:
      'Internal: delayed merchant mark-as-ready WhatsApp prompt (wait-handler)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId'],
      properties: { orderId: { type: 'string', format: 'uuid' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Processed' })
  async markReadyPrompt(
    @Body() body: { orderId?: string },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ) {
    this.assertInternalKey(internalKey);
    const orderId = body?.orderId?.trim();
    if (!orderId) return { success: false, error: 'orderId is required' };
    return this.markReadyService.onMarkReadyPrompt(orderId);
  }

  @Public()
  @Post('internal/auto-mark-ready')
  @ApiOperation({
    summary: 'Internal: auto-mark cooked-food pickup ready (wait-handler)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId'],
      properties: { orderId: { type: 'string', format: 'uuid' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Processed' })
  async autoMarkReady(
    @Body() body: { orderId?: string },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ) {
    this.assertInternalKey(internalKey);
    const orderId = body?.orderId?.trim();
    if (!orderId) return { success: false, error: 'orderId is required' };
    const check = await this.cookedFoodFlow.shouldAutoMarkReady(orderId);
    if (!check.success) return check;
    if (!check.shouldMarkReady) {
      return { success: true, skipped: true, reason: check.reason };
    }
    await this.ordersService.completePreparation({
      orderId,
      notes: 'Auto-marked ready after prep timer',
      viaSystem: true,
    } as any);
    return { success: true };
  }

  @Public()
  @Post('internal/cooked-food-unpaid-cancel')
  @ApiOperation({
    summary:
      'Internal: cancel unpaid cooked-food MoMo order after confirm timeout',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId'],
      properties: { orderId: { type: 'string', format: 'uuid' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Processed' })
  async cookedFoodUnpaidCancel(
    @Body() body: { orderId?: string },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ) {
    this.assertInternalKey(internalKey);
    const orderId = body?.orderId?.trim();
    if (!orderId) return { success: false, error: 'orderId is required' };
    const check = await this.cookedFoodFlow.shouldCancelUnpaid(orderId);
    if (!check.success) return check;
    if (!check.shouldCancel) {
      return { success: true, skipped: true, reason: check.reason };
    }
    await this.ordersService.cancelUnpaidCookedFoodAfterConfirm(orderId);
    return { success: true };
  }
}

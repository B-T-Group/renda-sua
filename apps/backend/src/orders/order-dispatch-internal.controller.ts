import {
  Body,
  Controller,
  Headers,
  Optional,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import type { Configuration } from '../config/configuration';
import {
  DedicatedSlotReminderService,
  type SlotReminderOutcome,
} from './dedicated-slot-reminder.service';
import { OrderOffersService } from './order-offers.service';

@ApiTags('Orders')
@Controller('orders')
export class OrderDispatchInternalController {
  constructor(
    private readonly orderOffersService: OrderOffersService,
    private readonly configService: ConfigService<Configuration>,
    @Optional()
    private readonly slotReminderService?: DedicatedSlotReminderService
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
  @Post('internal/dispatch-round')
  @ApiOperation({
    summary:
      'Internal: run an agent-dispatch round or exhaustion check (wait-handler Lambda)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId', 'round'],
      properties: {
        orderId: { type: 'string', format: 'uuid' },
        round: {
          type: 'number',
          description: '1 = close radius, 2 = wide radius, 3 = exhaustion check',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Processed' })
  @ApiResponse({ status: 401, description: 'Invalid or missing internal key' })
  async dispatchRound(
    @Body() body: { orderId?: string; round?: number },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ): Promise<{ success: boolean; error?: string }> {
    this.assertInternalKey(internalKey);
    const orderId = body?.orderId?.trim();
    const round = Number(body?.round);
    if (!orderId || !Number.isFinite(round)) {
      return { success: false, error: 'orderId and round are required' };
    }
    await this.orderOffersService.runDispatchRound(orderId, round);
    return { success: true };
  }

  @Public()
  @Post('internal/dedicated-slot-reminder')
  @ApiOperation({
    summary:
      '#594 AC-A8 internal: day-of dedicated slot reminder for an order placed on dedicated coverage (wait-handler Lambda)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId'],
      properties: { orderId: { type: 'string', format: 'uuid' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Processed (sent or skipped, with the reason)' })
  @ApiResponse({ status: 401, description: 'Invalid or missing internal key' })
  async dedicatedSlotReminder(
    @Body() body: { orderId?: string },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ): Promise<{ success: boolean; error?: string; outcome?: SlotReminderOutcome }> {
    this.assertInternalKey(internalKey);
    const orderId = body?.orderId?.trim();
    if (!orderId) return { success: false, error: 'orderId is required' };
    if (!this.slotReminderService) return { success: false, error: 'unavailable' };
    const outcome = await this.slotReminderService.sendForOrder(orderId);
    return { success: true, outcome };
  }
}

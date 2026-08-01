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
import { OrderOffersService } from './order-offers.service';

@ApiTags('Orders')
@Controller('orders')
export class OrderDispatchInternalController {
  constructor(
    private readonly orderOffersService: OrderOffersService,
    private readonly configService: ConfigService<Configuration>
  ) {}

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
    const expected =
      this.configService.get<Configuration['notificationsInternal']>(
        'notificationsInternal'
      )?.apiKey ?? '';
    if (!expected || internalKey !== expected) {
      throw new UnauthorizedException();
    }
    const orderId = body?.orderId?.trim();
    const round = Number(body?.round);
    if (!orderId || !Number.isFinite(round)) {
      return { success: false, error: 'orderId and round are required' };
    }
    await this.orderOffersService.runDispatchRound(orderId, round);
    return { success: true };
  }
}

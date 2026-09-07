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
import { OrderMarkReadyService } from './order-mark-ready.service';

@ApiTags('Orders')
@Controller('orders')
export class OrderMarkReadyInternalController {
  constructor(
    private readonly markReadyService: OrderMarkReadyService,
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
}

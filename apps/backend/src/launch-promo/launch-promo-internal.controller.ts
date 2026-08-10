import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import type { Configuration } from '../config/configuration';
import { LaunchPromoService } from './launch-promo.service';

@ApiTags('Launch Promo (internal)')
@Controller('internal/launch-promo')
export class LaunchPromoInternalController {
  constructor(
    private readonly launchPromoService: LaunchPromoService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  @Public()
  @Post('release-expired')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Internal: release expired claimed launch promo slots',
    description:
      'Releases slots still in claimed status after the configured identification window (default 30 days).',
  })
  @ApiHeader({
    name: 'x-rendasua-internal-key',
    description: 'Shared internal API key (must match NOTIFICATIONS_INTERNAL_API_KEY)',
    required: true,
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Expired slots released',
    schema: {
      type: 'object',
      properties: { released: { type: 'number' } },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing internal key' })
  async releaseExpired(
    @Headers('x-rendasua-internal-key') internalKey?: string
  ): Promise<{ released: number }> {
    this.assertInternalKey(internalKey);
    return this.launchPromoService.releaseExpiredSlots();
  }

  private assertInternalKey(internalKey?: string): void {
    const expected =
      this.configService.get<Configuration['notificationsInternal']>(
        'notificationsInternal'
      )?.apiKey ?? '';
    if (!expected || internalKey !== expected) {
      throw new UnauthorizedException();
    }
  }
}

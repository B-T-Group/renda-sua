import { Controller, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
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
import { BusinessReferralPayoutsService } from './business-referral-payouts.service';

@ApiTags('Business Referral Payouts (internal)')
@Controller('internal/business-referral-payouts')
export class BusinessReferralPayoutsInternalController {
  constructor(
    private readonly payoutsService: BusinessReferralPayoutsService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  @Public()
  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Internal: run weekly business-referral commission payouts (Lambda/cron)',
    description:
      'Called by the Saturday EventBridge cron Lambda. Credits agents who referred businesses ' +
      'created after April 2026 that have at least 10 items, if the ' +
      'business_referral_payout_enabled config flag is active.',
  })
  @ApiHeader({
    name: 'x-rendasua-internal-key',
    description: 'Shared internal API key (must match NOTIFICATIONS_INTERNAL_API_KEY)',
    required: true,
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Payout run completed (or skipped when disabled)',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number' },
        credited: { type: 'number' },
        skipped: { type: 'number' },
        failures: { type: 'number' },
        skippedReason: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing internal key' })
  async runPayouts(
    @Headers('x-rendasua-internal-key') internalKey?: string
  ): Promise<{
    processed: number;
    credited: number;
    skipped: number;
    failures: number;
    skippedReason?: string;
  }> {
    this.assertInternalKey(internalKey);
    return this.payoutsService.runWeeklyPayouts();
  }

  private assertInternalKey(internalKey?: string): void {
    const expected =
      this.configService.get<Configuration['notificationsInternal']>('notificationsInternal')
        ?.apiKey ?? '';
    if (!expected || internalKey !== expected) {
      throw new UnauthorizedException();
    }
  }
}

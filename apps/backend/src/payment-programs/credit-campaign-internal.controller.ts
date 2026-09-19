import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import type { Configuration } from '../config/configuration';
import { CreditCampaignRunnerService } from './credit-campaign-runner.service';
import type { SignupCampaignEvent } from './credit-campaign.policy';

@ApiTags('credit-campaigns-internal')
@Controller('internal/credit-campaigns')
export class CreditCampaignInternalController {
  constructor(
    private readonly runner: CreditCampaignRunnerService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Internal: apply signup credit campaigns' })
  @ApiHeader({ name: 'x-rendasua-internal-key', required: true })
  async signup(
    @Headers('x-rendasua-internal-key') internalKey: string | undefined,
    @Body() body: SignupCampaignEvent
  ) {
    this.assertKey(internalKey);
    return this.runner.applySignup(body);
  }

  private assertKey(internalKey?: string): void {
    const expected =
      this.configService.get<Configuration['notificationsInternal']>('notificationsInternal')
        ?.apiKey ?? '';
    if (!expected || internalKey !== expected) throw new UnauthorizedException();
  }
}

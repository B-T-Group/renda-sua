import { Controller, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import type { Configuration } from '../config/configuration';
import { PaymentScheduleRunnerService } from './payment-schedule-runner.service';

@ApiTags('payment-schedules-internal')
@Controller('internal/payment-schedule-runs')
export class PaymentScheduleInternalController {
  constructor(
    private readonly runner: PaymentScheduleRunnerService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  @Public()
  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Internal: post due scheduled agent payments' })
  @ApiHeader({ name: 'x-rendasua-internal-key', required: true })
  async run(@Headers('x-rendasua-internal-key') internalKey?: string) {
    this.assertKey(internalKey);
    return this.runner.runDue();
  }

  private assertKey(internalKey?: string): void {
    const expected =
      this.configService.get<Configuration['notificationsInternal']>('notificationsInternal')
        ?.apiKey ?? '';
    if (!expected || internalKey !== expected) throw new UnauthorizedException();
  }
}

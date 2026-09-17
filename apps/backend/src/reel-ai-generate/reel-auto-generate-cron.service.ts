import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReelAutoGenerateService } from './reel-auto-generate.service';

/**
 * Singleton cron host — must not inject request-scoped providers.
 */
@Injectable()
export class ReelAutoGenerateCronService {
  private readonly logger = new Logger(ReelAutoGenerateCronService.name);

  constructor(private readonly autoGenerate: ReelAutoGenerateService) {}

  @Cron(process.env.REEL_AUTO_GENERATE_CRON || '0 8 * * *')
  async run(): Promise<void> {
    try {
      await this.autoGenerate.tryCreateDailySponsoredReel();
    } catch (error: any) {
      this.logger.error(
        `Auto AI reel cron failed: ${error?.message ?? String(error)}`
      );
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReelAiGenerateService } from './reel-ai-generate.service';

@Injectable()
export class ReelAiGenerateSweeperService {
  private readonly logger = new Logger(ReelAiGenerateSweeperService.name);

  constructor(private readonly generate: ReelAiGenerateService) {}

  @Cron('*/20 * * * * *')
  async sweep(): Promise<void> {
    try {
      await this.generate.pollPendingGenerations();
    } catch (error: any) {
      this.logger.error(
        `AI reel generation sweeper failed: ${error?.message || error}`
      );
    }
  }
}

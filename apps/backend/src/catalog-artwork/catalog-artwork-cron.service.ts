import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CatalogArtworkService } from './catalog-artwork.service';

@Injectable()
export class CatalogArtworkCronService {
  private readonly logger = new Logger(CatalogArtworkCronService.name);

  constructor(private readonly artwork: CatalogArtworkService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyBackfill(): Promise<void> {
    try {
      const result = await this.artwork.runHourlyBackfill();
      if (result.queued > 0) {
        this.logger.log(`Catalog artwork backfill queued=${result.queued}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Catalog artwork backfill failed: ${error?.message ?? error}`
      );
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImageThumbnailsService } from './image-thumbnails.service';

@Injectable()
export class ImageThumbnailsCronService {
  private readonly logger = new Logger(ImageThumbnailsCronService.name);

  constructor(
    private readonly imageThumbnailsService: ImageThumbnailsService
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyBackfill(): Promise<void> {
    try {
      const result = await this.imageThumbnailsService.runHourlyBackfill();
      if (result.queued > 0) {
        this.logger.log(`Hourly thumbnail backfill queued=${result.queued}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Hourly thumbnail backfill failed: ${error?.message ?? String(error)}`
      );
    }
  }
}

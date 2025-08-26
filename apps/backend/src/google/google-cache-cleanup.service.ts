import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GoogleCacheService } from './google-cache.service';

@Injectable()
export class GoogleCacheCleanupService {
  constructor(private readonly cacheService: GoogleCacheService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredCache() {
    console.log('Cleaning up expired Google API cache entries...');
    await this.cacheService.cleanupExpiredCache();
    console.log('Google API cache cleanup completed');
  }
}

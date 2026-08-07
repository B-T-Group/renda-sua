import { Module } from '@nestjs/common';
import { FacebookCatalogFeedController } from './facebook-catalog-feed.controller';
import { FacebookCatalogFeedService } from './facebook-catalog-feed.service';

@Module({
  controllers: [FacebookCatalogFeedController],
  providers: [FacebookCatalogFeedService],
})
export class FacebookCatalogFeedModule {}

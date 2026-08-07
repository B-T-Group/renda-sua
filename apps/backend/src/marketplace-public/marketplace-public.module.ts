import { Module } from '@nestjs/common';
import { MarketplacePublicController } from './marketplace-public.controller';
import { MarketplacePublicService } from './marketplace-public.service';

@Module({
  controllers: [MarketplacePublicController],
  providers: [MarketplacePublicService],
  exports: [MarketplacePublicService],
})
export class MarketplacePublicModule {}

import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { MetaConversionsClientService } from './meta-conversions-client.service';
import { MetaConversionsTrackController } from './meta-conversions-track.controller';
import { MetaConversionsService } from './meta-conversions.service';
import { OrderPaidMetaListener } from './order-paid-meta.listener';

@Module({
  imports: [HasuraModule],
  controllers: [MetaConversionsTrackController],
  providers: [
    MetaConversionsClientService,
    MetaConversionsService,
    OrderPaidMetaListener,
  ],
  exports: [MetaConversionsService],
})
export class MetaConversionsModule {}

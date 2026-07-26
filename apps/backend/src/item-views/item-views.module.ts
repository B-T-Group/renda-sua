import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { MetaConversionsModule } from '../meta-conversions/meta-conversions.module';
import { ItemViewsController } from './item-views.controller';
import { ItemViewsService } from './item-views.service';

@Module({
  imports: [HasuraModule, MetaConversionsModule],
  controllers: [ItemViewsController],
  providers: [ItemViewsService],
  exports: [ItemViewsService],
})
export class ItemViewsModule {}


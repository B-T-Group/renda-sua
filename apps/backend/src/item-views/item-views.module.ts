import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { ItemViewsController } from './item-views.controller';
import { ItemViewsService } from './item-views.service';

@Module({
  imports: [HasuraModule],
  controllers: [ItemViewsController],
  providers: [ItemViewsService],
  exports: [ItemViewsService],
})
export class ItemViewsModule {}


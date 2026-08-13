import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { ItemLikesController } from './item-likes.controller';
import { ItemLikesService } from './item-likes.service';

@Module({
  imports: [HasuraModule],
  controllers: [ItemLikesController],
  providers: [ItemLikesService],
  exports: [ItemLikesService],
})
export class ItemLikesModule {}

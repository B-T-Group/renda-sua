import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { HasuraModule } from '../hasura/hasura.module';
import { ItemsService } from './items.service';

@Module({
  imports: [HasuraModule, EmbeddingsModule],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}

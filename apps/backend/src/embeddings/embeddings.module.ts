import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ItemEmbeddingInternalController } from './item-embedding-internal.controller';
import { ItemEmbeddingService } from './item-embedding.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ItemEmbeddingInternalController],
  providers: [ItemEmbeddingService],
  exports: [ItemEmbeddingService],
})
export class EmbeddingsModule {}

import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ItemEmbeddingService } from './item-embedding.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [ItemEmbeddingService],
  exports: [ItemEmbeddingService],
})
export class EmbeddingsModule {}

import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { HasuraModule } from '../hasura/hasura.module';
import { ImageValidationModule } from '../image-validation/image-validation.module';
import { ItemsService } from './items.service';

@Module({
  imports: [HasuraModule, EmbeddingsModule, ImageValidationModule],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}

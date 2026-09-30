import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { AwsModule } from '../aws/aws.module';
import { HasuraModule } from '../hasura/hasura.module';
import { CatalogArtworkCronService } from './catalog-artwork-cron.service';
import { CatalogArtworkService } from './catalog-artwork.service';

@Module({
  imports: [AiGenerationModule, AwsModule, HasuraModule],
  providers: [CatalogArtworkService, CatalogArtworkCronService],
  exports: [CatalogArtworkService],
})
export class CatalogArtworkModule {}

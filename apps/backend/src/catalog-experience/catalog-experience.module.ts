import { Module } from '@nestjs/common';
import { CatalogStopsModule } from '../catalog-stops/catalog-stops.module';
import { CollectionsModule } from '../collections/collections.module';
import { HasuraModule } from '../hasura/hasura.module';
import { CatalogExperienceContextBuilder } from './catalog-experience.context';
import { CatalogExperienceController } from './catalog-experience.controller';
import { CatalogExperienceService } from './catalog-experience.service';
import { CategoryCarouselProvider } from './providers/category-carousel.provider';
import { CollectionCarouselProvider } from './providers/collection-carousel.provider';
import { ProductGridProvider } from './providers/product-grid.provider';
import {
  DealsCarouselProvider,
  PopularCarouselProvider,
} from './providers/product-carousel.providers';
import { RecentlyViewedProvider } from './providers/recently-viewed.provider';

@Module({
  imports: [HasuraModule, CatalogStopsModule, CollectionsModule],
  controllers: [CatalogExperienceController],
  providers: [
    CatalogExperienceContextBuilder,
    CatalogExperienceService,
    CategoryCarouselProvider,
    CollectionCarouselProvider,
    DealsCarouselProvider,
    PopularCarouselProvider,
    RecentlyViewedProvider,
    ProductGridProvider,
  ],
})
export class CatalogExperienceModule {}

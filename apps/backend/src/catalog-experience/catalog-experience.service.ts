import { Injectable, Logger } from '@nestjs/common';
import {
  buildCatalogCategoriesCacheKey,
  buildCatalogExperienceCacheKey,
  CATALOG_EXPERIENCE_RETURNING_TTL_SECONDS,
  CATALOG_EXPERIENCE_TTL_SECONDS,
} from '../catalog-cache/catalog-cache-keys';
import { CatalogCacheService } from '../catalog-cache/catalog-cache.service';
import { layoutProviderIds } from './catalog-layout.policy';
import type {
  CatalogExperienceContext,
  CatalogExperienceResponse,
  CatalogModule,
  CatalogModuleProvider,
} from './catalog-experience.types';
import { CategoryCarouselProvider } from './providers/category-carousel.provider';
import { CollectionCarouselProvider } from './providers/collection-carousel.provider';
import { ProductGridProvider } from './providers/product-grid.provider';
import {
  DealsCarouselProvider,
  PopularCarouselProvider,
} from './providers/product-carousel.providers';
import { RecentlyViewedProvider } from './providers/recently-viewed.provider';

@Injectable()
export class CatalogExperienceService {
  private readonly logger = new Logger(CatalogExperienceService.name);
  private readonly providers: Map<string, CatalogModuleProvider>;

  constructor(
    private readonly cache: CatalogCacheService,
    private readonly categories: CategoryCarouselProvider,
    collections: CollectionCarouselProvider,
    deals: DealsCarouselProvider,
    popular: PopularCarouselProvider,
    recentlyViewed: RecentlyViewedProvider,
    grid: ProductGridProvider
  ) {
    this.providers = new Map(
      [categories, collections, deals, popular, recentlyViewed, grid].map(
        (provider) => [provider.id, provider]
      )
    );
  }

  getExperience(
    context: CatalogExperienceContext
  ): Promise<CatalogExperienceResponse> {
    if (context.layout === 'results') return this.assemble(context);
    const bucket = context.isReturning ? 'returning' : 'cold';
    const ttl = context.isReturning
      ? CATALOG_EXPERIENCE_RETURNING_TTL_SECONDS
      : CATALOG_EXPERIENCE_TTL_SECONDS;
    return this.cache.getOrCompute(
      buildCatalogExperienceCacheKey({
        country: context.country,
        state: context.state,
        language: context.language,
        bucket,
        userId: context.userId,
      }),
      () => this.assemble(context),
      { ttlSeconds: ttl }
    );
  }

  listCategories(context: CatalogExperienceContext) {
    return this.cache.getOrCompute(
      buildCatalogCategoriesCacheKey(context),
      () => this.categories.listAll(context),
      { ttlSeconds: CATALOG_EXPERIENCE_TTL_SECONDS }
    );
  }

  private async assemble(
    context: CatalogExperienceContext
  ): Promise<CatalogExperienceResponse> {
    const built = await Promise.all(
      layoutProviderIds(context).map((id) => this.buildOne(id, context))
    );
    return {
      modules: built.filter((module): module is CatalogModule => module !== null),
    };
  }

  private async buildOne(
    id: string,
    context: CatalogExperienceContext
  ): Promise<CatalogModule | null> {
    const provider = this.providers.get(id);
    if (!provider?.supports(context)) return null;
    try {
      return await provider.build(context);
    } catch (error: any) {
      this.logger.warn(`Catalog module ${id} skipped: ${error?.message ?? error}`);
      return null;
    }
  }
}

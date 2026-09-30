import { Injectable } from '@nestjs/common';
import { CollectionsService } from '../../collections/collections.service';
import { localizedCopy } from '../catalog-experience.geo';
import {
  CATALOG_CAROUSEL_LIMIT,
  type CatalogExperienceContext,
  type CatalogModule,
  type CatalogModuleProvider,
} from '../catalog-experience.types';

@Injectable()
export class CollectionCarouselProvider implements CatalogModuleProvider {
  readonly id = 'collections';

  constructor(private readonly collections: CollectionsService) {}

  supports(context: CatalogExperienceContext): boolean {
    return context.layout === 'discovery';
  }

  async build(context: CatalogExperienceContext): Promise<CatalogModule | null> {
    const items = await this.collections.listCollections({
      featured: true,
      country_code: context.country,
      state: context.state,
      lang: context.language,
    });
    const visible = items.slice(0, CATALOG_CAROUSEL_LIMIT);
    if (visible.length === 0) return null;
    return {
      id: 'featured-collections',
      type: 'COLLECTION_CAROUSEL',
      title: localizedCopy(
        context.language,
        'Collections for you',
        'Collections pour vous'
      ),
      items: visible,
    };
  }
}

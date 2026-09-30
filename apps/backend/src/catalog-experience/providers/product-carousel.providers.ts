import { Injectable } from '@nestjs/common';
import { CatalogStopsService } from '../../catalog-stops/catalog-stops.service';
import type { InventoryItem } from '../../inventory-items/inventory-items.service';
import { localizedCopy } from '../catalog-experience.geo';
import { rankListings } from '../catalog-listing-rank';
import {
  CATALOG_CAROUSEL_LIMIT,
  type CatalogExperienceContext,
  type CatalogModule,
  type CatalogModuleProvider,
} from '../catalog-experience.types';

function productModule(
  id: string,
  title: string,
  products: InventoryItem[]
): CatalogModule | null {
  if (products.length === 0) return null;
  return { id, type: 'PRODUCT_CAROUSEL', title, products };
}

@Injectable()
export class DealsCarouselProvider implements CatalogModuleProvider {
  readonly id = 'deals';

  constructor(private readonly stops: CatalogStopsService) {}

  supports(context: CatalogExperienceContext): boolean {
    return context.layout === 'discovery';
  }

  async build(context: CatalogExperienceContext): Promise<CatalogModule | null> {
    const deals = await this.stops.getDeals({
      country_code: context.country,
      state: context.state,
      limit: CATALOG_CAROUSEL_LIMIT,
    });
    const products = rankListings(deals.items, CATALOG_CAROUSEL_LIMIT);
    return productModule(
      'deals-near-you',
      localizedCopy(context.language, 'Deals near you', 'Offres près de chez vous'),
      products
    );
  }
}

@Injectable()
export class PopularCarouselProvider implements CatalogModuleProvider {
  readonly id = 'popular';

  constructor(private readonly stops: CatalogStopsService) {}

  supports(context: CatalogExperienceContext): boolean {
    return context.layout === 'discovery';
  }

  async build(context: CatalogExperienceContext): Promise<CatalogModule | null> {
    const top = await this.stops.getTopInCategory({
      country_code: context.country,
      state: context.state,
      limit: CATALOG_CAROUSEL_LIMIT,
    });
    const products = rankListings(top.items, CATALOG_CAROUSEL_LIMIT);
    return productModule(
      'popular-near-you',
      localizedCopy(context.language, 'Popular near you', 'Populaires près de vous'),
      products
    );
  }
}

import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { catalogLocationWhere, localizedCopy } from '../catalog-experience.geo';
import {
  CATALOG_CAROUSEL_LIMIT,
  MIN_CATEGORY_LISTINGS,
  type CatalogCategoryTile,
  type CatalogExperienceContext,
  type CatalogModule,
  type CatalogModuleProvider,
} from '../catalog-experience.types';
import { rankBySignals } from '../catalog-ranking.weights';

const CATEGORY_QUERY = `query CatalogCategories($locationWhere: business_locations_bool_exp!) {
  item_categories(where: { status: { _eq: active } }, order_by: { name: asc }) {
    id
    name
    image_url
    item_sub_categories {
      items_aggregate(
        where: {
          is_active: { _eq: true }
          business_inventories: {
            is_active: { _eq: true }
            computed_available_quantity: { _gt: 0 }
            business_location: $locationWhere
          }
        }
      ) { aggregate { count } }
    }
  }
}`;

interface CategoryRow {
  id: number;
  name: string;
  image_url?: string | null;
  item_sub_categories?: Array<{
    items_aggregate?: { aggregate?: { count?: number } };
  }>;
}

@Injectable()
export class CategoryCarouselProvider implements CatalogModuleProvider {
  readonly id = 'categories';

  constructor(private readonly hasura: HasuraSystemService) {}

  supports(context: CatalogExperienceContext): boolean {
    return context.layout === 'discovery';
  }

  async build(context: CatalogExperienceContext): Promise<CatalogModule | null> {
    const items = await this.loadTiles(context);
    if (items.length === 0) return null;
    return {
      id: 'explore-categories',
      type: 'CATEGORY_CAROUSEL',
      title: localizedCopy(
        context.language,
        'Explore categories',
        'Explorez les catégories'
      ),
      items,
    };
  }

  private async loadTiles(
    context: CatalogExperienceContext
  ): Promise<CatalogCategoryTile[]> {
    const rows = await this.fetchRows(context);
    const tiles = rows
      .map((row) => this.toTile(row))
      .filter((tile) => tile.listingCount >= MIN_CATEGORY_LISTINGS);
    return rankBySignals(
      tiles,
      (tile) => ({ popularity: tile.listingCount }),
      CATALOG_CAROUSEL_LIMIT
    );
  }

  private toTile(row: CategoryRow): CatalogCategoryTile {
    const listingCount = (row.item_sub_categories ?? []).reduce(
      (sum, sub) => sum + (sub.items_aggregate?.aggregate?.count ?? 0),
      0
    );
    return {
      id: row.id,
      name: row.name,
      imageUrl: row.image_url?.trim() || null,
      listingCount,
    };
  }

  private async fetchRows(
    context: CatalogExperienceContext
  ): Promise<CategoryRow[]> {
    const locationWhere = catalogLocationWhere(context.country, context.state);
    const result = await this.hasura.executeQuery(CATEGORY_QUERY, {
      locationWhere,
    });
    return (result.item_categories ?? []) as CategoryRow[];
  }
}

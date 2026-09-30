import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { InventoryItemsService } from '../../inventory-items/inventory-items.service';
import { localizedCopy } from '../catalog-experience.geo';
import { rankListings } from '../catalog-listing-rank';
import {
  CATALOG_CAROUSEL_LIMIT,
  type CatalogExperienceContext,
  type CatalogModule,
  type CatalogModuleProvider,
} from '../catalog-experience.types';

@Injectable()
export class RecentlyViewedProvider implements CatalogModuleProvider {
  readonly id = 'recently-viewed';

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly inventory: InventoryItemsService
  ) {}

  supports(context: CatalogExperienceContext): boolean {
    return context.layout === 'discovery' && context.isReturning && !!context.userId;
  }

  async build(context: CatalogExperienceContext): Promise<CatalogModule | null> {
    if (!context.userId) return null;
    const itemIds = await this.recentItemIds(context.userId);
    if (itemIds.length === 0) return null;
    const products = await this.listingsFor(itemIds);
    if (products.length === 0) return null;
    return {
      id: 'recently-viewed',
      type: 'RECENTLY_VIEWED',
      title: localizedCopy(
        context.language,
        'Pick up where you left off',
        'Reprenez là où vous en étiez'
      ),
      products,
    };
  }

  private async recentItemIds(userId: string): Promise<string[]> {
    const result = await this.hasura.executeQuery(
      `query RecentCatalogViews($viewerId: String!, $limit: Int!) {
        item_view_events(
          where: { viewer_id: { _eq: $viewerId }, viewer_type: { _eq: "user" } }
          order_by: { last_viewed_at: desc }
          limit: $limit
        ) { business_inventory { item_id } }
      }`,
      { viewerId: userId, limit: CATALOG_CAROUSEL_LIMIT }
    );
    return uniqueItemIds(result.item_view_events ?? []);
  }

  private async listingsFor(itemIds: string[]) {
    const listings = await this.inventory.getBestListingsForCatalogItemIds(itemIds);
    const personalization = new Map(
      itemIds.map((id, index) => [id, itemIds.length - index])
    );
    return rankListings(listings, CATALOG_CAROUSEL_LIMIT, personalization);
  }
}

function uniqueItemIds(
  rows: Array<{ business_inventory?: { item_id?: string } | null }>
): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    const itemId = row.business_inventory?.item_id;
    if (itemId && !ids.includes(itemId)) ids.push(itemId);
  }
  return ids;
}

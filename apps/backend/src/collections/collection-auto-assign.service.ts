import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

const MAX_AUTO_COLLECTIONS = 2;

type ItemForAutoAssign = {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  brand?: { name?: string | null } | null;
  item_sub_category?: {
    name?: string | null;
    item_category?: { name?: string | null } | null;
  } | null;
  item_images?: Array<{ image_url: string; image_type?: string | null }>;
  item_collections?: Array<{ collection_id: string }>;
};

/**
 * Append-only AI collection assignment for active catalog items.
 * Never removes existing memberships; never blocks callers on AI failure.
 */
@Injectable()
export class CollectionAutoAssignService {
  private readonly logger = new Logger(CollectionAutoAssignService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly aiService: AiService
  ) {}

  async autoAssignCollectionsIfFit(itemId: string): Promise<string[]> {
    try {
      const item = await this.loadItem(itemId);
      if (!item?.is_active) {
        return [];
      }

      const assigned = new Set(
        (item.item_collections ?? []).map((ic) => ic.collection_id)
      );
      if (assigned.size >= MAX_AUTO_COLLECTIONS) {
        return [];
      }

      const collections = await this.listCollections();
      if (!collections.length) {
        return [];
      }

      const imageUrls = (item.item_images ?? [])
        .filter((img) => !img.image_type || img.image_type === 'main')
        .map((img) => img.image_url)
        .filter(Boolean)
        .slice(0, 2);

      const suggestions = await this.aiService.generateCollectionSuggestions({
        itemName: item.name,
        description: item.description ?? undefined,
        subCategoryName: item.item_sub_category?.name ?? undefined,
        categoryName: item.item_sub_category?.item_category?.name ?? undefined,
        brandName: item.brand?.name ?? undefined,
        imageUrls,
        availableCollections: collections,
        strictFitOnly: true,
        maxSuggestions: MAX_AUTO_COLLECTIONS,
      });

      const toInsert = suggestions
        .map((s) => s.collectionId)
        .filter((id) => !assigned.has(id))
        .slice(0, MAX_AUTO_COLLECTIONS - assigned.size);

      if (!toInsert.length) {
        return [];
      }

      await this.insertMemberships(itemId, toInsert);
      this.logger.log(
        `Auto-assigned collections for item ${itemId}: ${toInsert.join(', ')}`
      );
      return toInsert;
    } catch (error: any) {
      this.logger.warn(
        `Collection auto-assign skipped for ${itemId}: ${error?.message || error}`
      );
      return [];
    }
  }

  private async loadItem(itemId: string): Promise<ItemForAutoAssign | null> {
    const result = await this.hasuraSystemService.executeQuery<{
      items_by_pk: ItemForAutoAssign | null;
    }>(
      `
      query ItemForCollectionAutoAssign($id: uuid!) {
        items_by_pk(id: $id) {
          id
          name
          description
          is_active
          brand { name }
          item_sub_category {
            name
            item_category { name }
          }
          item_images(order_by: { created_at: asc }, limit: 3) {
            image_url
            image_type
          }
          item_collections { collection_id }
        }
      }
    `,
      { id: itemId }
    );
    return result.items_by_pk;
  }

  private async listCollections(): Promise<
    Array<{ id: string; slug: string; name_en: string; name_fr: string }>
  > {
    const result = await this.hasuraSystemService.executeQuery<{
      collections: Array<{
        id: string;
        slug: string;
        name_en: string;
        name_fr: string;
      }>;
    }>(`
      query AllCollectionsForAutoAssign {
        collections(order_by: [{ sort_order: asc }, { name_en: asc }]) {
          id slug name_en name_fr
        }
      }
    `);
    return result.collections ?? [];
  }

  private async insertMemberships(
    itemId: string,
    collectionIds: string[]
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `
      mutation InsertAutoItemCollections($objects: [item_collections_insert_input!]!) {
        insert_item_collections(
          objects: $objects
          on_conflict: {
            constraint: item_collections_pkey
            update_columns: []
          }
        ) { affected_rows }
      }
    `,
      {
        objects: collectionIds.map((collectionId) => ({
          item_id: itemId,
          collection_id: collectionId,
        })),
      }
    );
  }
}

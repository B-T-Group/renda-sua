import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ItemEmbeddingService } from '../embeddings/item-embedding.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { ItemActivationValidationService } from '../image-validation/item-activation-validation.service';
import { UpdateItemDto } from '../business-items/dto/update-item.dto';

/** Payload for `items` insert; `business_id` is set by the service. */
export type ItemsInsertInput = Record<string, unknown>;

const GET_ITEM_BY_ID = `
  query GetItemById($itemId: uuid!) {
    items_by_pk(id: $itemId) {
      id
      business_id
      name
      description
    }
  }
`;

const INSERT_ITEM = `
  mutation CreateItem($itemData: items_insert_input!) {
    insert_items_one(object: $itemData) {
      id
      name
      description
      sku
    }
  }
`;

const UPDATE_ITEM = `
  mutation UpdateItem($id: uuid!, $itemData: items_set_input!) {
    update_items_by_pk(
      pk_columns: { id: $id }
      _set: $itemData
    ) {
      id
      name
      description
      item_sub_category_id
      pay_on_delivery_enabled
      pay_at_pickup_enabled
      weight
      weight_unit
      dimensions
      price
      currency
      sku
      brand_id
      model
      color
      is_fragile
      is_perishable
      requires_special_handling
      max_delivery_distance
      estimated_delivery_time
      min_order_quantity
      max_order_quantity
      is_active
      business_id
      created_at
      updated_at
      brand {
        id
        name
        description
      }
      item_sub_category {
        id
        name
        google_product_category
        fb_product_category
        google_product_category_row {
          id
          name_en
          name_fr
        }
        fb_product_category_row {
          id
          name_en
          name_fr
        }
        item_category {
          id
          name
        }
      }
    }
  }
`;

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly itemEmbeddingService: ItemEmbeddingService,
    private readonly activationValidation: ItemActivationValidationService
  ) {}

  async createItem(
    businessId: string,
    input: ItemsInsertInput
  ): Promise<Record<string, unknown>> {
    const itemData = { ...input, business_id: businessId };
    const result = await this.hasuraUserService.executeMutation<{
      insert_items_one: {
        id: string;
        name: string;
        description: string;
        sku: string | null;
      } | null;
    }>(INSERT_ITEM, { itemData });
    const row = result?.insert_items_one;
    if (!row?.id) {
      throw new HttpException(
        { success: false, error: 'Failed to create item' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    await this.syncEmbeddings(row.id, row.name, row.description ?? '');
    return row as Record<string, unknown>;
  }

  async updateItem(
    businessId: string,
    itemId: string,
    updates: UpdateItemDto | Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const item = await this.requireOwnedItem(businessId, itemId);
    const itemData = this.normalizeUpdatePayload(updates);
    if (itemData.is_active === true) {
      await this.activationValidation.assertItemCanActivate(itemId);
    }
    const result = await this.hasuraUserService.executeMutation<{
      update_items_by_pk: Record<string, unknown> | null;
    }>(UPDATE_ITEM, { id: itemId, itemData });
    const updated = result?.update_items_by_pk;
    const nextName =
      typeof updates.name === 'string' ? updates.name : item.name;
    const nextDesc =
      typeof updates.description === 'string'
        ? updates.description
        : (item.description ?? '');
    await this.syncEmbeddings(itemId, nextName, nextDesc, {
      previousName: item.name,
      previousDescription: item.description ?? '',
    });
    return updated;
  }

  private async requireOwnedItem(
    businessId: string,
    itemId: string
  ): Promise<{ name: string; description: string }> {
    const result = await this.hasuraUserService.executeQuery<{
      items_by_pk: {
        id: string;
        business_id: string;
        name: string;
        description: string;
      } | null;
    }>(GET_ITEM_BY_ID, { itemId });
    const item = result?.items_by_pk;
    if (!item || item.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Item not found or not owned by business' },
        HttpStatus.FORBIDDEN
      );
    }
    return item;
  }

  private normalizeUpdatePayload(
    updates: UpdateItemDto | Record<string, unknown>
  ): Record<string, unknown> {
    return {
      ...updates,
      ...(Object.prototype.hasOwnProperty.call(updates, 'description') &&
      (updates.description === undefined || updates.description === null)
        ? { description: '' }
        : {}),
    };
  }

  private async syncEmbeddings(
    itemId: string,
    name: string,
    description: string,
    options?: { previousName?: string; previousDescription?: string }
  ): Promise<void> {
    try {
      await this.itemEmbeddingService.syncItemEmbeddings(
        itemId,
        { name, description },
        options
      );
    } catch (error: any) {
      this.logger.warn(
        `Item embeddings sync failed for ${itemId}: ${error?.message ?? error}`
      );
    }
  }
}

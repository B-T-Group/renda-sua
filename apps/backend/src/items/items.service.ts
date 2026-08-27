import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { normalizeWeightUnit } from '../common/weight-units';
import { ItemEmbeddingService } from '../embeddings/item-embedding.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ItemActivationValidationService } from '../image-validation/item-activation-validation.service';
import { UpdateItemDto } from '../business-items/dto/update-item.dto';
import {
  assertItemDecimalField,
  rethrowNumericOverflow,
} from './item-numeric-fields';

/** Payload for `items` insert; `business_id` is set by the service. */
export type ItemsInsertInput = Record<string, unknown>;

const MUTABLE_ITEM_FIELDS = [
  'name',
  'description',
  'item_sub_category_id',
  'weight',
  'weight_unit',
  'dimensions',
  'price',
  'currency',
  'sku',
  'brand_id',
  'model',
  'color',
  'is_fragile',
  'is_perishable',
  'is_used',
  'requires_special_handling',
  'max_delivery_distance',
  'estimated_delivery_time',
  'preparation_minutes',
  'min_order_quantity',
  'max_order_quantity',
  'is_active',
  'pay_on_delivery_enabled',
  'pay_at_pickup_enabled',
  'shipping_enabled',
  'shipping_price',
  'shipping_currency',
  'status',
  'stripe_tax_code_id',
] as const;

const GET_ITEM_BY_ID = `
  query GetItemById($itemId: uuid!) {
    items_by_pk(id: $itemId) {
      id
      business_id
      name
      description
      moderation_status
      shipping_enabled
      shipping_price
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
      shipping_enabled
      shipping_price
      shipping_currency
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
      is_used
      requires_special_handling
      max_delivery_distance
      estimated_delivery_time
      preparation_minutes
      min_order_quantity
      max_order_quantity
      is_active
      moderation_status
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
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly itemEmbeddingService: ItemEmbeddingService,
    private readonly activationValidation: ItemActivationValidationService
  ) {}

  async createItem(
    businessId: string,
    input: ItemsInsertInput
  ): Promise<Record<string, unknown>> {
    const itemData = {
      ...this.pickMutableFields(input),
      business_id: businessId,
      // Never allow clients to activate on create; moderation must approve first
      is_active: false,
      // Explicit draft so create-from-image / catalog creates never inherit a
      // surprising status if defaults or presets change.
      moderation_status: 'draft',
    };
    this.assertShippingFields(itemData);
    const result = await this.mutateItem<{
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
    return this.applyItemUpdate(itemId, item, updates);
  }

  /** Platform admin update — system client, no business ownership check. */
  async adminUpdateItem(
    itemId: string,
    updates: UpdateItemDto | Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const item = await this.requireItemById(itemId);
    return this.applyItemUpdate(itemId, item, updates);
  }

  private async applyItemUpdate(
    itemId: string,
    item: {
      name: string;
      description: string;
      moderation_status: string;
      shipping_enabled?: boolean | null;
      shipping_price?: number | null;
    },
    updates: UpdateItemDto | Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const itemData = this.normalizeUpdatePayload(updates);
    this.assertShippingFields(itemData, item);
    await this.assertActivationAllowed(item, itemData, itemId);
    const result = await this.mutateItem<{
      update_items_by_pk: Record<string, unknown> | null;
    }>(UPDATE_ITEM, { id: itemId, itemData });
    const updated = result?.update_items_by_pk;
    const nextName =
      typeof updates.name === 'string' ? updates.name : item.name;
    const nextDesc =
      typeof updates.description === 'string'
        ? updates.description
        : item.description ?? '';
    await this.syncEmbeddings(itemId, nextName, nextDesc, {
      previousName: item.name,
      previousDescription: item.description ?? '',
    });
    return updated;
  }

  private async assertActivationAllowed(
    item: { moderation_status: string },
    itemData: Record<string, unknown>,
    itemId: string
  ): Promise<void> {
    if (itemData.is_active !== true) return;
    if (item.moderation_status !== 'approved') {
      throw new HttpException(
        {
          success: false,
          error: 'ITEM_NOT_APPROVED',
          message:
            'Item must be approved by moderation before it can be activated.',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    await this.activationValidation.assertItemCanActivate(itemId);
  }

  private async requireOwnedItem(
    businessId: string,
    itemId: string
  ): Promise<{
    name: string;
    description: string;
    moderation_status: string;
    shipping_enabled?: boolean | null;
    shipping_price?: number | null;
  }> {
    const result = await this.hasuraUserService.executeQuery<{
      items_by_pk: {
        id: string;
        business_id: string;
        name: string;
        description: string;
        moderation_status: string;
        shipping_enabled?: boolean | null;
        shipping_price?: number | null;
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

  private async requireItemById(itemId: string): Promise<{
    name: string;
    description: string;
    moderation_status: string;
    shipping_enabled?: boolean | null;
    shipping_price?: number | null;
  }> {
    const result = await this.hasuraSystemService.executeQuery<{
      items_by_pk: {
        id: string;
        name: string;
        description: string;
        moderation_status: string;
        shipping_enabled?: boolean | null;
        shipping_price?: number | null;
      } | null;
    }>(GET_ITEM_BY_ID, { itemId });
    const item = result?.items_by_pk;
    if (!item) {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return item;
  }

  private normalizeUpdatePayload(
    updates: UpdateItemDto | Record<string, unknown>
  ): Record<string, unknown> {
    const itemData = this.pickMutableFields(updates);
    return {
      ...itemData,
      ...(Object.prototype.hasOwnProperty.call(itemData, 'description') &&
      (itemData.description === undefined || itemData.description === null)
        ? { description: '' }
        : {}),
    };
  }

  private pickMutableFields(
    input: Record<string, unknown> | UpdateItemDto
  ): Record<string, unknown> {
    const source = input as Record<string, unknown>;
    return Object.fromEntries(
      MUTABLE_ITEM_FIELDS.filter((field) =>
        Object.prototype.hasOwnProperty.call(source, field)
      ).map((field) => {
        const value = source[field];
        if (field === 'weight_unit') {
          return [field, this.resolveWeightUnit(value)];
        }
        assertItemDecimalField(field, value);
        return [field, value];
      })
    );
  }

  private assertShippingFields(
    itemData: Record<string, unknown>,
    existing?: {
      shipping_enabled?: boolean | null;
      shipping_price?: number | null;
    }
  ): void {
    const enabled =
      itemData.shipping_enabled !== undefined
        ? itemData.shipping_enabled === true
        : existing?.shipping_enabled === true;
    if (!enabled) return;
    const price =
      itemData.shipping_price !== undefined
        ? itemData.shipping_price
        : existing?.shipping_price;
    if (!this.shippingPriceIsValid(price)) {
      throw new HttpException(
        {
          success: false,
          error:
            'shipping_price is required and must be >= 0 when shipping is enabled',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async mutateItem<T>(
    mutation: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    try {
      return await this.hasuraSystemService.executeMutation<T>(
        mutation,
        variables
      );
    } catch (error: any) {
      rethrowNumericOverflow(error);
      throw error;
    }
  }

  private shippingPriceIsValid(price: unknown): price is number {
    return typeof price === 'number' && !Number.isNaN(price) && price >= 0;
  }

  private resolveWeightUnit(value: unknown): string | null {
    if (value == null || (typeof value === 'string' && !value.trim())) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new HttpException(
        {
          success: false,
          error: 'Invalid weight_unit. Allowed: g, kg, lb, oz',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const normalized = normalizeWeightUnit(value);
    if (!normalized) {
      throw new HttpException(
        {
          success: false,
          error: `Invalid weight_unit "${value}". Allowed: g, kg, lb, oz`,
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return normalized;
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

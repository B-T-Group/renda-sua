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
  'export_available',
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
      price
      export_available
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
    const marketCodes = this.extractExportMarketCodes(input);
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
    const isExport =
      (itemData as Record<string, unknown>).export_available === true;
    if (marketCodes !== undefined || isExport) {
      await this.assertExportDestinations(isExport, marketCodes ?? [], true);
    }
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
    if (marketCodes !== undefined || isExport) {
      await this.syncExportMarkets(row.id, marketCodes ?? [], isExport);
    }
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
      price?: number | null;
      export_available?: boolean | null;
    },
    updates: UpdateItemDto | Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const marketCodes = this.extractExportMarketCodes(updates);
    const itemData = this.normalizeUpdatePayload(updates);
    this.assertShippingFields(itemData, item);
    this.assertExportAvailableClearRequiresPrice(itemData, item);
    await this.assertActivationAllowed(item, itemData, itemId);
    const nextExportAvailable =
      itemData.export_available !== undefined
        ? itemData.export_available === true
        : item.export_available === true;
    if (marketCodes !== undefined || itemData.export_available !== undefined) {
      await this.assertExportDestinations(
        nextExportAvailable,
        marketCodes,
        false,
        itemId
      );
    }
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
    if (marketCodes !== undefined || itemData.export_available !== undefined) {
      await this.syncExportMarkets(
        itemId,
        marketCodes ?? (nextExportAvailable ? undefined : []),
        nextExportAvailable
      );
    }
    return updated;
  }

  private async assertExportDestinations(
    exportAvailable: boolean,
    countryCodes: string[] | undefined,
    isCreate: boolean,
    itemId?: string
  ): Promise<void> {
    if (!exportAvailable) return;
    if (countryCodes !== undefined) {
      if (countryCodes.length === 0) throw this.exportMarketsRequiredError();
      await this.normalizeExportMarketCodes(countryCodes);
      return;
    }
    if (isCreate || !itemId) throw this.exportMarketsRequiredError();
    const count = await this.countExportMarkets(itemId);
    if (count === 0) throw this.exportMarketsRequiredError();
  }

  private async countExportMarkets(itemId: string): Promise<number> {
    const existing = await this.hasuraSystemService.executeQuery<{
      item_export_markets_aggregate: { aggregate: { count: number } | null };
    }>(
      `query CountExportMarkets($itemId: uuid!) {
        item_export_markets_aggregate(where: { item_id: { _eq: $itemId } }) {
          aggregate { count }
        }
      }`,
      { itemId }
    );
    return existing.item_export_markets_aggregate?.aggregate?.count ?? 0;
  }

  private exportMarketsRequiredError(): HttpException {
    return new HttpException(
      {
        success: false,
        error: 'EXPORT_MARKETS_REQUIRED',
        message:
          'Select at least one destination export market when export is available',
      },
      HttpStatus.BAD_REQUEST
    );
  }

  /**
   * Replace destination markets for an export item.
   * When export_available is false, clears all markets.
   * When codes is undefined and still export-available, leaves markets unchanged.
   */
  async syncExportMarkets(
    itemId: string,
    countryCodes: string[] | undefined,
    exportAvailable: boolean
  ): Promise<void> {
    if (!exportAvailable) {
      await this.hasuraSystemService.executeMutation(
        `mutation ClearExportMarkets($itemId: uuid!) {
          delete_item_export_markets(where: { item_id: { _eq: $itemId } }) {
            affected_rows
          }
        }`,
        { itemId }
      );
      return;
    }
    if (countryCodes === undefined) return;
    const normalized = await this.normalizeExportMarketCodes(countryCodes);
    if (normalized.length === 0) {
      throw this.exportMarketsRequiredError();
    }
    await this.hasuraSystemService.executeMutation(
      `mutation ReplaceExportMarkets(
        $itemId: uuid!
        $objects: [item_export_markets_insert_input!]!
      ) {
        delete_item_export_markets(where: { item_id: { _eq: $itemId } }) {
          affected_rows
        }
        insert_item_export_markets(objects: $objects) {
          affected_rows
        }
      }`,
      {
        itemId,
        objects: normalized.map((country_code) => ({
          item_id: itemId,
          country_code,
        })),
      }
    );
  }

  private extractExportMarketCodes(
    input: Record<string, unknown> | UpdateItemDto
  ): string[] | undefined {
    const source = input as Record<string, unknown>;
    if (
      !Object.prototype.hasOwnProperty.call(
        source,
        'export_market_country_codes'
      )
    ) {
      return undefined;
    }
    const raw = source.export_market_country_codes;
    if (!Array.isArray(raw)) {
      throw new HttpException(
        {
          success: false,
          error: 'INVALID_EXPORT_MARKETS',
          message: 'export_market_country_codes must be an array of country codes',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return raw.map((c) => String(c));
  }

  private async normalizeExportMarketCodes(
    countryCodes: string[]
  ): Promise<string[]> {
    const unique = [
      ...new Set(
        countryCodes
          .map((c) => c.trim().toUpperCase())
          .filter((c) => /^[A-Z]{2}$/.test(c))
      ),
    ];
    if (unique.length === 0) {
      throw new HttpException(
        {
          success: false,
          error: 'INVALID_EXPORT_MARKETS',
          message:
            'export_market_country_codes must include valid ISO-2 country codes',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const result = await this.hasuraSystemService.executeQuery<{
      supported_country_states: Array<{
        country_code: string;
        service_status: string;
      }>;
    }>(
      `query ActiveExportMarkets($codes: [String!]!) {
        supported_country_states(
          where: {
            country_code: { _in: $codes }
            service_status: { _eq: "active" }
          }
        ) {
          country_code
          service_status
        }
      }`,
      { codes: unique }
    );
    const active = new Set(
      (result.supported_country_states ?? []).map((r) =>
        r.country_code.toUpperCase()
      )
    );
    const invalid = unique.filter((c) => !active.has(c));
    if (invalid.length > 0) {
      throw new HttpException(
        {
          success: false,
          error: 'INVALID_EXPORT_MARKETS',
          message: `Export markets must be active supported countries: ${invalid.join(
            ', '
          )}`,
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return unique;
  }

  private assertExportAvailableClearRequiresPrice(
    itemData: Record<string, unknown>,
    existing: { price?: number | null; export_available?: boolean | null }
  ): void {
    if (itemData.export_available !== false) return;
    const nextPrice =
      itemData.price !== undefined ? itemData.price : existing.price;
    if (
      typeof nextPrice === 'number' &&
      !Number.isNaN(nextPrice) &&
      nextPrice > 0
    ) {
      return;
    }
    throw new HttpException(
      {
        success: false,
        error: 'PRICE_REQUIRED',
        message:
          'A valid price is required before turning off export availability',
      },
      HttpStatus.BAD_REQUEST
    );
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
    price?: number | null;
    export_available?: boolean | null;
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
        price?: number | null;
        export_available?: boolean | null;
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
    price?: number | null;
    export_available?: boolean | null;
  }> {
    const result = await this.hasuraSystemService.executeQuery<{
      items_by_pk: {
        id: string;
        name: string;
        description: string;
        moderation_status: string;
        shipping_enabled?: boolean | null;
        shipping_price?: number | null;
        price?: number | null;
        export_available?: boolean | null;
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

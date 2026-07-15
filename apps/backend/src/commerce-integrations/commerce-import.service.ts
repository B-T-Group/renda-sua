import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BusinessItemsAccessService } from '../business-items/business-items-access.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { CommerceConnectionService } from './commerce-connection.service';
import { CommerceIntegrationsDatabaseService } from './commerce-integrations-database.service';
import { CommerceProduct } from './connectors/commerce-connector';

@Injectable()
export class CommerceImportService {
  private readonly logger = new Logger(CommerceImportService.name);

  constructor(
    private readonly db: CommerceIntegrationsDatabaseService,
    private readonly connection: CommerceConnectionService,
    private readonly access: BusinessItemsAccessService,
    private readonly hasura: HasuraSystemService
  ) {}

  async previewProducts(
    integrationId: string,
    cursor?: string | null,
    businessId?: string
  ) {
    const ctx = await this.access.resolveAccess(businessId);
    const integration = await this.connection.requireOwnedIntegration(
      integrationId,
      ctx.targetBusinessId
    );
    const { token, connector } = this.connection.getDecryptedAccess(
      integration.provider,
      integration
    );
    const page = await connector.listProducts(
      token,
      integration.external_shop_id,
      cursor
    );
    const productMappings = await this.db.listMappings(integrationId, 'product');
    const mappedExternal = new Set(productMappings.map((m) => m.external_id));

    const skus = page.products
      .flatMap((p) => p.variants.map((v) => v.sku).filter(Boolean)) as string[];
    const existingBySku = await this.findItemsBySkus(
      ctx.targetBusinessId,
      skus
    );

    return {
      nextCursor: page.nextCursor,
      products: page.products.map((p) => ({
        ...p,
        alreadyMapped: mappedExternal.has(p.externalId),
        duplicateCandidates: p.variants
          .map((v) =>
            v.sku && existingBySku[v.sku]
              ? { sku: v.sku, itemId: existingBySku[v.sku] }
              : null
          )
          .filter(Boolean),
      })),
    };
  }

  async importProducts(
    integrationId: string,
    externalProductIds: string[],
    options: {
      businessId?: string;
      defaultSubCategoryId?: number;
      importInventory?: boolean;
    }
  ) {
    const ctx = await this.access.resolveAccess(options.businessId);
    const integration = await this.connection.requireOwnedIntegration(
      integrationId,
      ctx.targetBusinessId
    );
    if (!externalProductIds.length) {
      throw new HttpException(
        { success: false, error: 'No products selected' },
        HttpStatus.BAD_REQUEST
      );
    }

    const subCategoryId =
      options.defaultSubCategoryId ??
      (await this.resolveDefaultSubCategoryId());
    if (!subCategoryId) {
      throw new HttpException(
        {
          success: false,
          error: 'No default subcategory available for imported products',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const { token, connector } = this.connection.getDecryptedAccess(
      integration.provider,
      integration
    );
    const runId = await this.db.createSyncRun({
      integration_id: integration.id,
      trigger: 'INITIAL_IMPORT',
      direction: 'inbound',
      entity_type: 'product',
      status: 'running',
    });

    const selected = new Set(externalProductIds);
    const results: Array<{
      externalId: string;
      success: boolean;
      itemId?: string;
      error?: string;
    }> = [];
    let cursor: string | null = null;
    const toImport: CommerceProduct[] = [];

    do {
      const page = await connector.listProducts(
        token,
        integration.external_shop_id,
        cursor
      );
      for (const product of page.products) {
        if (selected.has(product.externalId)) toImport.push(product);
      }
      cursor = page.nextCursor;
    } while (cursor && toImport.length < selected.size);

    const foundExternalIds = new Set(toImport.map((p) => p.externalId));
    for (const externalId of externalProductIds) {
      if (!foundExternalIds.has(externalId)) {
        results.push({
          externalId,
          success: false,
          error: 'Product was not found in Shopify catalog',
        });
      }
    }

    const locationMappings = (
      await this.db.listMappings(integration.id, 'location')
    ).filter((m) => m.sync_enabled);

    for (const product of toImport) {
      try {
        const itemId = await this.importOneProduct(
          integration.id,
          ctx.targetBusinessId,
          product,
          subCategoryId,
          locationMappings,
          token,
          connector,
          options.importInventory !== false
        );
        results.push({
          externalId: product.externalId,
          success: true,
          itemId,
        });
      } catch (error: any) {
        this.logger.error(
          `Import failed for ${product.externalId}: ${error?.message}`
        );
        results.push({
          externalId: product.externalId,
          success: false,
          error: error?.message || 'import_failed',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const status =
      successCount === results.length
        ? 'success'
        : successCount > 0
        ? 'partial'
        : 'failed';
    await this.db.completeSyncRun(runId, status, {
      total: results.length,
      successCount,
      failedCount: results.length - successCount,
    });
    await this.db.updateIntegration(integration.id, {
      last_synced_at: new Date().toISOString(),
      last_error: status === 'failed' ? 'Product import failed' : null,
    });

    return { runId, status, results };
  }

  private async importOneProduct(
    integrationId: string,
    businessId: string,
    product: CommerceProduct,
    subCategoryId: number,
    locationMappings: Array<{
      internal_id: string;
      external_id: string;
    }>,
    token: string,
    connector: {
      getInventoryLevels: (
        accessToken: string,
        shopDomain: string,
        params: { locationIds?: string[] }
      ) => Promise<{ levels: Array<{
        externalInventoryItemId: string;
        externalLocationId: string;
        available: number;
      }> }>;
    },
    importInventory: boolean
  ): Promise<string> {
    const existing = await this.db.findMappingByExternal(
      integrationId,
      'product',
      product.externalId
    );
    if (existing) {
      return existing.internal_id;
    }

    const currency = 'USD';
    const firstPrice =
      product.variants.find((v) => v.price != null)?.price ?? 0;
    const firstSku = product.variants.find((v) => v.sku)?.sku ?? null;

    const itemId = await this.createDraftItem({
      businessId,
      name: product.title,
      description: this.stripHtml(product.description || ''),
      price: firstPrice,
      currency,
      sku: firstSku,
      subCategoryId,
      imageUrls: product.imageUrls,
    });

    await this.db.upsertMapping({
      integration_id: integrationId,
      entity_type: 'product',
      internal_id: itemId,
      external_id: product.externalId,
      sync_enabled: true,
      metadata: { title: product.title },
      last_synced_at: new Date().toISOString(),
    });

    const inventoryItemToVariant = new Map<string, string>();

    for (const [index, variant] of product.variants.entries()) {
      const variantId = await this.createVariant({
        itemId,
        name: variant.title || 'Default',
        sku: variant.sku ?? null,
        price: variant.price ?? null,
        isDefault: index === 0,
        imageUrl: variant.imageUrl,
      });
      await this.db.upsertMapping({
        integration_id: integrationId,
        entity_type: 'variant',
        internal_id: variantId,
        external_id: variant.externalId,
        external_parent_id: product.externalId,
        metadata: { sku: variant.sku },
      });
      if (variant.externalInventoryItemId) {
        await this.db.upsertMapping({
          integration_id: integrationId,
          entity_type: 'inventory_item',
          internal_id: variantId,
          external_id: variant.externalInventoryItemId,
          external_parent_id: variant.externalId,
        });
        inventoryItemToVariant.set(
          variant.externalInventoryItemId,
          variantId
        );
      }
    }

    if (importInventory && locationMappings.length) {
      const shopDomain = (
        await this.db.findIntegrationById(integrationId)
      )!.external_shop_id;
      const levels = await connector.getInventoryLevels(token, shopDomain, {
        locationIds: locationMappings.map((m) => m.external_id),
      });
      for (const level of levels.levels) {
        const variantId = inventoryItemToVariant.get(
          level.externalInventoryItemId
        );
        if (!variantId) continue;
        const loc = locationMappings.find(
          (m) => m.external_id === level.externalLocationId
        );
        if (!loc) continue;
        await this.upsertInventoryRow({
          businessLocationId: loc.internal_id,
          itemId,
          itemVariantId: variantId,
          quantity: Math.max(0, level.available),
          sellingPrice: firstPrice,
        });
        await this.db.upsertMapping({
          integration_id: integrationId,
          entity_type: 'inventory_level',
          internal_id: await this.findInventoryId(
            loc.internal_id,
            itemId,
            variantId
          ),
          external_id: `${level.externalInventoryItemId}:${level.externalLocationId}`,
          metadata: {
            inventoryItemId: level.externalInventoryItemId,
            locationId: level.externalLocationId,
          },
        });
      }
    }

    return itemId;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private async resolveDefaultSubCategoryId(): Promise<number | null> {
    const q = `
      query {
        item_sub_categories(limit: 1, order_by: { id: asc }) { id }
      }
    `;
    const res = await this.hasura.executeQuery<{
      item_sub_categories: Array<{ id: number }>;
    }>(q);
    return res.item_sub_categories[0]?.id ?? null;
  }

  private async findItemsBySkus(
    businessId: string,
    skus: string[]
  ): Promise<Record<string, string>> {
    if (!skus.length) return {};
    const q = `
      query ($businessId: uuid!, $skus: [String!]!) {
        items(
          where: {
            business_id: { _eq: $businessId }
            sku: { _in: $skus }
            status: { _neq: deleted }
          }
        ) { id sku }
      }
    `;
    const res = await this.hasura.executeQuery<{
      items: Array<{ id: string; sku: string }>;
    }>(q, { businessId, skus });
    const map: Record<string, string> = {};
    for (const item of res.items) {
      if (item.sku) map[item.sku] = item.id;
    }
    return map;
  }

  private async createDraftItem(params: {
    businessId: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    sku: string | null;
    subCategoryId: number;
    imageUrls: string[];
  }): Promise<string> {
    const mutation = `
      mutation ($object: items_insert_input!) {
        insert_items_one(object: $object) { id }
      }
    `;
    const res = await this.hasura.executeMutation<{
      insert_items_one: { id: string };
    }>(mutation, {
      object: {
        business_id: params.businessId,
        name: params.name,
        description: params.description || params.name,
        price: params.price,
        currency: params.currency,
        sku: params.sku,
        item_sub_category_id: params.subCategoryId,
        status: 'active',
        moderation_status: 'draft',
        item_images: {
          data: params.imageUrls.slice(0, 10).map((url, index) => ({
            image_url: url,
            display_order: index,
            is_primary: index === 0,
            business_id: params.businessId,
          })),
        },
      },
    });
    return res.insert_items_one.id;
  }

  private async createVariant(params: {
    itemId: string;
    name: string;
    sku: string | null;
    price: number | null;
    isDefault: boolean;
    imageUrl?: string;
  }): Promise<string> {
    const mutation = `
      mutation ($object: item_variants_insert_input!) {
        insert_item_variants_one(object: $object) { id }
      }
    `;
    const res = await this.hasura.executeMutation<{
      insert_item_variants_one: { id: string };
    }>(mutation, {
      object: {
        item_id: params.itemId,
        name: params.name,
        sku: params.sku,
        price: params.price,
        is_default: params.isDefault,
        is_active: true,
        item_variant_images: params.imageUrl
          ? {
              data: [
                {
                  image_url: params.imageUrl,
                  is_primary: true,
                  display_order: 0,
                },
              ],
            }
          : undefined,
      },
    });
    return res.insert_item_variants_one.id;
  }

  private async upsertInventoryRow(params: {
    businessLocationId: string;
    itemId: string;
    itemVariantId: string;
    quantity: number;
    sellingPrice: number;
  }): Promise<void> {
    const existingId = await this.findInventoryId(
      params.businessLocationId,
      params.itemId,
      params.itemVariantId
    );
    if (existingId) {
      await this.hasura.executeMutation(
        `
        mutation ($id: uuid!, $quantity: Int!, $sellingPrice: numeric!) {
          update_business_inventory_by_pk(
            pk_columns: { id: $id }
            _set: { quantity: $quantity, selling_price: $sellingPrice, is_active: true }
          ) { id }
        }
      `,
        {
          id: existingId,
          quantity: params.quantity,
          sellingPrice: params.sellingPrice,
        }
      );
      return;
    }
    await this.hasura.executeMutation(
      `
      mutation ($object: business_inventory_insert_input!) {
        insert_business_inventory_one(object: $object) { id }
      }
    `,
      {
        object: {
          business_location_id: params.businessLocationId,
          item_id: params.itemId,
          item_variant_id: params.itemVariantId,
          quantity: params.quantity,
          reserved_quantity: 0,
          selling_price: params.sellingPrice,
          is_active: true,
        },
      }
    );
  }

  private async findInventoryId(
    businessLocationId: string,
    itemId: string,
    itemVariantId: string
  ): Promise<string> {
    const q = `
      query ($locationId: uuid!, $itemId: uuid!, $variantId: uuid!) {
        business_inventory(
          where: {
            business_location_id: { _eq: $locationId }
            item_id: { _eq: $itemId }
            item_variant_id: { _eq: $variantId }
          }
          limit: 1
        ) { id }
      }
    `;
    const res = await this.hasura.executeQuery<{
      business_inventory: Array<{ id: string }>;
    }>(q, {
      locationId: businessLocationId,
      itemId,
      variantId: itemVariantId,
    });
    return res.business_inventory[0]?.id ?? '';
  }
}

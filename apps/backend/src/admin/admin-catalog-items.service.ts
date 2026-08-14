import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { BusinessItemsService } from '../business-items/business-items.service';
import { UpdateItemDto } from '../business-items/dto/update-item.dto';
import {
  ADMIN_CATALOG_ITEM_BY_PK,
  ADMIN_CATALOG_ITEMS_LIST,
} from './admin-catalog-items.queries';
import {
  buildAdminCatalogItemsWhere,
  resolveCatalogImageUrl,
} from './admin-catalog-items.util';
import type { AdminCatalogItemsQueryDto } from './dto/admin-catalog-items-query.dto';

interface CatalogImageRow {
  id: string;
  image_url: string | null;
  rembg_image_url?: string | null;
  enhanced_image_url?: string | null;
  active_version?: string | null;
  display_order?: number | null;
  is_ai_cleaned?: boolean | null;
  is_rembg_cleaned?: boolean | null;
}

interface CatalogItemRow {
  id: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  price?: number | null;
  currency?: string | null;
  is_active?: boolean | null;
  moderation_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  business?: { id: string; name: string } | null;
  item_images?: CatalogImageRow[];
  [key: string]: unknown;
}

@Injectable()
export class AdminCatalogItemsService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly businessItemsService: BusinessItemsService
  ) {}

  async list(query: AdminCatalogItemsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const offset = (page - 1) * limit;
    const where = buildAdminCatalogItemsWhere({
      q: query.q,
      businessId: query.businessId,
      from: query.from,
      to: query.to,
      moderationStatus: query.moderationStatus,
      isActive: query.isActive,
    });
    const result = await this.hasuraSystemService.executeQuery<{
      items: CatalogItemRow[];
      items_aggregate: { aggregate: { count: number } | null };
    }>(ADMIN_CATALOG_ITEMS_LIST, { where, limit, offset });
    const total = result?.items_aggregate?.aggregate?.count ?? 0;
    const items = (result?.items ?? []).map((row) => this.toListItem(row));
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getById(itemId: string) {
    const result = await this.hasuraSystemService.executeQuery<{
      items_by_pk: CatalogItemRow | null;
    }>(ADMIN_CATALOG_ITEM_BY_PK, { id: itemId });
    const row = result?.items_by_pk;
    if (!row || row.status !== 'active') {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return this.toDetailItem(row);
  }

  async update(itemId: string, body: UpdateItemDto) {
    await this.businessItemsService.adminUpdateItem(itemId, body);
    return this.getById(itemId);
  }

  private toListItem(row: CatalogItemRow) {
    const primary = row.item_images?.[0];
    return {
      id: row.id,
      name: row.name,
      sku: row.sku ?? null,
      price: row.price ?? null,
      currency: row.currency ?? null,
      isActive: row.is_active === true,
      moderationStatus: row.moderation_status ?? null,
      createdAt: row.created_at ?? null,
      business: row.business
        ? { id: row.business.id, name: row.business.name }
        : null,
      thumbnailUrl: primary ? resolveCatalogImageUrl(primary) : null,
    };
  }

  private toDetailItem(row: CatalogItemRow) {
    const images = (row.item_images ?? []).map((img) => ({
      id: img.id,
      imageUrl: resolveCatalogImageUrl(img),
      originalUrl: img.image_url,
      rembgUrl: img.rembg_image_url ?? null,
      enhancedUrl: img.enhanced_image_url ?? null,
      activeVersion: img.active_version ?? 'original',
      displayOrder: img.display_order ?? 0,
      isAiCleaned: img.is_ai_cleaned === true,
      isRembgCleaned: img.is_rembg_cleaned === true,
    }));
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      sku: row.sku ?? null,
      price: row.price ?? null,
      currency: row.currency ?? null,
      isActive: row.is_active === true,
      moderationStatus: row.moderation_status ?? null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      weight: row.weight ?? null,
      weightUnit: row.weight_unit ?? null,
      dimensions: row.dimensions ?? null,
      model: row.model ?? null,
      color: row.color ?? null,
      brandId: row.brand_id ?? null,
      itemSubCategoryId: row.item_sub_category_id ?? null,
      isFragile: row.is_fragile === true,
      isPerishable: row.is_perishable === true,
      isUsed: row.is_used === true,
      requiresSpecialHandling: row.requires_special_handling === true,
      minOrderQuantity: row.min_order_quantity ?? null,
      maxOrderQuantity: row.max_order_quantity ?? null,
      payOnDeliveryEnabled: row.pay_on_delivery_enabled === true,
      payAtPickupEnabled: row.pay_at_pickup_enabled === true,
      business: row.business
        ? { id: row.business.id, name: row.business.name }
        : null,
      brand: row.brand ?? null,
      itemSubCategory: row.item_sub_category ?? null,
      images,
    };
  }
}

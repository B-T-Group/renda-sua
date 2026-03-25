import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

export interface BusinessImage {
  id: string;
  business_id: string;
  item_id: string | null;
  item_sub_category_id: number | null;
  image_url: string;
  s3_key: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  format: string | null;
  caption: string | null;
  alt_text: string | null;
  tags: string[];
  status: string;
  is_ai_cleaned: boolean;
  created_at: string;
  item?: { id: string; name: string; sku: string | null } | null;
}

export interface PaginatedBusinessImages {
  images: BusinessImage[];
  total: number;
}

export interface CreateBusinessImageInput {
  image_url: string;
  s3_key?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  caption?: string | null;
  alt_text?: string | null;
}

export interface UpdateBusinessImageInput {
  item_sub_category_id?: number | null;
  image_url?: string;
  s3_key?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  caption?: string | null;
  alt_text?: string | null;
  tags?: string[];
  status?: string;
  is_ai_cleaned?: boolean;
}

const LIBRARY_IMAGE_FIELDS = `
  id
  business_id
  item_id
  item_sub_category_id
  image_url
  s3_key
  file_size
  width
  height
  format
  caption
  alt_text
  tags
  status
  is_ai_cleaned
  created_at
  item {
    id
    name
    sku
  }
`;

const GET_ITEM_IMAGES_PAGE = `
  query GetItemImagesPage(
    $where: item_images_bool_exp!,
    $limit: Int!,
    $offset: Int!
  ) {
    item_images(
      where: $where,
      order_by: { created_at: desc },
      limit: $limit,
      offset: $offset
    ) {
      ${LIBRARY_IMAGE_FIELDS}
    }
    item_images_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`;

const GET_ITEM_IMAGES_PAGE_DATA = `
  query GetItemImagesPageData(
    $where: item_images_bool_exp!,
    $limit: Int!,
    $offset: Int!
  ) {
    item_images(
      where: $where,
      order_by: { created_at: desc },
      limit: $limit,
      offset: $offset
    ) {
      ${LIBRARY_IMAGE_FIELDS}
    }
  }
`;

const INSERT_ITEM_IMAGES = `
  mutation InsertItemImagesLib($objects: [item_images_insert_input!]!) {
    insert_item_images(objects: $objects) {
      affected_rows
      returning {
        id
      }
    }
  }
`;

const UPDATE_ITEM_IMAGE = `
  mutation UpdateItemImageLib(
    $id: uuid!,
    $changes: item_images_set_input!
  ) {
    update_item_images_by_pk(
      pk_columns: { id: $id },
      _set: $changes
    ) {
      ${LIBRARY_IMAGE_FIELDS}
    }
  }
`;

const DELETE_ITEM_IMAGE = `
  mutation DeleteItemImageLib($id: uuid!) {
    delete_item_images_by_pk(id: $id) {
      id
    }
  }
`;

const SEARCH_ITEMS_BY_NAME_OR_SKU = `
  query SearchItemsByNameOrSku(
    $businessId: uuid!,
    $search: String!,
    $limit: Int!
  ) {
    items(
      where: {
        business_id: { _eq: $businessId },
        _or: [
          { name: { _ilike: $search } },
          { sku: { _ilike: $search } }
        ]
      },
      limit: $limit,
      order_by: { name: asc }
    ) {
      id
      name
      sku
    }
  }
`;

const GET_ITEM_BUSINESS = `
  query ItemBusinessForImage($id: uuid!) {
    items_by_pk(id: $id) {
      id
      business_id
    }
  }
`;

const NEXT_DISPLAY_ORDER = `
  query NextItemImageDisplayOrder($itemId: uuid!) {
    item_images_aggregate(where: { item_id: { _eq: $itemId } }) {
      aggregate {
        max {
          display_order
        }
      }
    }
  }
`;

@Injectable()
export class BusinessImagesService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  async getBusinessImages(
    businessId: string,
    options: {
      page: number;
      pageSize: number;
      subCategoryId?: number;
      status?: string;
      search?: string;
    }
  ): Promise<PaginatedBusinessImages> {
    const where: Record<string, unknown> = { business_id: { _eq: businessId } };
    if (options.subCategoryId != null) {
      (where as any).item_sub_category_id = { _eq: options.subCategoryId };
    }
    if (options.status) {
      (where as any).status = { _eq: options.status };
    }
    const search = options.search?.trim();
    if (search) {
      const term = `%${search}%`;
      const orConditions: Record<string, unknown>[] = [
        { caption: { _ilike: term } },
        { alt_text: { _ilike: term } },
        { image_url: { _ilike: term } },
        { s3_key: { _ilike: term } },
      ];
      orConditions.push({ tags: { _contains: [search] } });
      (where as any)._or = orConditions;
    }
    const limit = options.pageSize;
    const offset = (options.page - 1) * options.pageSize;
    try {
      const result = await this.hasuraSystemService.executeQuery<{
        item_images: BusinessImage[];
        item_images_aggregate: { aggregate: { count: number } };
      }>(GET_ITEM_IMAGES_PAGE, { where, limit, offset });
      const images = result.item_images ?? [];
      const total = result.item_images_aggregate?.aggregate?.count ?? 0;
      return { images, total };
    } catch (error: any) {
      if (this.isAggregateMissingError(error)) {
        const data = await this.hasuraSystemService.executeQuery<{
          item_images: BusinessImage[];
        }>(GET_ITEM_IMAGES_PAGE_DATA, { where, limit, offset });
        const images = data.item_images ?? [];
        return { images, total: images.length };
      }
      throw error;
    }
  }

  async bulkCreateBusinessImages(
    businessId: string,
    subCategoryId: number | null,
    images: CreateBusinessImageInput[]
  ): Promise<{ id: string }[]> {
    if (!images.length) {
      return [];
    }
    const objects = images.map((img) => ({
      business_id: businessId,
      item_id: null,
      item_sub_category_id: subCategoryId,
      image_url: img.image_url,
      s3_key: img.s3_key ?? null,
      file_size: img.file_size ?? null,
      width: img.width ?? null,
      height: img.height ?? null,
      format: img.format ?? null,
      caption: img.caption ?? null,
      alt_text: img.alt_text ?? null,
      tags: [],
      status: 'unassigned',
      image_type: 'gallery',
      display_order: 0,
      is_active: true,
    }));
    const row = await this.hasuraUserService.executeMutation<{
      insert_item_images: { returning: { id: string }[] };
    }>(INSERT_ITEM_IMAGES, {
      objects,
    });
    return row?.insert_item_images?.returning ?? [];
  }

  async associateImageToItem(
    businessId: string,
    imageId: string,
    itemId: string
  ): Promise<void> {
    await this.ensureItemOwnedByBusiness(businessId, itemId);
    const image = await this.fetchImageForBusiness(businessId, imageId);
    if (image.item_id && image.item_id !== itemId) {
      throw new HttpException(
        { success: false, error: 'Image is already linked to another item' },
        HttpStatus.BAD_REQUEST
      );
    }
    const displayOrder = await this.nextDisplayOrderForItem(itemId);
    await this.applyImageUpdate(businessId, imageId, {
      item_id: itemId,
      status: 'assigned',
      display_order: displayOrder,
    });
  }

  async disassociateImageFromItem(
    businessId: string,
    imageId: string
  ): Promise<void> {
    await this.fetchImageForBusiness(businessId, imageId);
    await this.applyImageUpdate(businessId, imageId, {
      item_id: null,
      status: 'unassigned',
    });
  }

  async linkLibraryImageToNewItem(
    businessId: string,
    imageId: string,
    itemId: string
  ): Promise<void> {
    await this.ensureItemOwnedByBusiness(businessId, itemId);
    const image = await this.fetchImageForBusiness(businessId, imageId);
    if (image.item_id) {
      throw new HttpException(
        { success: false, error: 'Image is already linked to an item' },
        HttpStatus.BAD_REQUEST
      );
    }
    const displayOrder = await this.nextDisplayOrderForItem(itemId);
    await this.applyImageUpdate(businessId, imageId, {
      item_id: itemId,
      status: 'assigned',
      display_order: displayOrder,
    });
  }

  async storeBarcodeValuesOnImage(
    businessId: string,
    imageId: string,
    barcodeValues: string[]
  ): Promise<void> {
    const values = (barcodeValues || [])
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    if (!values.length) {
      return;
    }
    const current = await this.fetchImageForBusiness(businessId, imageId);
    const existingTags = current.tags ?? [];
    const toAdd = values.map((v) => `barcode:${v}`);
    const merged = [...existingTags];
    toAdd.forEach((tag) => {
      if (!merged.includes(tag)) {
        merged.push(tag);
      }
    });
    await this.updateBusinessImage(businessId, imageId, { tags: merged });
  }

  async removeTagFromImage(
    businessId: string,
    imageId: string,
    tag: string
  ): Promise<void> {
    const current = await this.fetchImageForBusiness(businessId, imageId);
    const newTags = (current.tags ?? []).filter((t) => t !== tag);
    const status = current.item_id ? 'assigned' : 'unassigned';
    await this.applyImageUpdate(businessId, imageId, {
      tags: newTags,
      status,
    });
  }

  async deleteBusinessImage(businessId: string, imageId: string): Promise<void> {
    await this.ensureImageBelongsToBusiness(businessId, imageId);
    const result = await this.hasuraUserService.executeMutation<{
      delete_item_images_by_pk: { id: string } | null;
    }>(DELETE_ITEM_IMAGE, { id: imageId });
    if (!result.delete_item_images_by_pk) {
      throw new HttpException(
        { success: false, error: 'Image not found or could not be deleted' },
        HttpStatus.NOT_FOUND
      );
    }
  }

  async updateBusinessImage(
    businessId: string,
    imageId: string,
    changes: UpdateBusinessImageInput
  ): Promise<BusinessImage> {
    const current = await this.fetchImageForBusiness(businessId, imageId);
    const cleanedChanges = this.removeUndefinedKeys(
      changes as Record<string, unknown>
    );
    if (cleanedChanges.is_ai_cleaned === true) {
      const aiCleanedTag = 'ai-cleaned';
      const existingTags = current.tags ?? [];
      if (!existingTags.includes(aiCleanedTag)) {
        cleanedChanges.tags = [...existingTags, aiCleanedTag];
      }
    }
    if (!Object.keys(cleanedChanges).length) {
      return current;
    }
    return this.applyImageUpdate(businessId, imageId, cleanedChanges);
  }

  async searchItems(
    businessId: string,
    query: string,
    limit = 10
  ): Promise<{ id: string; name: string; sku: string | null }[]> {
    const term = `%${query.trim()}%`;
    if (!query.trim()) {
      return [];
    }
    const result = await this.hasuraUserService.executeQuery<{
      items: { id: string; name: string; sku: string | null }[];
    }>(SEARCH_ITEMS_BY_NAME_OR_SKU, {
      businessId,
      search: term,
      limit,
    });
    return result.items ?? [];
  }

  async getImageForBusiness(
    businessId: string,
    imageId: string
  ): Promise<BusinessImage> {
    return this.fetchImageForBusiness(businessId, imageId);
  }

  private async applyImageUpdate(
    businessId: string,
    imageId: string,
    changes: Record<string, unknown>
  ): Promise<BusinessImage> {
    await this.ensureImageBelongsToBusiness(businessId, imageId);
    const result = await this.hasuraUserService.executeMutation<{
      update_item_images_by_pk: BusinessImage | null;
    }>(UPDATE_ITEM_IMAGE, {
      id: imageId,
      changes,
    });
    const updated = result.update_item_images_by_pk;
    if (!updated) {
      throw new HttpException(
        { success: false, error: 'Image not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return updated;
  }

  private async nextDisplayOrderForItem(itemId: string): Promise<number> {
    const result = await this.hasuraSystemService.executeQuery<{
      item_images_aggregate: {
        aggregate: { max: { display_order: number | null } | null } | null;
      };
    }>(NEXT_DISPLAY_ORDER, { itemId });
    const max =
      result.item_images_aggregate?.aggregate?.max?.display_order ?? -1;
    return max + 1;
  }

  private async ensureItemOwnedByBusiness(
    businessId: string,
    itemId: string
  ): Promise<void> {
    const row = await this.hasuraUserService.executeQuery<{
      items_by_pk: { id: string; business_id: string } | null;
    }>(GET_ITEM_BUSINESS, { id: itemId });
    const item = row?.items_by_pk;
    if (!item || item.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Item not found or access denied' },
        HttpStatus.NOT_FOUND
      );
    }
  }

  private async fetchImageForBusiness(
    businessId: string,
    imageId: string
  ): Promise<BusinessImage> {
    const query = `
      query GetItemImageLibById($id: uuid!, $businessId: uuid!) {
        item_images(
          where: {
            id: { _eq: $id },
            business_id: { _eq: $businessId }
          },
          limit: 1
        ) {
          ${LIBRARY_IMAGE_FIELDS}
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      item_images: BusinessImage[];
    }>(query, { id: imageId, businessId });
    const image = result.item_images?.[0];
    if (!image) {
      throw new HttpException(
        { success: false, error: 'Image not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return image;
  }

  private async ensureImageBelongsToBusiness(
    businessId: string,
    imageId: string
  ): Promise<void> {
    await this.fetchImageForBusiness(businessId, imageId);
  }

  private isAggregateMissingError(error: any): boolean {
    const msg = String(error?.message || '');
    if (msg.includes('item_images_aggregate')) {
      return true;
    }
    return Boolean(
      error?.response?.errors?.some?.((e: any) =>
        String(e?.message || '').includes('item_images_aggregate')
      )
    );
  }

  private removeUndefinedKeys(
    input: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined) {
        result[key] = value;
      }
    });
    return result;
  }
}

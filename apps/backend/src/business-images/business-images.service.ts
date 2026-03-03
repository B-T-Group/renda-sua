import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

export interface BusinessImage {
  id: string;
  business_id: string;
  sub_category_id: number | null;
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
  created_at: string;
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
  sub_category_id?: number | null;
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
}

const GET_BUSINESS_IMAGES = `
  query GetBusinessImages(
    $where: business_images_bool_exp!,
    $limit: Int!,
    $offset: Int!
  ) {
    business_images(
      where: $where,
      order_by: { created_at: desc },
      limit: $limit,
      offset: $offset
    ) {
      id
      business_id
      sub_category_id
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
      created_at
    }
    business_images_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`;

/** Data-only query when business_images_aggregate is not yet exposed (table not tracked in Hasura). */
const GET_BUSINESS_IMAGES_DATA_ONLY = `
  query GetBusinessImagesDataOnly(
    $where: business_images_bool_exp!,
    $limit: Int!,
    $offset: Int!
  ) {
    business_images(
      where: $where,
      order_by: { created_at: desc },
      limit: $limit,
      offset: $offset
    ) {
      id
      business_id
      sub_category_id
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
      created_at
    }
  }
`;

const INSERT_BUSINESS_IMAGES = `
  mutation InsertBusinessImages($objects: [business_images_insert_input!]!) {
    insert_business_images(objects: $objects) {
      affected_rows
      returning {
        id
      }
    }
  }
`;

const UPDATE_BUSINESS_IMAGE_TAGS = `
  mutation UpdateBusinessImageTags(
    $id: uuid!,
    $tags: [String!]!,
    $status: business_image_status_enum!
  ) {
    update_business_images_by_pk(
      pk_columns: { id: $id },
      _set: { tags: $tags, status: $status }
    ) {
      id
      tags
      status
    }
  }
`;

const UPDATE_BUSINESS_IMAGE = `
  mutation UpdateBusinessImage(
    $id: uuid!,
    $changes: business_images_set_input!
  ) {
    update_business_images_by_pk(
      pk_columns: { id: $id },
      _set: $changes
    ) {
      id
      business_id
      sub_category_id
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
      created_at
    }
  }
`;

const DELETE_BUSINESS_IMAGE = `
  mutation DeleteBusinessImage($id: uuid!) {
    delete_business_images_by_pk(id: $id) {
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

@Injectable()
export class BusinessImagesService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  async getBusinessImages(
    businessId: string,
    options: { page: number; pageSize: number; subCategoryId?: number; status?: string }
  ): Promise<PaginatedBusinessImages> {
    const where: Record<string, unknown> = { business_id: { _eq: businessId } };
    if (options.subCategoryId != null) {
      (where as any).sub_category_id = { _eq: options.subCategoryId };
    }
    if (options.status) {
      (where as any).status = { _eq: options.status };
    }
    const limit = options.pageSize;
    const offset = (options.page - 1) * options.pageSize;
    try {
      const result = await this.hasuraSystemService.executeQuery<{
        business_images: BusinessImage[];
        business_images_aggregate: { aggregate: { count: number } };
      }>(GET_BUSINESS_IMAGES, { where, limit, offset });
      const images = result.business_images ?? [];
      const total = result.business_images_aggregate?.aggregate?.count ?? 0;
      return { images, total };
    } catch (error: any) {
      const isAggregateMissing =
        error?.message?.includes('business_images_aggregate') ||
        error?.response?.errors?.some?.((e: any) =>
          String(e?.message || '').includes('business_images_aggregate')
        );
      if (isAggregateMissing) {
        const dataResult = await this.hasuraSystemService.executeQuery<{
          business_images: BusinessImage[];
        }>(GET_BUSINESS_IMAGES_DATA_ONLY, { where, limit, offset });
        const images = dataResult.business_images ?? [];
        return { images, total: images.length };
      }
      throw error;
    }
  }

  async bulkCreateBusinessImages(
    businessId: string,
    subCategoryId: number | null,
    images: CreateBusinessImageInput[]
  ): Promise<void> {
    if (!images.length) {
      return;
    }
    const objects = images.map((img) => ({
      business_id: businessId,
      sub_category_id: subCategoryId,
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
    }));
    await this.hasuraUserService.executeMutation(INSERT_BUSINESS_IMAGES, {
      objects,
    });
  }

  async associateImageToItem(
    businessId: string,
    imageId: string,
    sku: string
  ): Promise<void> {
    const normalizedSku = sku.trim().toLowerCase();
    if (!normalizedSku) {
      throw new HttpException(
        { success: false, error: 'SKU is required' },
        HttpStatus.BAD_REQUEST
      );
    }
    const skuTag = `sku:${normalizedSku}`;
    const current = await this.fetchImageForBusiness(businessId, imageId);
    const existingTags = current.tags ?? [];
    const tags = existingTags.includes(skuTag)
      ? existingTags
      : [...existingTags, skuTag];
    await this.hasuraUserService.executeMutation(UPDATE_BUSINESS_IMAGE_TAGS, {
      id: imageId,
      tags,
      status: 'assigned',
    });
  }

  async removeTagFromImage(
    businessId: string,
    imageId: string,
    tag: string
  ): Promise<void> {
    const current = await this.fetchImageForBusiness(businessId, imageId);
    const existingTags = current.tags ?? [];
    const newTags = existingTags.filter((t) => t !== tag);
    const hasSkuTags = newTags.some((t) => t.startsWith('sku:'));
    const status = hasSkuTags ? 'assigned' : 'unassigned';
    await this.hasuraUserService.executeMutation(UPDATE_BUSINESS_IMAGE_TAGS, {
      id: imageId,
      tags: newTags,
      status,
    });
  }

  async deleteBusinessImage(businessId: string, imageId: string): Promise<void> {
    await this.ensureImageBelongsToBusiness(businessId, imageId);
    const result = await this.hasuraUserService.executeMutation<{
      delete_business_images_by_pk: { id: string } | null;
    }>(DELETE_BUSINESS_IMAGE, { id: imageId });
    if (!result.delete_business_images_by_pk) {
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
    await this.ensureImageBelongsToBusiness(businessId, imageId);
    const cleanedChanges = this.removeUndefinedKeys(
      changes as Record<string, unknown>
    );
    if (!Object.keys(cleanedChanges).length) {
      const current = await this.fetchImageForBusiness(businessId, imageId);
      return current;
    }
    const result = await this.hasuraUserService.executeMutation<{
      update_business_images_by_pk: BusinessImage | null;
    }>(UPDATE_BUSINESS_IMAGE, {
      id: imageId,
      changes: cleanedChanges,
    });
    const updated = result.update_business_images_by_pk;
    if (!updated) {
      throw new HttpException(
        { success: false, error: 'Image not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return updated;
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

  private async fetchImageForBusiness(
    businessId: string,
    imageId: string
  ): Promise<BusinessImage> {
    const query = `
      query GetBusinessImageById($id: uuid!, $businessId: uuid!) {
        business_images(
          where: {
            id: { _eq: $id },
            business_id: { _eq: $businessId }
          },
          limit: 1
        ) {
          id
          business_id
          sub_category_id
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
          created_at
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      business_images: BusinessImage[];
    }>(query, { id: imageId, businessId });
    const image = result.business_images?.[0];
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

  private removeUndefinedKeys<T extends Record<string, unknown>>(
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


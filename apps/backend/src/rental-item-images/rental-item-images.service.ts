import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { CreateRentalFromImageDto } from './dto/create-rental-from-image.dto';

export interface RentalFromImageSuggestionsResponse {
  name?: string;
  description?: string;
  rental_category_id: string | null;
  rentalCategorySuggestion?: string;
  suggested_tags: string[];
  currency: string;
}

interface RentalCreateFields {
  name: string;
  rental_category_id: string;
  description: string;
  currency: string;
  is_active: boolean;
  tags: string[];
}

export interface RentalItemImage {
  id: string;
  business_id: string;
  rental_item_id: string | null;
  rental_category_id: string | null;
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
  display_order: number;
  created_at: string;
  rental_item?: { id: string; name: string } | null;
}

export interface CreateRentalItemImageInput {
  image_url: string;
  s3_key?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  caption?: string | null;
  alt_text?: string | null;
}

export interface UpdateRentalItemImageInput {
  rental_item_id?: string | null;
  rental_category_id?: string | null;
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
  display_order?: number;
}

const RENTAL_ITEM_IMAGE_FIELDS = `
  id
  business_id
  rental_item_id
  rental_category_id
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
  display_order
  created_at
  rental_item {
    id
    name
  }
`;

const GET_RENTAL_ITEM_IMAGES = `
  query GetRentalItemImages(
    $where: rental_item_images_bool_exp!,
    $limit: Int!,
    $offset: Int!
  ) {
    rental_item_images(
      where: $where,
      order_by: { created_at: desc },
      limit: $limit,
      offset: $offset
    ) {
      ${RENTAL_ITEM_IMAGE_FIELDS}
    }
    rental_item_images_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`;

const GET_RENTAL_ITEM_IMAGES_DATA_ONLY = `
  query GetRentalItemImagesDataOnly(
    $where: rental_item_images_bool_exp!,
    $limit: Int!,
    $offset: Int!
  ) {
    rental_item_images(
      where: $where,
      order_by: { created_at: desc },
      limit: $limit,
      offset: $offset
    ) {
      ${RENTAL_ITEM_IMAGE_FIELDS}
    }
  }
`;

const INSERT_RENTAL_ITEM_IMAGES = `
  mutation InsertRentalItemImages($objects: [rental_item_images_insert_input!]!) {
    insert_rental_item_images(objects: $objects) {
      affected_rows
    }
  }
`;

const UPDATE_RENTAL_ITEM_IMAGE = `
  mutation UpdateRentalItemImage(
    $id: uuid!,
    $changes: rental_item_images_set_input!
  ) {
    update_rental_item_images_by_pk(
      pk_columns: { id: $id },
      _set: $changes
    ) {
      ${RENTAL_ITEM_IMAGE_FIELDS}
    }
  }
`;

const DELETE_RENTAL_ITEM_IMAGE = `
  mutation DeleteRentalItemImage($id: uuid!) {
    delete_rental_item_images_by_pk(id: $id) {
      id
    }
  }
`;

const INSERT_RENTAL_ITEM = `
  mutation InsertRentalItemFromImage($object: rental_items_insert_input!) {
    insert_rental_items_one(object: $object) {
      id
      name
    }
  }
`;

const SEARCH_RENTAL_ITEMS = `
  query SearchRentalItemsByName(
    $businessId: uuid!,
    $search: String!,
    $limit: Int!
  ) {
    rental_items(
      where: {
        business_id: { _eq: $businessId },
        name: { _ilike: $search }
      },
      limit: $limit,
      order_by: { name: asc }
    ) {
      id
      name
    }
  }
`;

const GET_RENTAL_ITEM_BUSINESS = `
  query RentalItemBusiness($id: uuid!) {
    rental_items_by_pk(id: $id) {
      id
      business_id
    }
  }
`;

const LIST_ACTIVE_RENTAL_CATEGORIES = `
  query ListActiveRentalCategories {
    rental_categories(
      where: { is_active: { _eq: true } }
      order_by: { display_order: asc }
    ) {
      id
      name
      slug
    }
  }
`;

@Injectable()
export class RentalItemImagesService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly aiService: AiService
  ) {}

  async getRentalItemImages(
    businessId: string,
    options: {
      page: number;
      pageSize: number;
      rentalCategoryId?: string;
      status?: string;
      search?: string;
    }
  ): Promise<{ images: RentalItemImage[]; total: number }> {
    const where = this.buildListWhere(businessId, options);
    const limit = options.pageSize;
    const offset = (options.page - 1) * options.pageSize;
    try {
      const result = await this.hasuraSystemService.executeQuery<{
        rental_item_images: RentalItemImage[];
        rental_item_images_aggregate: { aggregate: { count: number } };
      }>(GET_RENTAL_ITEM_IMAGES, { where, limit, offset });
      const images = result.rental_item_images ?? [];
      const total =
        result.rental_item_images_aggregate?.aggregate?.count ?? 0;
      return { images, total };
    } catch (error: any) {
      if (this.isAggregateMissingError(error)) {
        const data = await this.hasuraSystemService.executeQuery<{
          rental_item_images: RentalItemImage[];
        }>(GET_RENTAL_ITEM_IMAGES_DATA_ONLY, { where, limit, offset });
        const images = data.rental_item_images ?? [];
        return { images, total: images.length };
      }
      throw error;
    }
  }

  async bulkCreate(
    businessId: string,
    rentalCategoryId: string | null,
    images: CreateRentalItemImageInput[]
  ): Promise<void> {
    if (!images.length) return;
    const objects = images.map((img) => ({
      business_id: businessId,
      rental_item_id: null,
      rental_category_id: rentalCategoryId,
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
    await this.hasuraUserService.executeMutation(INSERT_RENTAL_ITEM_IMAGES, {
      objects,
    });
  }

  async associateRentalItem(
    businessId: string,
    imageId: string,
    rentalItemId: string
  ): Promise<void> {
    await this.ensureRentalItemOwnedByBusiness(businessId, rentalItemId);
    const image = await this.fetchImageForBusiness(businessId, imageId);
    if (image.rental_item_id && image.rental_item_id !== rentalItemId) {
      throw new HttpException(
        { success: false, error: 'Image is already linked to another item' },
        HttpStatus.BAD_REQUEST
      );
    }
    await this.applyImageUpdate(businessId, imageId, {
      rental_item_id: rentalItemId,
      status: 'assigned',
    });
  }

  async disassociateRentalItem(
    businessId: string,
    imageId: string
  ): Promise<void> {
    await this.fetchImageForBusiness(businessId, imageId);
    await this.applyImageUpdate(businessId, imageId, {
      rental_item_id: null,
      status: 'unassigned',
    });
  }

  async updateImage(
    businessId: string,
    imageId: string,
    changes: UpdateRentalItemImageInput
  ): Promise<RentalItemImage> {
    const current = await this.fetchImageForBusiness(businessId, imageId);
    const cleaned = this.removeUndefinedKeys(
      changes as Record<string, unknown>
    );
    await this.applyRentalItemLinkSideEffects(businessId, cleaned);
    this.mergeAiCleanedTag(current, cleaned);
    if (!Object.keys(cleaned).length) return current;
    return this.applyImageUpdate(businessId, imageId, cleaned);
  }

  async deleteImage(businessId: string, imageId: string): Promise<void> {
    await this.fetchImageForBusiness(businessId, imageId);
    const result = await this.hasuraUserService.executeMutation<{
      delete_rental_item_images_by_pk: { id: string } | null;
    }>(DELETE_RENTAL_ITEM_IMAGE, { id: imageId });
    if (!result.delete_rental_item_images_by_pk) {
      throw new HttpException(
        { success: false, error: 'Image not found or could not be deleted' },
        HttpStatus.NOT_FOUND
      );
    }
  }

  async searchRentalItems(
    businessId: string,
    query: string,
    limit = 10
  ): Promise<{ id: string; name: string }[]> {
    const q = query.trim();
    if (!q) return [];
    const result = await this.hasuraUserService.executeQuery<{
      rental_items: { id: string; name: string }[];
    }>(SEARCH_RENTAL_ITEMS, {
      businessId,
      search: `%${q}%`,
      limit,
    });
    return result.rental_items ?? [];
  }

  async getRentalFromImageSuggestions(
    businessId: string,
    imageId: string
  ): Promise<RentalFromImageSuggestionsResponse> {
    const image = await this.fetchImageForBusiness(businessId, imageId);
    this.assertImageUnlinked(image);
    const ai = await this.aiService.generateRentalImageSuggestions({
      imageUrl: image.image_url,
      caption: image.caption,
      altText: image.alt_text,
      defaultCurrency: 'XAF',
    });
    const rows = await this.fetchActiveRentalCategories();
    const rental_category_id = this.resolveRentalCategoryId(
      rows,
      ai.rentalCategoryName,
      null
    );
    return {
      name: ai.name,
      description: ai.description,
      rental_category_id,
      rentalCategorySuggestion: ai.rentalCategoryName,
      suggested_tags: this.normalizeRentalTags(ai.suggestedTags),
      currency: ai.currency?.trim() || 'XAF',
    };
  }

  async createRentalFromImage(
    businessId: string,
    dto: CreateRentalFromImageDto
  ): Promise<{ id: string; name: string }> {
    const image = await this.fetchImageForBusiness(businessId, dto.imageId);
    this.assertImageUnlinked(image);
    const mode = dto.mode ?? 'manual';
    const fields =
      mode === 'ai'
        ? await this.buildCreateFieldsFromAi(dto, image)
        : this.buildCreateFieldsManual(dto, image);
    return this.persistRentalItemFromImage(businessId, image, fields);
  }

  async getImageForBusiness(
    businessId: string,
    imageId: string
  ): Promise<RentalItemImage> {
    return this.fetchImageForBusiness(businessId, imageId);
  }

  private assertImageUnlinked(image: RentalItemImage): void {
    if (image.rental_item_id) {
      throw new HttpException(
        {
          success: false,
          error: 'Image is already linked to a rental item',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private buildCreateFieldsManual(
    dto: CreateRentalFromImageDto,
    image: RentalItemImage
  ): RentalCreateFields {
    if (!dto.name?.trim() || !dto.rental_category_id) {
      throw new HttpException(
        {
          success: false,
          error:
            'name and rental_category_id are required when mode is manual',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return {
      name: dto.name.trim(),
      rental_category_id: dto.rental_category_id,
      description: dto.description?.trim() ?? '',
      currency: dto.currency?.trim() || 'XAF',
      is_active: dto.is_active ?? false,
      tags: this.normalizeRentalTags(dto.tags),
    };
  }

  private async buildCreateFieldsFromAi(
    dto: CreateRentalFromImageDto,
    image: RentalItemImage
  ): Promise<RentalCreateFields> {
    const ai = await this.aiService.generateRentalImageSuggestions({
      imageUrl: image.image_url,
      caption: image.caption,
      altText: image.alt_text,
      defaultCurrency: 'XAF',
    });
    const rows = await this.fetchActiveRentalCategories();
    const catId =
      dto.rental_category_id ??
      this.resolveRentalCategoryId(rows, ai.rentalCategoryName);
    if (!catId) {
      throw new HttpException(
        {
          success: false,
          error:
            'Could not map the detected category to a platform rental category. Call rental-from-image-suggestions or pass rental_category_id.',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const name =
      dto.name?.trim() ||
      ai.name?.trim() ||
      image.caption?.trim() ||
      'Rental item';
    const description =
      dto.description?.trim() ?? ai.description?.trim() ?? '';
    const currency =
      dto.currency?.trim() || ai.currency?.trim() || 'XAF';
    const tags = dto.tags?.length
      ? this.normalizeRentalTags(dto.tags)
      : this.normalizeRentalTags(ai.suggestedTags);
    return {
      name,
      rental_category_id: catId,
      description,
      currency,
      is_active: dto.is_active ?? false,
      tags,
    };
  }

  private async persistRentalItemFromImage(
    businessId: string,
    image: RentalItemImage,
    fields: RentalCreateFields
  ): Promise<{ id: string; name: string }> {
    const insertResult = await this.hasuraUserService.executeMutation<{
      insert_rental_items_one: { id: string; name: string } | null;
    }>(INSERT_RENTAL_ITEM, {
      object: {
        business_id: businessId,
        rental_category_id: fields.rental_category_id,
        name: fields.name,
        description: fields.description,
        currency: fields.currency,
        is_active: fields.is_active,
        tags: fields.tags,
        operation_mode: 'business_operated',
      },
    });
    const item = insertResult.insert_rental_items_one;
    if (!item?.id) {
      throw new HttpException(
        { success: false, error: 'Failed to create rental item' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    await this.applyImageUpdate(businessId, image.id, {
      rental_item_id: item.id,
      status: 'assigned',
      rental_category_id: fields.rental_category_id,
    });
    return { id: item.id, name: item.name };
  }

  private async fetchActiveRentalCategories(): Promise<
    { id: string; name: string; slug: string }[]
  > {
    const result = await this.hasuraSystemService.executeQuery<{
      rental_categories: { id: string; name: string; slug: string }[];
    }>(LIST_ACTIVE_RENTAL_CATEGORIES, {});
    return result.rental_categories ?? [];
  }

  private resolveRentalCategoryId(
    rows: { id: string; name: string; slug: string }[],
    aiCategoryName?: string | null,
    fallbackId?: string | null
  ): string | null {
    if (fallbackId && rows.some((r) => r.id === fallbackId)) {
      return fallbackId;
    }
    const raw = aiCategoryName?.trim();
    if (!raw) {
      return null;
    }
    const lower = raw.toLowerCase();
    const exact = rows.find((r) => r.name.toLowerCase() === lower);
    if (exact) {
      return exact.id;
    }
    const slugGuess = lower
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const bySlug = rows.find((r) => r.slug === slugGuess);
    if (bySlug) {
      return bySlug.id;
    }
    return (
      rows.find(
        (r) =>
          r.name.toLowerCase().includes(lower) ||
          lower.includes(r.name.toLowerCase())
      )?.id ?? null
    );
  }

  private normalizeRentalTags(tags?: string[] | null): string[] {
    if (!tags?.length) {
      return [];
    }
    return [
      ...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
    ];
  }

  private buildListWhere(
    businessId: string,
    options: {
      rentalCategoryId?: string;
      status?: string;
      search?: string;
    }
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {
      business_id: { _eq: businessId },
    };
    if (options.rentalCategoryId) {
      where.rental_category_id = { _eq: options.rentalCategoryId };
    }
    if (options.status) {
      where.status = { _eq: options.status };
    }
    const term = options.search?.trim();
    if (term) {
      const like = `%${term}%`;
      (where as any)._or = [
        { caption: { _ilike: like } },
        { alt_text: { _ilike: like } },
        { image_url: { _ilike: like } },
        { s3_key: { _ilike: like } },
        { tags: { _contains: [term] } },
      ];
    }
    return where;
  }

  private isAggregateMissingError(error: any): boolean {
    const msg = String(error?.message || '');
    if (msg.includes('rental_item_images_aggregate')) return true;
    return Boolean(
      error?.response?.errors?.some?.((e: any) =>
        String(e?.message || '').includes('rental_item_images_aggregate')
      )
    );
  }

  private async applyRentalItemLinkSideEffects(
    businessId: string,
    cleaned: Record<string, unknown>
  ): Promise<void> {
    if (!('rental_item_id' in cleaned)) return;
    const rid = cleaned.rental_item_id;
    if (rid) {
      await this.ensureRentalItemOwnedByBusiness(businessId, rid as string);
      cleaned.status = 'assigned';
      return;
    }
    cleaned.status = 'unassigned';
  }

  private mergeAiCleanedTag(
    current: RentalItemImage,
    cleaned: Record<string, unknown>
  ): void {
    if (cleaned.is_ai_cleaned !== true) return;
    const tag = 'ai-cleaned';
    const existing = current.tags ?? [];
    if (!existing.includes(tag)) {
      cleaned.tags = [...existing, tag];
    }
  }

  private removeUndefinedKeys(
    input: Record<string, unknown>
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    Object.entries(input).forEach(([k, v]) => {
      if (v !== undefined) out[k] = v;
    });
    return out;
  }

  private async applyImageUpdate(
    businessId: string,
    imageId: string,
    changes: Record<string, unknown>
  ): Promise<RentalItemImage> {
    const result = await this.hasuraUserService.executeMutation<{
      update_rental_item_images_by_pk: RentalItemImage | null;
    }>(UPDATE_RENTAL_ITEM_IMAGE, { id: imageId, changes });
    const updated = result.update_rental_item_images_by_pk;
    if (!updated) {
      throw new HttpException(
        { success: false, error: 'Image not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return updated;
  }

  private async fetchImageForBusiness(
    businessId: string,
    imageId: string
  ): Promise<RentalItemImage> {
    const query = `
      query GetRentalItemImageById($id: uuid!, $businessId: uuid!) {
        rental_item_images(
          where: {
            id: { _eq: $id },
            business_id: { _eq: $businessId }
          },
          limit: 1
        ) {
          ${RENTAL_ITEM_IMAGE_FIELDS}
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      rental_item_images: RentalItemImage[];
    }>(query, { id: imageId, businessId });
    const image = result.rental_item_images?.[0];
    if (!image) {
      throw new HttpException(
        { success: false, error: 'Image not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return image;
  }

  private async ensureRentalItemOwnedByBusiness(
    businessId: string,
    rentalItemId: string
  ): Promise<void> {
    const result = await this.hasuraSystemService.executeQuery<{
      rental_items_by_pk: { id: string; business_id: string } | null;
    }>(GET_RENTAL_ITEM_BUSINESS, { id: rentalItemId });
    const row = result.rental_items_by_pk;
    if (!row || row.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Rental item not found' },
        HttpStatus.NOT_FOUND
      );
    }
  }
}

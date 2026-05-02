import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { CreateItemVariantDto } from './dto/create-item-variant.dto';
import type { CreateItemVariantImageDto } from './dto/create-item-variant-image.dto';
import type { UpdateItemVariantDto } from './dto/update-item-variant.dto';
import type { UpdateItemVariantImageDto } from './dto/update-item-variant-image.dto';

const VARIANT_FIELDS = `
  id
  item_id
  name
  sku
  price
  weight
  weight_unit
  dimensions
  color
  attributes
  is_default
  is_active
  sort_order
  created_at
  updated_at
  item_variant_images(order_by: { display_order: asc }) {
    id
    image_url
    alt_text
    caption
    display_order
    is_primary
    created_at
    updated_at
  }
`;

@Injectable()
export class ItemVariantsService {
  constructor(private readonly hasuraUserService: HasuraUserService) {}

  async assertItemOwnedByBusiness(
    businessId: string,
    itemId: string
  ): Promise<void> {
    const q = `
      query ItemBusiness($id: uuid!) {
        items_by_pk(id: $id) {
          id
          business_id
        }
      }
    `;
    const res = await this.hasuraUserService.executeQuery<{
      items_by_pk: { id: string; business_id: string } | null;
    }>(q, { id: itemId });
    const row = res?.items_by_pk;
    if (!row || row.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Item not found' },
        HttpStatus.NOT_FOUND
      );
    }
  }

  async listVariantsForItem(
    businessId: string,
    itemId: string
  ): Promise<unknown[]> {
    await this.assertItemOwnedByBusiness(businessId, itemId);
    const q = `
      query ListVariants($itemId: uuid!) {
        item_variants(
          where: { item_id: { _eq: $itemId } }
          order_by: { sort_order: asc }
        ) {
          ${VARIANT_FIELDS}
        }
      }
    `;
    const res = await this.hasuraUserService.executeQuery<{
      item_variants: unknown[];
    }>(q, { itemId });
    return res?.item_variants ?? [];
  }

  private async clearDefaultVariantsForItem(itemId: string): Promise<void> {
    const m = `
      mutation ClearDefaultVariants($itemId: uuid!) {
        update_item_variants(
          where: { item_id: { _eq: $itemId } }
          _set: { is_default: false }
        ) {
          affected_rows
        }
      }
    `;
    await this.hasuraUserService.executeMutation(m, { itemId });
  }

  async createVariant(
    businessId: string,
    itemId: string,
    dto: CreateItemVariantDto
  ): Promise<unknown> {
    await this.assertItemOwnedByBusiness(businessId, itemId);
    if (dto.is_default === true) {
      await this.clearDefaultVariantsForItem(itemId);
    }
    const object: Record<string, unknown> = {
      item_id: itemId,
      name: dto.name,
      ...(dto.sku !== undefined && { sku: dto.sku }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.weight !== undefined && { weight: dto.weight }),
      ...(dto.weight_unit !== undefined && { weight_unit: dto.weight_unit }),
      ...(dto.dimensions !== undefined && { dimensions: dto.dimensions }),
      ...(dto.color !== undefined && { color: dto.color }),
      ...(dto.attributes !== undefined && { attributes: dto.attributes }),
      ...(dto.is_default !== undefined && { is_default: dto.is_default }),
      ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
    };
    const m = `
      mutation InsertVariant($object: item_variants_insert_input!) {
        insert_item_variants_one(object: $object) {
          ${VARIANT_FIELDS}
        }
      }
    `;
    const res = await this.hasuraUserService.executeMutation<{
      insert_item_variants_one: unknown;
    }>(m, { object });
    return res.insert_item_variants_one;
  }

  private async assertVariantOwnedByBusiness(
    businessId: string,
    variantId: string
  ): Promise<{ item_id: string }> {
    const q = `
      query VariantItem($id: uuid!) {
        item_variants_by_pk(id: $id) {
          id
          item_id
          item {
            business_id
          }
        }
      }
    `;
    const res = await this.hasuraUserService.executeQuery<{
      item_variants_by_pk: {
        item_id: string;
        item: { business_id: string };
      } | null;
    }>(q, { id: variantId });
    const row = res?.item_variants_by_pk;
    if (!row || row.item.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Variant not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return { item_id: row.item_id };
  }

  async updateVariant(
    businessId: string,
    variantId: string,
    dto: UpdateItemVariantDto
  ): Promise<unknown> {
    const { item_id: itemId } = await this.assertVariantOwnedByBusiness(
      businessId,
      variantId
    );
    if (dto.is_default === true) {
      await this.clearDefaultVariantsForItem(itemId);
    }
    const _set: Record<string, unknown> = {};
    const keys = Object.keys(dto) as (keyof UpdateItemVariantDto)[];
    for (const k of keys) {
      if (dto[k] !== undefined) {
        _set[k] = dto[k] as unknown;
      }
    }
    if (Object.keys(_set).length === 0) {
      const q = `
        query OneVariant($id: uuid!) {
          item_variants_by_pk(id: $id) {
            ${VARIANT_FIELDS}
          }
        }
      `;
      const r = await this.hasuraUserService.executeQuery<{
        item_variants_by_pk: unknown;
      }>(q, { id: variantId });
      return r.item_variants_by_pk;
    }
    const m = `
      mutation UpdateVariant($id: uuid!, $_set: item_variants_set_input!) {
        update_item_variants_by_pk(pk_columns: { id: $id }, _set: $_set) {
          ${VARIANT_FIELDS}
        }
      }
    `;
    const res = await this.hasuraUserService.executeMutation<{
      update_item_variants_by_pk: unknown;
    }>(m, { id: variantId, _set });
    return res.update_item_variants_by_pk;
  }

  async deleteVariant(businessId: string, variantId: string): Promise<void> {
    await this.assertVariantOwnedByBusiness(businessId, variantId);
    const m = `
      mutation DeleteVariant($id: uuid!) {
        delete_item_variants_by_pk(id: $id) {
          id
        }
      }
    `;
    await this.hasuraUserService.executeMutation(m, { id: variantId });
  }

  async setDefaultVariant(
    businessId: string,
    variantId: string
  ): Promise<unknown> {
    const { item_id: itemId } = await this.assertVariantOwnedByBusiness(
      businessId,
      variantId
    );
    await this.clearDefaultVariantsForItem(itemId);
    return this.updateVariant(businessId, variantId, { is_default: true });
  }

  async addVariantImage(
    businessId: string,
    variantId: string,
    dto: CreateItemVariantImageDto
  ): Promise<unknown> {
    await this.assertVariantOwnedByBusiness(businessId, variantId);
    if (dto.is_primary === true) {
      await this.clearPrimaryImagesForVariant(variantId);
    }
    const object: Record<string, unknown> = {
      item_variant_id: variantId,
      image_url: dto.image_url,
      ...(dto.alt_text !== undefined && { alt_text: dto.alt_text }),
      ...(dto.caption !== undefined && { caption: dto.caption }),
      ...(dto.display_order !== undefined && { display_order: dto.display_order }),
      ...(dto.is_primary !== undefined && { is_primary: dto.is_primary }),
    };
    const m = `
      mutation InsertVariantImage($object: item_variant_images_insert_input!) {
        insert_item_variant_images_one(object: $object) {
          id
          item_variant_id
          image_url
          alt_text
          caption
          display_order
          is_primary
          created_at
          updated_at
        }
      }
    `;
    const res = await this.hasuraUserService.executeMutation<{
      insert_item_variant_images_one: unknown;
    }>(m, { object });
    return res.insert_item_variant_images_one;
  }

  private async clearPrimaryImagesForVariant(
    variantId: string
  ): Promise<void> {
    const m = `
      mutation ClearPrimaryImages($variantId: uuid!) {
        update_item_variant_images(
          where: { item_variant_id: { _eq: $variantId }, is_primary: { _eq: true } }
          _set: { is_primary: false }
        ) {
          affected_rows
        }
      }
    `;
    await this.hasuraUserService.executeMutation(m, { variantId });
  }

  private async assertVariantImageOwnedByBusiness(
    businessId: string,
    imageId: string
  ): Promise<{ item_variant_id: string }> {
    const q = `
      query VariantImage($id: uuid!) {
        item_variant_images_by_pk(id: $id) {
          id
          item_variant_id
          item_variant {
            item {
              business_id
            }
          }
        }
      }
    `;
    const res = await this.hasuraUserService.executeQuery<{
      item_variant_images_by_pk: {
        item_variant_id: string;
        item_variant: { item: { business_id: string } };
      } | null;
    }>(q, { id: imageId });
    const row = res?.item_variant_images_by_pk;
    if (!row || row.item_variant.item.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Image not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return { item_variant_id: row.item_variant_id };
  }

  async updateVariantImage(
    businessId: string,
    imageId: string,
    dto: UpdateItemVariantImageDto
  ): Promise<unknown> {
    const v = await this.assertVariantImageOwnedByBusiness(
      businessId,
      imageId
    );
    if (dto.is_primary === true) {
      await this.clearPrimaryImagesForVariant(v.item_variant_id);
    }
    const _set: Record<string, unknown> = {};
    const keys = Object.keys(dto) as (keyof UpdateItemVariantImageDto)[];
    for (const k of keys) {
      if (dto[k] !== undefined) {
        _set[k] = dto[k] as unknown;
      }
    }
    if (Object.keys(_set).length === 0) {
      const q = `
        query OneImg($id: uuid!) {
          item_variant_images_by_pk(id: $id) {
            id
            item_variant_id
            image_url
            alt_text
            caption
            display_order
            is_primary
            created_at
            updated_at
          }
        }
      `;
      const r = await this.hasuraUserService.executeQuery<{
        item_variant_images_by_pk: unknown;
      }>(q, { id: imageId });
      return r.item_variant_images_by_pk;
    }
    const m = `
      mutation UpdateVariantImage(
        $id: uuid!
        $_set: item_variant_images_set_input!
      ) {
        update_item_variant_images_by_pk(
          pk_columns: { id: $id }
          _set: $_set
        ) {
          id
          item_variant_id
          image_url
          alt_text
          caption
          display_order
          is_primary
          created_at
          updated_at
        }
      }
    `;
    const res = await this.hasuraUserService.executeMutation<{
      update_item_variant_images_by_pk: unknown;
    }>(m, { id: imageId, _set });
    return res.update_item_variant_images_by_pk;
  }

  async deleteVariantImage(
    businessId: string,
    imageId: string
  ): Promise<void> {
    await this.assertVariantImageOwnedByBusiness(businessId, imageId);
    const m = `
      mutation DeleteVariantImage($id: uuid!) {
        delete_item_variant_images_by_pk(id: $id) {
          id
        }
      }
    `;
    await this.hasuraUserService.executeMutation(m, { id: imageId });
  }
}

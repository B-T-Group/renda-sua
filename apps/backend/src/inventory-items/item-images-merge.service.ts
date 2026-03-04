import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface ItemImageShape {
  id: string;
  image_url: string;
  image_type: string;
  alt_text?: string;
  caption?: string;
  display_order: number;
}

interface TaggedBusinessImage {
  id: string;
  business_id: string;
  image_url: string;
  caption: string | null;
  alt_text: string | null;
  tags: string[];
  created_at: string;
}

const GET_TAGGED_BUSINESS_IMAGES = `
  query GetTaggedBusinessImages($businessIds: [uuid!]!) {
    business_images(
      where: {
        business_id: { _in: $businessIds },
        status: { _neq: archived }
      }
    ) {
      id
      business_id
      image_url
      caption
      alt_text
      tags
      created_at
    }
  }
`;

/**
 * Fetches business_images for the given business IDs and builds a map
 * (businessId -> sku -> images[]) from tags of the form "sku:xxx".
 */
@Injectable()
export class ItemImagesMergeService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  /**
   * Returns Map<businessId, Map<sku, images[]>>. Only includes images that have
   * at least one tag starting with "sku:" where the suffix is the item SKU.
   */
  async getTaggedImagesByBusinessAndSku(
    businessIds: string[]
  ): Promise<Map<string, Map<string, TaggedBusinessImage[]>>> {
    if (businessIds.length === 0) {
      return new Map();
    }

    const result =
      await this.hasuraSystemService.executeQuery<{
        business_images: TaggedBusinessImage[];
      }>(GET_TAGGED_BUSINESS_IMAGES, { businessIds });

    const images = result.business_images ?? [];
    const byBusinessAndSku = new Map<
      string,
      Map<string, TaggedBusinessImage[]>
    >();

    for (const img of images) {
      const tags = img.tags ?? [];
      for (const tag of tags) {
        if (!tag.startsWith('sku:')) continue;
        const sku = tag.slice(4).toLowerCase();
        if (!sku) continue;
        const businessId = img.business_id;
        if (!businessId) continue;
        if (!byBusinessAndSku.has(businessId)) {
          byBusinessAndSku.set(
            businessId,
            new Map<string, TaggedBusinessImage[]>()
          );
        }
        const bySku = byBusinessAndSku.get(businessId)!;
        const list = bySku.get(sku) ?? [];
        if (!list.some((i) => i.id === img.id)) {
          list.push(img);
        }
        bySku.set(sku, list);
      }
    }

    return byBusinessAndSku;
  }

  /**
   * Merges tagged business images (first) with DB item_images (second).
   * Prioritizes tagged images. Assigns display_order 0, 1, 2, ...
   */
  mergeItemImages(
    tagged: TaggedBusinessImage[],
    dbImages: ItemImageShape[],
    itemName?: string
  ): ItemImageShape[] {
    const taggedMapped: ItemImageShape[] = tagged.map((img, index) => ({
      id: img.id,
      image_url: img.image_url,
      image_type: 'gallery',
      alt_text: img.alt_text ?? itemName ?? undefined,
      caption: img.caption ?? undefined,
      display_order: index,
    }));
    const baseOrder = taggedMapped.length;
    const dbMapped: ItemImageShape[] = (dbImages ?? []).map((img, index) => ({
      id: img.id,
      image_url: img.image_url,
      image_type: img.image_type,
      alt_text: img.alt_text ?? undefined,
      caption: img.caption ?? undefined,
      display_order: baseOrder + index,
    }));
    return [...taggedMapped, ...dbMapped];
  }
}

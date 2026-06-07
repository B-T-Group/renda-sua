import { Injectable } from '@nestjs/common';
import { bmvbhash } from 'blockhash-core';
import sharp from 'sharp';
import { HasuraUserService } from '../../hasura/hasura-user.service';
import type { ValidatedImage } from '../types/image-validation.types';

const HAMMING_THRESHOLD = 5;

const GET_ITEM_PHASHES = `
  query GetItemPhashes($businessId: uuid!, $itemId: uuid) {
    item_images(
      where: {
        business_id: { _eq: $businessId }
        perceptual_hash: { _is_null: false }
        _and: [
          { item_id: { _eq: $itemId } }
        ]
      }
    ) {
      perceptual_hash
    }
  }
`;

const GET_RENTAL_PHASHES = `
  query GetRentalPhashes($businessId: uuid!, $rentalItemId: uuid) {
    rental_item_images(
      where: {
        business_id: { _eq: $businessId }
        perceptual_hash: { _is_null: false }
        _and: [
          { rental_item_id: { _eq: $rentalItemId } }
        ]
      }
    ) {
      perceptual_hash
    }
  }
`;

const GET_BUSINESS_PHASHES = `
  query GetBusinessPhashes($businessId: uuid!) {
    item_images(
      where: {
        business_id: { _eq: $businessId }
        perceptual_hash: { _is_null: false }
      }
    ) {
      perceptual_hash
    }
    rental_item_images(
      where: {
        business_id: { _eq: $businessId }
        perceptual_hash: { _is_null: false }
      }
    ) {
      perceptual_hash
    }
  }
`;

@Injectable()
export class DuplicateImageDetectorService {
  constructor(private readonly hasuraUserService: HasuraUserService) {}

  async computeHash(image: ValidatedImage): Promise<string> {
    const { data, info } = await sharp(image.buffer)
      .resize(256, 256, { fit: 'cover' })
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    const hash = bmvbhash(
      { width: info.width, height: info.height, data },
      16
    );
    return hash;
  }

  async loadExistingPhashes(
    businessId: string,
    itemId?: string,
    rentalItemId?: string
  ): Promise<string[]> {
    if (rentalItemId) {
      const res = await this.hasuraUserService.executeQuery<{
        rental_item_images: { perceptual_hash: string }[];
      }>(GET_RENTAL_PHASHES, { businessId, rentalItemId });
      return (res?.rental_item_images ?? [])
        .map((r) => r.perceptual_hash)
        .filter(Boolean);
    }
    if (itemId) {
      const res = await this.hasuraUserService.executeQuery<{
        item_images: { perceptual_hash: string }[];
      }>(GET_ITEM_PHASHES, { businessId, itemId });
      return (res?.item_images ?? [])
        .map((r) => r.perceptual_hash)
        .filter(Boolean);
    }
    const res = await this.hasuraUserService.executeQuery<{
      item_images: { perceptual_hash: string }[];
      rental_item_images: { perceptual_hash: string }[];
    }>(GET_BUSINESS_PHASHES, { businessId });
    const itemHashes = (res?.item_images ?? []).map((r) => r.perceptual_hash);
    const rentalHashes = (res?.rental_item_images ?? []).map(
      (r) => r.perceptual_hash
    );
    return [...itemHashes, ...rentalHashes].filter(Boolean);
  }

  isDuplicate(hash: string, existing: string[]): boolean {
    return existing.some(
      (h) => this.hammingDistance(hash, h) <= HAMMING_THRESHOLD
    );
  }

  hammingDistance(a: string, b: string): number {
    if (a.length !== b.length) return Infinity;
    let dist = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) dist++;
    }
    return dist;
  }
}

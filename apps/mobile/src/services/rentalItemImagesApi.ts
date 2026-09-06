import type {
  CreateRentalFromImagePayload,
  RentalFromImageSuggestionData,
} from '../types/rentals';
import { apiRequest } from './apiClient';

export type RentalImageBulkInput = {
  image_url: string;
  s3_key?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  caption?: string | null;
  alt_text?: string | null;
  quality_score?: number | null;
  perceptual_hash?: string | null;
  validation_errors?: unknown[] | null;
  validation_warnings?: unknown[] | null;
  validated_at?: string | null;
};

export async function bulkCreateRentalImages(body: {
  rental_category_id?: string | null;
  images: RentalImageBulkInput[];
}): Promise<{ success: boolean; data?: { images: Array<{ id: string }> } }> {
  return apiRequest('/rental-item-images/bulk', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function associateRentalItem(
  imageId: string,
  rentalItemId: string
): Promise<{ success: boolean }> {
  return apiRequest(
    `/rental-item-images/${encodeURIComponent(imageId)}/associate-rental-item`,
    {
      method: 'POST',
      body: JSON.stringify({ rental_item_id: rentalItemId }),
    }
  );
}

export async function updateRentalImage(
  imageId: string,
  body: {
    display_order?: number;
    image_url?: string;
    s3_key?: string | null;
    file_size?: number | null;
    format?: string | null;
    is_ai_cleaned?: boolean;
    alt_text?: string | null;
  }
): Promise<{ success: boolean }> {
  return apiRequest(`/rental-item-images/${encodeURIComponent(imageId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function createRentalFromImage(
  body: CreateRentalFromImagePayload
): Promise<{
  success: boolean;
  data?: { item: { id: string; name: string } };
  error?: string;
}> {
  return apiRequest('/rental-item-images/create-rental-from-image', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function rentalFromImageSuggestions(
  imageId: string
): Promise<{
  success: boolean;
  data?: RentalFromImageSuggestionData;
  error?: string;
}> {
  return apiRequest('/rental-item-images/rental-from-image-suggestions', {
    method: 'POST',
    body: JSON.stringify({ imageId }),
  });
}

export async function cleanupRentalImage(
  imageId: string,
  body?: { kind?: 'rembg' | 'ai' }
): Promise<{
  success: boolean;
  data?: { jobId: string; job?: { id: string } };
  ai_tokens_remaining?: number;
  error?: string;
}> {
  return apiRequest(`/rental-item-images/${encodeURIComponent(imageId)}/cleanup`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export async function setRentalImageActiveVersion(
  imageId: string,
  version: 'original' | 'rembg' | 'enhanced'
): Promise<{ success: boolean; error?: string }> {
  return apiRequest(
    `/rental-item-images/${encodeURIComponent(imageId)}/active-version`,
    {
      method: 'PATCH',
      body: JSON.stringify({ version }),
    }
  );
}

export const rentalItemImagesApi = {
  bulkCreate: bulkCreateRentalImages,
  associateRentalItem,
  update: updateRentalImage,
  createRentalFromImage,
  rentalFromImageSuggestions,
  cleanup: cleanupRentalImage,
  setActiveVersion: setRentalImageActiveVersion,
};

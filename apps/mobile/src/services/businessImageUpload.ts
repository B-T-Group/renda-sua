/**
 * Upload local images to S3 via presigned URLs, then register in business image library.
 */

import type { ImagePickerAsset } from 'expo-image-picker';
import type { BulkCreateBusinessImageInput } from '../types/business/items';
import {
  isSupportedImageAsset,
  isSupportedImageMime,
} from '../utils/supportedImageFormats';
import { awsApi, buildS3PublicUrl, S3_BUCKET } from './awsApi';
import { businessApi } from './businessApi';

/** Web picker attaches the original `File` (not in published TS types). */
type ImagePickerAssetWithFile = ImagePickerAsset & { file?: File };

function fileNameFromAsset(asset: ImagePickerAsset): string {
  if (asset.fileName?.trim()) return asset.fileName.trim();
  const segment = asset.uri.split('/').pop() ?? 'image.jpg';
  return segment.includes('.') ? segment : `${segment}.jpg`;
}

function mimeFromAsset(asset: ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const lower = asset.uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

function assertSupportedAsset(asset: ImagePickerAsset): void {
  const contentType = mimeFromAsset(asset);
  if (
    !isSupportedImageAsset(asset) ||
    !isSupportedImageMime(contentType)
  ) {
    throw new Error(
      'Unsupported image format. Please use JPEG, PNG, or WebP.'
    );
  }
}

async function readAssetBlob(asset: ImagePickerAsset): Promise<Blob> {
  const webFile = (asset as ImagePickerAssetWithFile).file;
  if (webFile) return webFile;
  const res = await fetch(asset.uri);
  if (!res.ok) {
    throw new Error('Failed to read selected image');
  }
  return res.blob();
}

async function uploadBlobToS3(
  body: Blob,
  businessId: string,
  originalFileName: string,
  contentType: string,
  fileSize?: number
): Promise<BulkCreateBusinessImageInput> {
  const prefix = `businesses/${businessId}/images`;

  const presigned = await awsApi.presignImageUpload({
    bucketName: S3_BUCKET,
    originalFileName,
    contentType,
    prefix,
  });
  if (!presigned.success || !presigned.data?.url || !presigned.data?.key) {
    throw new Error(presigned.error || 'Failed to prepare image upload');
  }

  const putRes = await fetch(presigned.data.url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  if (!putRes.ok) {
    throw new Error('Failed to upload image to storage');
  }

  return {
    image_url: buildS3PublicUrl(presigned.data.key),
    s3_key: presigned.data.key,
    file_size: fileSize ?? body.size,
    format: contentType,
  };
}

async function uploadAssetToS3(
  asset: ImagePickerAsset,
  businessId: string
): Promise<BulkCreateBusinessImageInput> {
  assertSupportedAsset(asset);
  const contentType = mimeFromAsset(asset);
  const originalFileName = fileNameFromAsset(asset);
  const body = await readAssetBlob(asset);
  return uploadBlobToS3(body, businessId, originalFileName, contentType, asset.fileSize ?? body.size);
}

/** Uploads assets through the same presigned S3 pipeline without library association. */
export async function uploadBusinessImageAssets(
  assets: ImagePickerAsset[],
  businessId: string
): Promise<BulkCreateBusinessImageInput[]> {
  const uploaded: BulkCreateBusinessImageInput[] = [];
  for (const asset of assets) {
    uploaded.push(await uploadAssetToS3(asset, businessId));
  }
  return uploaded;
}

export async function uploadBusinessImages(
  assets: ImagePickerAsset[],
  businessId: string,
  metadata?: import('../types/imageValidation').ImageValidationMetadata[]
): Promise<string[]> {
  const uploaded = await uploadBusinessImagesWithMeta(assets, businessId, metadata);
  return uploaded.map((row) => row.id);
}

/** Upload + register; returns library ids with the S3 URLs used (for linking without re-upload). */
export async function uploadBusinessImagesWithMeta(
  assets: ImagePickerAsset[],
  businessId: string,
  metadata?: import('../types/imageValidation').ImageValidationMetadata[]
): Promise<Array<{ id: string; image_url: string }>> {
  if (!assets.length) {
    throw new Error('No images selected');
  }
  const payloads: BulkCreateBusinessImageInput[] = [];
  for (let i = 0; i < assets.length; i++) {
    const uploaded = await uploadAssetToS3(assets[i], businessId);
    payloads.push({ ...uploaded, ...(metadata?.[i] ?? {}) });
  }
  const res = await businessApi.images.bulkCreate({ images: payloads });
  if (!res.success) {
    throw new Error('Failed to register uploaded images');
  }
  const rows = res.data?.images ?? [];
  if (!rows.length || rows.length !== payloads.length) {
    throw new Error('Upload did not return image ids');
  }
  return rows.map((row, index) => ({
    id: row.id,
    image_url: payloads[index].image_url,
  }));
}

/** Upload a single asset and register it; reports progress 0→1 via callback. */
export async function uploadSingleBusinessImage(
  asset: ImagePickerAsset,
  businessId: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  onProgress?.(0.1);
  const uploaded = await uploadAssetToS3(asset, businessId);
  onProgress?.(0.7);
  const res = await businessApi.images.bulkCreate({ images: [uploaded] });
  if (!res.success) {
    throw new Error('Failed to register uploaded image');
  }
  const id = res.data?.images?.[0]?.id;
  if (!id) {
    throw new Error('Upload did not return image id');
  }
  onProgress?.(1);
  return id;
}

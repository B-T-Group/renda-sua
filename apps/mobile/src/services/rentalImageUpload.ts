/**
 * Upload local images to S3, then register in the rental image library.
 */

import type { ImagePickerAsset } from 'expo-image-picker';
import type { ImageValidationMetadata } from '../types/imageValidation';
import {
  isSupportedImageAsset,
  isSupportedImageMime,
} from '../utils/supportedImageFormats';
import { awsApi, buildS3PublicUrl, S3_BUCKET } from './awsApi';
import {
  rentalItemImagesApi,
  type RentalImageBulkInput,
} from './rentalItemImagesApi';

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
  if (!isSupportedImageAsset(asset) || !isSupportedImageMime(contentType)) {
    throw new Error(
      'Unsupported image format. Please use JPEG, PNG, or WebP.'
    );
  }
}

async function readAssetBlob(asset: ImagePickerAsset): Promise<Blob> {
  const webFile = (asset as ImagePickerAssetWithFile).file;
  if (webFile) return webFile;
  const res = await fetch(asset.uri);
  if (!res.ok) throw new Error('Failed to read selected image');
  return res.blob();
}

async function uploadAssetToS3(
  asset: ImagePickerAsset,
  businessId: string
): Promise<RentalImageBulkInput> {
  assertSupportedAsset(asset);
  const contentType = mimeFromAsset(asset);
  const originalFileName = fileNameFromAsset(asset);
  const body = await readAssetBlob(asset);
  const prefix = `businesses/${businessId}/rental-images`;

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
  if (!putRes.ok) throw new Error('Failed to upload image to storage');

  return {
    image_url: buildS3PublicUrl(presigned.data.key),
    s3_key: presigned.data.key,
    file_size: asset.fileSize ?? body.size,
    format: contentType,
  };
}

export async function uploadRentalImages(
  assets: ImagePickerAsset[],
  businessId: string,
  metadata?: ImageValidationMetadata[]
): Promise<string[]> {
  if (!assets.length) throw new Error('No images selected');
  const payloads: RentalImageBulkInput[] = [];
  for (let i = 0; i < assets.length; i++) {
    const uploaded = await uploadAssetToS3(assets[i], businessId);
    payloads.push({ ...uploaded, ...(metadata?.[i] ?? {}) });
  }
  const res = await rentalItemImagesApi.bulkCreate({ images: payloads });
  if (!res.success) throw new Error('Failed to register uploaded images');
  const ids = res.data?.images?.map((r) => r.id).filter(Boolean) ?? [];
  if (!ids.length) throw new Error('Upload did not return image ids');
  return ids;
}

import type { ImagePickerAsset } from 'expo-image-picker';
import {
  isSupportedImageAsset,
  isSupportedImageMime,
} from '../utils/supportedImageFormats';
import { awsApi, buildS3PublicUrl, S3_BUCKET } from './awsApi';

type ImagePickerAssetWithFile = ImagePickerAsset & { file?: File };

function fileNameFromAsset(asset: ImagePickerAsset): string {
  if (asset.fileName?.trim()) return asset.fileName.trim();
  const segment = asset.uri.split('/').pop() ?? 'logo.jpg';
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

async function readAssetBlob(asset: ImagePickerAsset): Promise<Blob> {
  const webFile = (asset as ImagePickerAssetWithFile).file;
  if (webFile) return webFile;
  const res = await fetch(asset.uri);
  if (!res.ok) throw new Error('Failed to read selected image');
  return res.blob();
}

export async function uploadBusinessLocationLogo(
  asset: ImagePickerAsset,
  businessId: string
): Promise<string> {
  const contentType = mimeFromAsset(asset);
  if (!isSupportedImageAsset(asset) || !isSupportedImageMime(contentType)) {
    throw new Error(
      'Unsupported image format. Please use JPEG, PNG, or WebP.'
    );
  }
  const originalFileName = fileNameFromAsset(asset);
  const body = await readAssetBlob(asset);
  const prefix = `businesses/${businessId}/location-logos`;

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
  if (!putRes.ok) throw new Error('Failed to upload logo to storage');

  return buildS3PublicUrl(presigned.data.key);
}

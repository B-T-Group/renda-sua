import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';

export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

const SUPPORTED = new Set<string>(SUPPORTED_IMAGE_MIME_TYPES);

export function isSupportedImageMime(mime: string | undefined | null): boolean {
  if (!mime) return false;
  return SUPPORTED.has(mime.toLowerCase().split(';')[0].trim());
}

function assetProbe(asset: ImagePickerAsset): string {
  return `${asset.fileName ?? ''}|${asset.uri}`.toLowerCase();
}

/**
 * Prefer declared MIME; otherwise infer from file name/URI.
 * Do not treat "missing type" as JPEG — that let HEIC slip through.
 */
export function isSupportedImageAsset(asset: ImagePickerAsset): boolean {
  if (asset.mimeType) {
    return isSupportedImageMime(asset.mimeType);
  }
  const probe = assetProbe(asset);
  if (probe.includes('.heic') || probe.includes('.heif')) return false;
  if (/\.(png|webp|jpe?g)(\?|#|$)/.test(probe)) return true;
  // Compatible iOS exports often omit extension after conversion; allow those.
  return true;
}

export function filterSupportedImageAssets(assets: ImagePickerAsset[]): {
  supported: ImagePickerAsset[];
  rejectedCount: number;
} {
  const supported: ImagePickerAsset[] = [];
  let rejectedCount = 0;
  for (const asset of assets) {
    if (isSupportedImageAsset(asset)) supported.push(asset);
    else rejectedCount += 1;
  }
  return { supported, rejectedCount };
}

/** Prefer JPEG-compatible exports so iOS HEIC photos are converted when possible. */
export const IMAGE_LIBRARY_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  quality: 0.85,
};

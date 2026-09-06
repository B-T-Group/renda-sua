import * as FileSystem from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';

export function mimeFromAsset(asset: ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const lower = asset.uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  // Unknown/HEIC: leave as-is so callers can reject unsupported formats.
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export async function assetToBase64(asset: ImagePickerAsset): Promise<string> {
  if (asset.uri.startsWith('data:')) {
    const comma = asset.uri.indexOf(',');
    return comma >= 0 ? asset.uri.slice(comma + 1) : asset.uri;
  }
  return FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

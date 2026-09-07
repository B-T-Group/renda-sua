import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  IMAGE_LIBRARY_PICKER_OPTIONS,
  isSupportedImageAsset,
  isSupportedImageMime,
} from './supportedImageFormats';

export type PickedUploadFile = {
  uri: string;
  fileName: string;
  contentType: string;
  fileSize: number;
};

export type DocumentPickResult =
  | { ok: true; file: PickedUploadFile }
  | { ok: false; reason: 'canceled' | 'permission_denied' | 'error'; message?: string };

export async function pickDocumentFile(options?: {
  allTypes?: boolean;
}): Promise<DocumentPickResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: options?.allTypes
        ? '*/*'
        : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) {
      return { ok: false, reason: 'canceled' };
    }
    const file = result.assets[0];
    const contentType = file.mimeType ?? 'application/octet-stream';
    if (
      contentType.startsWith('image/') &&
      !isSupportedImageMime(contentType)
    ) {
      return {
        ok: false,
        reason: 'error',
        message: 'Unsupported image format. Please use JPEG, PNG, or WebP.',
      };
    }
    return {
      ok: true,
      file: {
        uri: file.uri,
        fileName: file.name ?? 'document',
        contentType,
        fileSize: file.size ?? 0,
      },
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'error',
      message: e instanceof Error ? e.message : undefined,
    };
  }
}

export async function pickCameraPhoto(): Promise<DocumentPickResult> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      return { ok: false, reason: 'permission_denied' };
    }
    const result = await ImagePicker.launchCameraAsync({
      ...IMAGE_LIBRARY_PICKER_OPTIONS,
    });
    if (result.canceled || !result.assets[0]) {
      return { ok: false, reason: 'canceled' };
    }
    const asset = result.assets[0];
    if (!isSupportedImageAsset(asset)) {
      return {
        ok: false,
        reason: 'error',
        message: 'Unsupported image format. Please use JPEG, PNG, or WebP.',
      };
    }
    const contentType = asset.mimeType ?? 'image/jpeg';
    return {
      ok: true,
      file: {
        uri: asset.uri,
        fileName: `id-photo-${Date.now()}.jpg`,
        contentType,
        fileSize: asset.fileSize ?? 0,
      },
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'error',
      message: e instanceof Error ? e.message : undefined,
    };
  }
}

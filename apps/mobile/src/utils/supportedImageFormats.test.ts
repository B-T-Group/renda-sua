import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-image-picker', () => ({
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));

import {
  filterSupportedImageAssets,
  isSupportedImageAsset,
} from './supportedImageFormats';

function asset(partial: {
  mimeType?: string;
  fileName?: string | null;
  uri?: string;
}) {
  return {
    uri: 'file://photo',
    width: 10,
    height: 10,
    ...partial,
  } as Parameters<typeof isSupportedImageAsset>[0];
}

describe('isSupportedImageAsset', () => {
  it('accepts jpeg, png, and webp', () => {
    expect(isSupportedImageAsset(asset({ mimeType: 'image/jpeg' }))).toBe(true);
    expect(
      isSupportedImageAsset(asset({ mimeType: 'image/png; charset=binary' }))
    ).toBe(true);
    expect(
      isSupportedImageAsset(asset({ fileName: 'logo.WEBP', uri: 'file://logo' }))
    ).toBe(true);
  });

  it('rejects a declared gif even when the file name looks like a png', () => {
    expect(
      isSupportedImageAsset(
        asset({ mimeType: 'image/gif', fileName: 'logo.png' })
      )
    ).toBe(false);
  });

  it('rejects HEIC and HEIF when the type is missing', () => {
    expect(
      isSupportedImageAsset(asset({ fileName: 'IMG.HEIC', uri: 'file://x' }))
    ).toBe(false);
    expect(isSupportedImageAsset(asset({ uri: 'file://photo.heif' }))).toBe(
      false
    );
  });

  it('allows a converted export that has no extension', () => {
    expect(isSupportedImageAsset(asset({ uri: 'file://converted' }))).toBe(true);
  });

  it('counts rejected assets separately from the ones that can upload', () => {
    const result = filterSupportedImageAssets([
      asset({ mimeType: 'image/jpeg' }),
      asset({ mimeType: 'image/heic' }),
      asset({ fileName: 'shot.heif', uri: 'file://shot' }),
    ]);
    expect(result.supported).toHaveLength(1);
    expect(result.rejectedCount).toBe(2);
  });
});

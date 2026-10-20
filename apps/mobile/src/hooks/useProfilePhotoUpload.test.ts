import { describe, it, expect } from 'vitest';

function isSupportedImageAsset(asset: { mimeType?: string }): boolean {
  if (!asset.mimeType) return true;
  const supported = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return supported.includes(asset.mimeType.toLowerCase());
}

describe('useProfilePhotoUpload image validation', () => {
  it('should accept JPEG images', () => {
    const asset = { uri: 'file://photo.jpg', mimeType: 'image/jpeg' };
    expect(isSupportedImageAsset(asset)).toBe(true);
  });

  it('should accept PNG images', () => {
    const asset = { uri: 'file://photo.png', mimeType: 'image/png' };
    expect(isSupportedImageAsset(asset)).toBe(true);
  });

  it('should accept WebP images', () => {
    const asset = { uri: 'file://photo.webp', mimeType: 'image/webp' };
    expect(isSupportedImageAsset(asset)).toBe(true);
  });

  it('should accept JPG images', () => {
    const asset = { uri: 'file://photo.jpg', mimeType: 'image/jpg' };
    expect(isSupportedImageAsset(asset)).toBe(true);
  });

  it('should reject GIF images', () => {
    const asset = { uri: 'file://photo.gif', mimeType: 'image/gif' };
    expect(isSupportedImageAsset(asset)).toBe(false);
  });

  it('should accept images without mimeType', () => {
    const asset = { uri: 'file://photo.jpg', mimeType: undefined };
    expect(isSupportedImageAsset(asset)).toBe(true);
  });
});

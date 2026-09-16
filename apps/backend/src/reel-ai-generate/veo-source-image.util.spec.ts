import {
  detectImageMime,
  pickOriginalProductImageUrl,
} from './veo-source-image.util';

describe('pickOriginalProductImageUrl', () => {
  it('uses the original catalog photo and ignores display thumbnails', () => {
    expect(
      pickOriginalProductImageUrl({
        image_url: 'https://cdn/original.jpg',
        display_url: 'https://cdn/thumbs/item_image/x.webp',
      })
    ).toBe('https://cdn/original.jpg');
  });

  it('returns null when the original photo is missing', () => {
    expect(
      pickOriginalProductImageUrl({
        display_url: 'https://cdn/thumbs/item_image/x.webp',
      })
    ).toBeNull();
  });
});

describe('detectImageMime', () => {
  it('detects jpeg, png, and webp from magic bytes', () => {
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe(
      'image/jpeg'
    );
    expect(
      detectImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ).toBe('image/png');
    expect(
      detectImageMime(Buffer.from('RIFF....WEBP', 'ascii'))
    ).toBe('image/webp');
  });

  it('falls back to a safe image content-type', () => {
    expect(detectImageMime(Buffer.from('abc'), 'image/png; charset=binary')).toBe(
      'image/png'
    );
    expect(detectImageMime(Buffer.from('abc'), 'application/octet-stream')).toBe(
      'image/jpeg'
    );
  });
});

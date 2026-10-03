import {
  isSupportedImageFile,
  isSupportedImageMime,
} from './supportedImageFormats';

function image(name: string, type: string): File {
  return new File(['x'], name, { type });
}

describe('supported image formats', () => {
  it('accepts jpeg, png, and webp, including a charset suffix', () => {
    expect(isSupportedImageMime('image/jpeg')).toBe(true);
    expect(isSupportedImageMime(' Image/PNG ; charset=binary ')).toBe(true);
    expect(isSupportedImageFile(image('logo.webp', 'image/webp'))).toBe(true);
    expect(isSupportedImageFile(image('logo.jpg', ''))).toBe(true);
    expect(isSupportedImageFile(image('LOGO.PNG', ''))).toBe(true);
  });

  it('rejects gif, heic, and a file with neither a type nor an extension', () => {
    expect(isSupportedImageMime(null)).toBe(false);
    expect(isSupportedImageMime('')).toBe(false);
    expect(isSupportedImageFile(image('logo.gif', 'image/gif'))).toBe(false);
    expect(isSupportedImageFile(image('logo.heic', ''))).toBe(false);
    expect(isSupportedImageFile(image('logo.png', 'image/gif'))).toBe(false);
    expect(isSupportedImageFile(image('logo', ''))).toBe(false);
  });
});

export interface ProductImageRow {
  image_url?: string | null;
  display_url?: string | null;
}

/** Use the original catalog photo — never the 400px WebP display thumbnail. */
export function pickOriginalProductImageUrl(
  row?: ProductImageRow | null
): string | null {
  const original = row?.image_url?.trim();
  return original || null;
}

export function detectImageMime(
  buffer: Buffer,
  contentType?: string | string[]
): string {
  if (isJpeg(buffer)) return 'image/jpeg';
  if (isPng(buffer)) return 'image/png';
  if (isWebp(buffer)) return 'image/webp';
  return mimeFromContentType(contentType);
}

function mimeFromContentType(contentType?: string | string[]): string {
  const raw = Array.isArray(contentType) ? contentType[0] : contentType;
  const header = String(raw || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (header === 'image/png' || header === 'image/jpeg' || header === 'image/webp') {
    return header;
  }
  return 'image/jpeg';
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  );
}

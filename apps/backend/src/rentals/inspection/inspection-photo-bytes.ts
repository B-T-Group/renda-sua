import { createHash } from 'crypto';
import sharp from 'sharp';

export function photoSha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Drop EXIF and GPS. Keep PNG, WebP, or JPEG instead of relabeling everything as JPEG. */
export async function stripPhoto(
  bytes: Buffer,
  contentType: string
): Promise<{ bytes: Buffer; contentType: string; ext: string }> {
  const type = normalizeType(contentType);
  const image = sharp(bytes, { failOn: 'error' }).rotate();
  if (type === 'image/png') return packed(await image.png().toBuffer(), 'image/png', 'png');
  if (type === 'image/webp') return packed(await image.webp().toBuffer(), 'image/webp', 'webp');
  return packed(await image.jpeg({ quality: 85 }).toBuffer(), 'image/jpeg', 'jpg');
}

function packed(bytes: Buffer, contentType: string, ext: string) {
  return { bytes, contentType, ext };
}

function normalizeType(contentType: string): string {
  const raw = contentType.toLowerCase().split(';')[0].trim();
  return raw === 'image/jpg' ? 'image/jpeg' : raw;
}

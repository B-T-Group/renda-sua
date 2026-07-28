/** Formats the backend (sharp) can process for product/listing images. */
export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export const SUPPORTED_IMAGE_ACCEPT =
  'image/jpeg,image/jpg,image/png,image/webp';

const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export function isSupportedImageMime(mime: string | undefined | null): boolean {
  if (!mime) return false;
  const normalized = mime.toLowerCase().split(';')[0].trim();
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(normalized);
}

export function isSupportedImageFile(file: File): boolean {
  if (isSupportedImageMime(file.type)) return true;
  if (file.type) return false;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext ?? '');
}

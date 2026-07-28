/** Formats sharp can decode reliably in our backend image. */
export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export function normalizeImageMime(mime: string): string {
  return mime.toLowerCase().split(';')[0].trim();
}

export function isSupportedImageMimeType(
  mime: string | undefined | null
): boolean {
  if (!mime) return false;
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(
    normalizeImageMime(mime)
  );
}

export function isSupportedImageFileName(
  fileName: string | undefined | null
): boolean {
  if (!fileName) return true;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return true;
  return SUPPORTED_EXTENSIONS.has(ext);
}

export const UNSUPPORTED_IMAGE_FORMAT_MESSAGE =
  'Unsupported image format. Please upload JPEG, PNG, or WebP.';

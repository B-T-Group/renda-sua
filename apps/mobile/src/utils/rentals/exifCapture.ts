/** EXIF DateTimeOriginal from an image-picker asset. The server parses the raw string. */
export function exifDateTimeOriginal(exif: unknown): string | null {
  if (!exif || typeof exif !== 'object') return null;
  const row = exif as Record<string, unknown>;
  const direct = stringValue(row.DateTimeOriginal) ?? stringValue(row.DateTime);
  if (direct) return direct;
  return nestedExif(row['{Exif}']);
}

function nestedExif(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  return stringValue((value as Record<string, unknown>).DateTimeOriginal);
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

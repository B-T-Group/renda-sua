import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import sharp from 'sharp';

/** Bytes sent to OpenAI image edit and rembg after downscale. */
export const CLEANUP_IMAGE_TARGET_MAX_BYTES = 10 * 1024 * 1024;
/** Reject the source before download or model calls. */
export const CLEANUP_IMAGE_SOURCE_HARD_MAX_BYTES = 25 * 1024 * 1024;

const HEAD_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 25_000;
const INITIAL_EDGE_PX = 2048;
const MIN_EDGE_PX = 1024;
const INITIAL_QUALITY = 85;
const MIN_QUALITY = 45;

export class CleanupImageTooLargeError extends Error {
  constructor(readonly bytes: number) {
    super(tooLargeMessage(bytes));
    this.name = 'CleanupImageTooLargeError';
  }
}

export async function fetchFittedCleanupImage(
  url: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  await assertSourceWithinHardCap(url);
  const downloaded = await downloadCleanupSource(url);
  return fitCleanupBuffer(downloaded.buffer, downloaded.mimeType);
}

async function assertSourceWithinHardCap(url: string): Promise<void> {
  try {
    const head = await axios.head(url, {
      timeout: HEAD_TIMEOUT_MS,
      validateStatus: (status) => status === 200 || status === 403 || status === 405,
    });
    if (head.status !== 200) return;
    rejectIfContentLengthTooLarge(head.headers['content-length']);
  } catch (error: unknown) {
    if (error instanceof CleanupImageTooLargeError) throw error;
  }
}

function rejectIfContentLengthTooLarge(raw: unknown): void {
  const length =
    typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
  if (!Number.isFinite(length) || length <= 0) return;
  if (length > CLEANUP_IMAGE_SOURCE_HARD_MAX_BYTES) {
    throw new CleanupImageTooLargeError(length);
  }
}

async function downloadCleanupSource(
  url: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    return await readCleanupDownload(url);
  } catch (error: unknown) {
    rethrowDownloadError(error);
  }
}

async function readCleanupDownload(
  url: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const { data, headers, status } = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: DOWNLOAD_TIMEOUT_MS,
    maxContentLength: CLEANUP_IMAGE_SOURCE_HARD_MAX_BYTES,
    maxBodyLength: CLEANUP_IMAGE_SOURCE_HARD_MAX_BYTES,
    validateStatus: (code) => code === 200,
  });
  if (status !== 200 || !data) {
    throw new HttpException(
      'Could not download image for cleanup',
      HttpStatus.BAD_REQUEST
    );
  }
  return { buffer: Buffer.from(data), mimeType: mimeFromHeaders(headers) };
}

function rethrowDownloadError(error: unknown): never {
  if (error instanceof CleanupImageTooLargeError) throw error;
  if (error instanceof HttpException) throw error;
  if (isMaxContentLengthError(error)) {
    throw new CleanupImageTooLargeError(CLEANUP_IMAGE_SOURCE_HARD_MAX_BYTES + 1);
  }
  throw error;
}

function isMaxContentLengthError(error: unknown): boolean {
  return (
    axios.isAxiosError(error) && /maxContentLength/i.test(error.message || '')
  );
}

function mimeFromHeaders(headers: { [key: string]: unknown }): string {
  const raw = headers['content-type'];
  const headerType = typeof raw === 'string' ? raw.split(';')[0]?.trim() : '';
  if (headerType && !headerType.startsWith('image/')) {
    throw new HttpException(
      'Cleanup source is not an image',
      HttpStatus.BAD_REQUEST
    );
  }
  return headerType || 'image/jpeg';
}

export async function fitCleanupBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (buffer.byteLength > CLEANUP_IMAGE_SOURCE_HARD_MAX_BYTES) {
    throw new CleanupImageTooLargeError(buffer.byteLength);
  }
  if (buffer.byteLength <= CLEANUP_IMAGE_TARGET_MAX_BYTES) {
    return { buffer, mimeType };
  }
  return downscaleUntilTarget(buffer);
}

async function downscaleUntilTarget(
  buffer: Buffer
): Promise<{ buffer: Buffer; mimeType: string }> {
  let quality = INITIAL_QUALITY;
  let edge = INITIAL_EDGE_PX;
  let jpeg = await renderJpeg(buffer, edge, quality);
  while (jpeg.byteLength > CLEANUP_IMAGE_TARGET_MAX_BYTES && quality > MIN_QUALITY) {
    quality -= 10;
    edge = Math.max(MIN_EDGE_PX, Math.floor(edge * 0.85));
    jpeg = await renderJpeg(buffer, edge, quality);
  }
  if (jpeg.byteLength > CLEANUP_IMAGE_TARGET_MAX_BYTES) {
    throw new CleanupImageTooLargeError(buffer.byteLength);
  }
  return { buffer: jpeg, mimeType: 'image/jpeg' };
}

function renderJpeg(buffer: Buffer, edge: number, quality: number): Promise<Buffer> {
  return sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

function tooLargeMessage(bytes: number): string {
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  return `Image is too large (${mb} MB). Use an image under 25 MB.`;
}

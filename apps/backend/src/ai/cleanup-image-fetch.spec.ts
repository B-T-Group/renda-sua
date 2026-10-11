import axios from 'axios';
import sharp from 'sharp';
import { HttpException } from '@nestjs/common';
import {
  CLEANUP_IMAGE_SOURCE_HARD_MAX_BYTES,
  CLEANUP_IMAGE_TARGET_MAX_BYTES,
  CleanupImageTooLargeError,
  fetchFittedCleanupImage,
  fitCleanupBuffer,
} from './cleanup-image-fetch';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    head: jest.fn(),
    get: jest.fn(),
  };
});

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('fetchFittedCleanupImage', () => {
  beforeEach(() => {
    mockedAxios.head.mockReset();
    mockedAxios.get.mockReset();
  });

  it('rejects a source over 25 MB before download', async () => {
    mockedAxios.head.mockResolvedValue({
      status: 200,
      headers: {
        'content-length': String(CLEANUP_IMAGE_SOURCE_HARD_MAX_BYTES + 1),
      },
    });

    await expect(
      fetchFittedCleanupImage('https://uploads.example/huge.jpg')
    ).rejects.toBeInstanceOf(CleanupImageTooLargeError);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('downscales a source between 10 MB and 25 MB', async () => {
    const oversized = await noisyJpegOverTarget();
    expect(oversized.byteLength).toBeGreaterThan(
      CLEANUP_IMAGE_TARGET_MAX_BYTES
    );
    expect(oversized.byteLength).toBeLessThanOrEqual(
      CLEANUP_IMAGE_SOURCE_HARD_MAX_BYTES
    );
    mockedAxios.head.mockResolvedValue({
      status: 200,
      headers: { 'content-length': String(oversized.byteLength) },
    });
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: oversized,
      headers: { 'content-type': 'image/jpeg' },
    });

    const fitted = await fetchFittedCleanupImage(
      'https://uploads.example/big.jpg'
    );

    expect(fitted.mimeType).toBe('image/jpeg');
    expect(fitted.buffer.byteLength).toBeLessThanOrEqual(
      CLEANUP_IMAGE_TARGET_MAX_BYTES
    );
    expect(fitted.buffer.byteLength).toBeGreaterThan(0);
  });

  it('downloads when the size header is missing or the HEAD request fails', async () => {
    const body = Buffer.from('small-jpeg');
    mockedAxios.head.mockRejectedValueOnce(new Error('head blocked'));
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: body,
      headers: { 'content-type': 'image/jpeg; charset=binary' },
    });

    const fitted = await fetchFittedCleanupImage(
      'https://uploads.example/small.jpg'
    );

    expect(fitted).toEqual({ buffer: body, mimeType: 'image/jpeg' });
  });

  it('rejects a download that is not an image', async () => {
    mockedAxios.head.mockResolvedValue({ status: 405, headers: {} });
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: Buffer.from('<html>'),
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

    await expect(
      fetchFittedCleanupImage('https://uploads.example/page.html')
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('turns an oversized download into a too-large error', async () => {
    const error = new axios.AxiosError(
      'maxContentLength size of 26214400 exceeded'
    );
    mockedAxios.head.mockResolvedValue({ status: 200, headers: {} });
    mockedAxios.get.mockRejectedValue(error);

    await expect(
      fetchFittedCleanupImage('https://uploads.example/huge.jpg')
    ).rejects.toBeInstanceOf(CleanupImageTooLargeError);
  });
});

describe('fitCleanupBuffer', () => {
  it('returns a buffer that is already under 10 MB', async () => {
    const buffer = Buffer.from('already-small');
    await expect(fitCleanupBuffer(buffer, 'image/png')).resolves.toEqual({
      buffer,
      mimeType: 'image/png',
    });
  });

  it('rejects a buffer over 25 MB before resizing', async () => {
    const buffer = Buffer.alloc(CLEANUP_IMAGE_SOURCE_HARD_MAX_BYTES + 1);
    await expect(fitCleanupBuffer(buffer, 'image/jpeg')).rejects.toBeInstanceOf(
      CleanupImageTooLargeError
    );
  });
});

async function noisyJpegOverTarget(): Promise<Buffer> {
  const width = 4200;
  const height = 4200;
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i += 1) {
    raw[i] = (i * 31 + 17) % 256;
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

import axios from 'axios';
import sharp from 'sharp';
import {
  CLEANUP_IMAGE_SOURCE_HARD_MAX_BYTES,
  CLEANUP_IMAGE_TARGET_MAX_BYTES,
  CleanupImageTooLargeError,
  fetchFittedCleanupImage,
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
      headers: { 'content-length': String(CLEANUP_IMAGE_SOURCE_HARD_MAX_BYTES + 1) },
    });

    await expect(
      fetchFittedCleanupImage('https://uploads.example/huge.jpg')
    ).rejects.toBeInstanceOf(CleanupImageTooLargeError);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('downscales a source between 10 MB and 25 MB', async () => {
    const oversized = await noisyJpegOverTarget();
    expect(oversized.byteLength).toBeGreaterThan(CLEANUP_IMAGE_TARGET_MAX_BYTES);
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

    const fitted = await fetchFittedCleanupImage('https://uploads.example/big.jpg');

    expect(fitted.mimeType).toBe('image/jpeg');
    expect(fitted.buffer.byteLength).toBeLessThanOrEqual(
      CLEANUP_IMAGE_TARGET_MAX_BYTES
    );
    expect(fitted.buffer.byteLength).toBeGreaterThan(0);
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

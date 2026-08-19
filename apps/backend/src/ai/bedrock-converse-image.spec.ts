import sharp from 'sharp';
import {
  BEDROCK_CONVERSE_MAX_IMAGE_BYTES,
  fitImageBytesForBedrockConverse,
  isWithinBedrockImageLimits,
} from './bedrock-converse-image';

async function noisyJpeg(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) {
    raw[i] = (i * 31 + 17) % 256;
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

describe('fitImageBytesForBedrockConverse', () => {
  it('passes through small compliant images', async () => {
    const input = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .jpeg({ quality: 80 })
      .toBuffer();

    const fitted = await fitImageBytesForBedrockConverse(input, 'jpeg');
    expect(fitted.format).toBe('jpeg');
    expect(fitted.bytes).toBe(input);
  });

  it('compresses oversized images under the Bedrock byte limit', async () => {
    const input = await noisyJpeg(2400, 2400);
    expect(input.byteLength).toBeGreaterThan(BEDROCK_CONVERSE_MAX_IMAGE_BYTES);

    const fitted = await fitImageBytesForBedrockConverse(input, 'jpeg');
    expect(fitted.format).toBe('jpeg');
    expect(fitted.bytes.byteLength).toBeLessThanOrEqual(
      BEDROCK_CONVERSE_MAX_IMAGE_BYTES
    );
    expect(fitted.bytes.byteLength).toBeGreaterThan(0);
  });

  it('keeps undecodable bytes unchanged', async () => {
    const input = new Uint8Array(Buffer.from('not-an-image'));
    const fitted = await fitImageBytesForBedrockConverse(input, 'webp');
    expect(fitted.format).toBe('webp');
    expect(Buffer.from(fitted.bytes).toString()).toBe('not-an-image');
  });

  it('treats missing dimensions as within limits only when bytes fit', () => {
    expect(isWithinBedrockImageLimits(100, 100, 100)).toBe(true);
    expect(
      isWithinBedrockImageLimits(BEDROCK_CONVERSE_MAX_IMAGE_BYTES + 1, 100, 100)
    ).toBe(false);
    expect(isWithinBedrockImageLimits(100, 8001, 100)).toBe(false);
  });
});

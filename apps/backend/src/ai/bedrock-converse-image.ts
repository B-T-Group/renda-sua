import sharp from 'sharp';

type ConverseImageFormat = 'png' | 'jpeg' | 'gif' | 'webp';

/** Bedrock Converse hard limit is 3.75 MB / 8000 px per image. */
export const BEDROCK_CONVERSE_MAX_IMAGE_BYTES = Math.floor(3.5 * 1024 * 1024);
export const BEDROCK_CONVERSE_MAX_DIMENSION_PX = 8000;
const COMPRESS_EDGE_PX = 2048;

export async function fitImageBytesForBedrockConverse(
  input: Uint8Array,
  hintedFormat: ConverseImageFormat
): Promise<{ format: ConverseImageFormat; bytes: Uint8Array }> {
  try {
    return await fitValidImage(input, hintedFormat);
  } catch {
    return { format: hintedFormat, bytes: input };
  }
}

async function fitValidImage(
  input: Uint8Array,
  hintedFormat: ConverseImageFormat
): Promise<{ format: ConverseImageFormat; bytes: Uint8Array }> {
  const meta = await sharp(Buffer.from(input), { failOn: 'none' }).metadata();
  if (isWithinBedrockImageLimits(input.byteLength, meta.width, meta.height)) {
    return { format: hintedFormat, bytes: input };
  }
  const jpeg = await compressToJpeg(input);
  return { format: 'jpeg', bytes: new Uint8Array(jpeg) };
}

export function isWithinBedrockImageLimits(
  byteLength: number,
  width?: number,
  height?: number
): boolean {
  return (
    byteLength <= BEDROCK_CONVERSE_MAX_IMAGE_BYTES &&
    (width ?? 0) <= BEDROCK_CONVERSE_MAX_DIMENSION_PX &&
    (height ?? 0) <= BEDROCK_CONVERSE_MAX_DIMENSION_PX
  );
}

async function compressToJpeg(input: Uint8Array): Promise<Buffer> {
  let quality = 80;
  let edge = COMPRESS_EDGE_PX;
  let buffer = await renderJpeg(input, edge, quality);
  while (buffer.byteLength > BEDROCK_CONVERSE_MAX_IMAGE_BYTES && quality > 45) {
    quality -= 10;
    edge = Math.max(1024, Math.floor(edge * 0.85));
    buffer = await renderJpeg(input, edge, quality);
  }
  return buffer;
}

function renderJpeg(
  input: Uint8Array,
  edge: number,
  quality: number
): Promise<Buffer> {
  return sharp(Buffer.from(input), { failOn: 'none' })
    .rotate()
    .resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import type { ValidatedImage } from '../types/image-validation.types';

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MAX_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ImageLoaderService {
  private readonly logger = new Logger(ImageLoaderService.name);

  async loadFromBase64(
    data: string,
    mimeType: string,
    fileName: string | undefined,
    clientIndex: number
  ): Promise<ValidatedImage> {
    const buffer = Buffer.from(data, 'base64');
    if (buffer.length > MAX_BYTES) {
      throw new HttpException(
        'Image exceeds maximum size of 10MB',
        HttpStatus.BAD_REQUEST
      );
    }
    return this.normalize(buffer, mimeType, fileName, clientIndex);
  }

  private async normalize(
    buffer: Buffer,
    declaredMime: string,
    fileName: string | undefined,
    clientIndex: number
  ): Promise<ValidatedImage> {
    const detectedMime = await this.detectMime(buffer);
    const mime = detectedMime ?? declaredMime.toLowerCase();
    if (!ALLOWED_MIMES.has(mime)) {
      throw new HttpException(
        `Unsupported image format: ${mime}`,
        HttpStatus.BAD_REQUEST
      );
    }

    let input = buffer;
    if (mime === 'image/heic' || mime === 'image/heif') {
      input = await this.convertHeic(buffer);
    }

    const pipeline = sharp(input).rotate();
    const meta = await pipeline.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const normalized = await pipeline.png().toBuffer();

    return {
      buffer: normalized,
      width,
      height,
      format: meta.format ?? 'png',
      mimeType: mime,
      fileName,
      clientIndex,
    };
  }

  private async detectMime(buffer: Buffer): Promise<string | undefined> {
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(buffer);
    return detected?.mime;
  }

  private async convertHeic(buffer: Buffer): Promise<Buffer> {
    try {
      const convert = (await import('heic-convert')).default;
      const out = await convert({
        buffer,
        format: 'JPEG',
        quality: 0.9,
      });
      return Buffer.from(out);
    } catch (error: any) {
      this.logger.warn(`HEIC convert failed, trying sharp: ${error.message}`);
      return sharp(buffer).jpeg().toBuffer();
    }
  }
}

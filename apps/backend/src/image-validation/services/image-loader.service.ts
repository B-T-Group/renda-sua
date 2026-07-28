import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import {
  isSupportedImageMimeType,
  normalizeImageMime,
  UNSUPPORTED_IMAGE_FORMAT_MESSAGE,
} from '../../common/supported-image-formats';
import type { ValidatedImage } from '../types/image-validation.types';

const MAX_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ImageLoaderService {
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
    const mime = normalizeImageMime(detectedMime ?? declaredMime);
    if (!isSupportedImageMimeType(mime)) {
      throw new HttpException(
        `${UNSUPPORTED_IMAGE_FORMAT_MESSAGE} Received: ${mime}`,
        HttpStatus.BAD_REQUEST
      );
    }

    const pipeline = sharp(buffer).rotate();
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
}

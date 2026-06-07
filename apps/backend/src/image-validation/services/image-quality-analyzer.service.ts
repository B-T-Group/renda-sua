import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import type { ValidatedImage } from '../types/image-validation.types';
import { computeLaplacianVariance } from '../utils/blur-variance.util';

export const MIN_WIDTH = 800;
export const MIN_HEIGHT = 800;
export const BLUR_VARIANCE_THRESHOLD = 100;
export const BRIGHTNESS_DARK = 40;
export const BRIGHTNESS_OVEREXPOSED = 220;

export interface QualityMetrics {
  width: number;
  height: number;
  blurVariance: number;
  meanBrightness: number;
}

@Injectable()
export class ImageQualityAnalyzerService {
  async analyze(image: ValidatedImage): Promise<QualityMetrics> {
    const resized = await sharp(image.buffer)
      .resize(512, 512, { fit: 'inside' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const variance = computeLaplacianVariance(
      resized.data,
      resized.info.width,
      resized.info.height
    );

    const stats = await sharp(image.buffer).stats();
    const meanBrightness = stats.channels[0]?.mean ?? 128;

    return {
      width: image.width,
      height: image.height,
      blurVariance: variance,
      meanBrightness,
    };
  }
}

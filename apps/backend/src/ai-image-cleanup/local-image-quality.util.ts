import sharp from 'sharp';
import { computeLaplacianVariance } from '../image-validation/utils/blur-variance.util';
import { calculateScore } from '../image-validation/utils/score-calculator.util';
import { validationMessage } from '../image-validation/utils/validation-messages.util';
import {
  BLUR_VARIANCE_THRESHOLD,
  BRIGHTNESS_DARK,
  BRIGHTNESS_OVEREXPOSED,
  MIN_HEIGHT,
  MIN_WIDTH,
} from '../image-validation/services/image-quality-analyzer.service';
import type { ValidationIssue } from '../image-validation/types/image-validation.types';
import { VALIDATION_CODES } from '../image-validation/types/image-validation.types';

export interface LocalImageQualityResult {
  width: number;
  height: number;
  issues: ValidationIssue[];
  qualityScore: number;
}

/** Cheap local blur / brightness / resolution checks (no OpenAI). */
export async function analyzeLocalImageQuality(
  buffer: Buffer
): Promise<LocalImageQualityResult> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const issues: ValidationIssue[] = [];

  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    issues.push({
      code: VALIDATION_CODES.LOW_RESOLUTION,
      message: validationMessage(VALIDATION_CODES.LOW_RESOLUTION),
      severity: 'warning',
    });
  }

  const resized = await sharp(buffer)
    .resize(512, 512, { fit: 'inside' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const blurVariance = computeLaplacianVariance(
    resized.data,
    resized.info.width,
    resized.info.height
  );
  if (blurVariance < BLUR_VARIANCE_THRESHOLD) {
    issues.push({
      code: VALIDATION_CODES.IMAGE_BLURRY,
      message: validationMessage(VALIDATION_CODES.IMAGE_BLURRY),
      severity: 'warning',
    });
  }

  const stats = await sharp(buffer).stats();
  const meanBrightness = stats.channels[0]?.mean ?? 128;
  if (
    meanBrightness < BRIGHTNESS_DARK ||
    meanBrightness > BRIGHTNESS_OVEREXPOSED
  ) {
    issues.push({
      code: VALIDATION_CODES.POOR_LIGHTING,
      message: validationMessage(VALIDATION_CODES.POOR_LIGHTING),
      severity: 'warning',
    });
  }

  return {
    width,
    height,
    issues,
    qualityScore: calculateScore(issues),
  };
}
